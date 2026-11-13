# Установка WordPress на aleldm.ru: Caddy + PHP 8.3 + MySQL

Инструкция для твоего сервера Ubuntu 24.04:

- домен `aleldm.ru` и HTTPS уже обслуживает Caddy;
- Express работает на `127.0.0.1:3000`;
- PHP 8.3, MySQL 8.0 и сокет `/run/php/php8.3-fpm.sock` уже установлены;
- проект находится в `/root/projects/svt`;
- WordPress будет работать по `https://aleldm.ru/wordpress/`.

**Сейчас пакеты уже установлены — начинай с шага 2. Шаг 1 оставлен для полной инструкции.** Все команды ниже выполняются на сервере, кроме отдельно отмеченной команды переноса с компьютера. Команды автоматически не выполнялись.

## 1. Установить пакеты — уже выполнено

Для первой установки:

```bash
sudo apt update
sudo apt install -y mysql-server php-fpm php-mysql php-curl php-gd php-mbstring php-xml php-zip php-intl curl rsync openssl
```

Caddy уже установлен и настроен. Nginx для этой схемы не нужен.

Проверка версий:

```bash
php -v
mysql --version
ls -l /run/php/
```

## 2. Запустить MySQL и PHP-FPM

```bash
sudo systemctl enable --now mysql php8.3-fpm
sudo systemctl status mysql php8.3-fpm caddy --no-pager
```

У всех трёх служб должно быть `active (running)`. Если какая-то служба не запустилась, сначала разберись с её ошибкой.

## 3. Создать базу и пользователя MySQL

Сгенерируй пароль для пользователя базы данных:

```bash
openssl rand -hex 24
```

Сохрани полученную строку: она понадобится в SQL ниже и в установщике WordPress.

Войди в MySQL:

```bash
sudo mysql
```

Теперь приглашение должно быть `mysql>`. Вставь следующие SQL-команды, **заменив `REPLACE_WITH_GENERATED_PASSWORD` на сохранённый пароль**:

```sql
CREATE DATABASE wordpress CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'wordpress'@'localhost' IDENTIFIED BY 'REPLACE_WITH_GENERATED_PASSWORD';
GRANT ALL PRIVILEGES ON wordpress.* TO 'wordpress'@'localhost';
EXIT;
```

Это команды первой установки. Если база или пользователь уже существуют, не удаляй их: используй ранее созданные настройки.

После `EXIT` снова появится обычное приглашение терминала. Проверь подключение:

```bash
mysql -u wordpress -p -h localhost wordpress -e 'SELECT DATABASE();'
```

Введи сохранённый пароль по запросу. Символы при вводе не отображаются. В результате должно быть имя `wordpress`.

## 4. Перенести файлы WordPress в рабочий каталог

В проекте на компьютере уже есть папка `wordpress/`, распакованная из https://wordpress.org/latest.zip.

На сервере проверь, что файлы перенесены:

```bash
cd /root/projects/svt
ls wordpress/index.php wordpress/wp-settings.php
```

Если файлов нет, выполни **на своём компьютере из папки проекта**:

```bash
bash deploy.sh
```

Затем вернись в терминал сервера. Следующие команды выполняются **на сервере**:

```bash
sudo mkdir -p /var/www/aleldm/wordpress
sudo rsync -a --exclude=wp-config.php /root/projects/svt/wordpress/ /var/www/aleldm/wordpress/
sudo chown -R www-data:www-data /var/www/aleldm/wordpress
sudo find /var/www/aleldm/wordpress -type d -exec chmod 755 {} \;
sudo find /var/www/aleldm/wordpress -type f ! -name wp-config.php -exec chmod 644 {} \;
```

WordPress будет работать из `/var/www/aleldm/wordpress`. Caddy не должен обслуживать файлы из `/root`.

Этот перенос предназначен для первой установки. После запуска сайта не перезаписывай рабочую папку `wp-content` локальной копией без проверки: там будут загрузки, плагины и темы.

## 5. Дать Caddy доступ к PHP-FPM

Посмотри владельца сокета:

```bash
ls -l /run/php/php8.3-fpm.sock
```

При стандартных настройках он принадлежит `www-data:www-data` и имеет права `srw-rw----`. Добавь пользователя Caddy в эту группу:

```bash
sudo usermod -aG www-data caddy
sudo -u caddy test -r /var/www/aleldm/wordpress/index.php && echo 'WordPress readable'
sudo -u caddy test -w /run/php/php8.3-fpm.sock && echo 'PHP socket accessible'
```

Должны появиться оба сообщения. Если их нет, не продолжай до исправления доступа. Если владелец сокета отличается, нужно проверить настройки пула PHP-FPM.

## 6. Настроить Caddy

Твоя текущая конфигурация:

```caddyfile
aleldm.ru {
    reverse_proxy 127.0.0.1:3000
}
```

Сделай резервную копию:

```bash
sudo cp -a /etc/caddy/Caddyfile /etc/caddy/Caddyfile.backup-$(date +%Y%m%d-%H%M%S)
```

Открой файл:

```bash
sudo nano /etc/caddy/Caddyfile
```

Замени содержимое на конфигурацию ниже. Она сохраняет Express на порту 3000 и добавляет WordPress:

```caddyfile
aleldm.ru {
    log {
        output stdout
        format json
    }

    route {
        @wordpress path /wordpress /wordpress/*
        header @wordpress {
            Access-Control-Allow-Origin "*"
            Access-Control-Allow-Methods "GET,POST,PUT,PATCH,OPTIONS,DELETE"
            Access-Control-Allow-Headers "Content-Type,Accept,Authorization,X-WP-Nonce,ngrok-skip-browser-warning"
            -Access-Control-Allow-Credentials
            defer
        }

        @wpPreflight {
            path /wordpress /wordpress/*
            method OPTIONS
        }
        respond @wpPreflight 204

        handle /wordpress {
            rewrite * /wordpress/index.php
            reverse_proxy unix//run/php/php8.3-fpm.sock {
                transport fastcgi {
                    root /var/www/aleldm
                    split .php
                    env REQUEST_URI /wordpress/
                }
            }
        }

        handle /wordpress/* {
            root * /var/www/aleldm
            @blocked path /wordpress/wp-config.php /wordpress/.* /wordpress/*/.* /wordpress/wp-content/uploads/*.php
            respond @blocked 403
            php_fastcgi unix//run/php/php8.3-fpm.sock {
                try_files {path} {path}/index.php /wordpress/index.php
            }
            file_server
        }

        handle {
            reverse_proxy 127.0.0.1:3000
        }
    }
}
```

В nano: `Ctrl+O`, затем `Enter` для сохранения; `Ctrl+X` для выхода.

Эта конфигурация также сохранена в `server/Caddyfile` проекта. Она рассчитана на показанный выше текущий файл; если ты позже добавишь другие сайты или настройки, их нужно сохранить.

Проверь конфигурацию:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

**Продолжай только при успешной проверке (`Valid configuration`).** Перезапусти Caddy, чтобы он получил права новой группы:

```bash
sudo systemctl restart caddy
sudo systemctl status caddy --no-pager
```

Перезапуск кратковременно прерывает обслуживание сайта. HTTPS продолжит обслуживаться Caddy с существующими настройками сертификатов.

Проверь Express:

```bash
curl -fsS https://aleldm.ru/login/
```

Должно вернуться `aleldm`.

## 7. Установить WordPress в браузере

Открой:

**https://aleldm.ru/wordpress/**

Выбери язык, затем начни установку. Введи параметры:

| Поле | Значение |
|---|---|
| Имя базы данных | `wordpress` |
| Имя пользователя БД | `wordpress` |
| Пароль БД | Сохранённый пароль из шага 3 |
| Сервер базы данных | `localhost` |
| Префикс таблиц | `wp_` |

На следующем экране:

- название сайта: `aleldm`;
- имя администратора: `aleldm`;
- пароль администратора: новый отдельный пароль, сохрани его;
- email: твой действующий адрес.

Заверши установку и войди в админку:

https://aleldm.ru/wordpress/wp-admin/

Если установщик не смог создать `wp-config.php`, он покажет его содержимое. Скопируй именно предложенный текст в файл на сервере:

```bash
sudo nano /var/www/aleldm/wordpress/wp-config.php
```

После установки выполни:

```bash
sudo chown www-data:www-data /var/www/aleldm/wordpress/wp-config.php
sudo chmod 640 /var/www/aleldm/wordpress/wp-config.php
```

## 8. Настроить сайт для задания

В админке WordPress:

1. **Настройки → Общие:** оба адреса должны быть `https://aleldm.ru/wordpress`.
2. **Настройки → Постоянные ссылки:** выбери «Название записи» и сохрани.
3. **Записи → Все записи:** открой стандартную запись «Привет, мир!» / «Hello world!». В URL редактирования должно быть `post=1`.
4. Измени её заголовок на **`aleldm`** и нажми «Обновить». Запись должна быть опубликована.
5. Оставь только эту запись. Не удаляй её для создания новой: новая запись получит другой ID. Страницы WordPress — отдельный тип содержимого, удалять их ради количества записей не нужно.
6. **Настройки → Чтение:** главная страница должна отображать последние записи.

## 9. Проверить результат

На сервере:

```bash
curl -I https://aleldm.ru/wordpress
curl -I https://aleldm.ru/wordpress/
curl -fsS https://aleldm.ru/wordpress/wp-json/wp/v2/posts
curl -fsS https://aleldm.ru/wordpress/wp-json/wp/v2/posts/1
curl -fsS https://aleldm.ru/login/
```

Ожидаемый результат:

- `/wordpress` и `/wordpress/` возвращают главную страницу без внешнего перенаправления;
- `/wordpress/` открывает главную страницу сайта;
- `/posts` возвращает массив с единственной записью;
- у записи `id` равен `1`, а `title.rendered` равен `aleldm`;
- `/login/` возвращает простой текст `aleldm`.

## Если появилась ошибка

```bash
sudo journalctl -u caddy -u php8.3-fpm -u mysql --no-pager -n 80
```

- **502:** проверь работу PHP-FPM, путь к сокету и доступ пользователя Caddy из шага 5.
- **Ошибка подключения к базе:** повтори проверку MySQL из шага 3 и сравни реквизиты с `wp-config.php`.
- **«WordPress должен быть подключён через Nginx»:** это старая заглушка Express. Запрос попал в Node, а должен попасть в PHP-FPM; проверь конфигурацию Caddy из шага 6. Устанавливать Nginx не нужно.
- **REST API возвращает 404:** проверь постоянные ссылки и строку `try_files` в конфигурации Caddy.

Примеры `server/wordpress.nginx.conf.example` и старая Docker-конфигурация в `.backups/wordpress-docker-config/` для этой установки не используются.

## Документация

- [Установка MySQL на Ubuntu](https://ubuntu.com/server/docs/install-and-configure-a-mysql-server)
- [Установка WordPress](https://developer.wordpress.org/advanced-administration/before-install/howto-install/)
- [PHP-FPM в Caddy](https://caddyserver.com/docs/caddyfile/directives/php_fastcgi)
- [Маршрутизация handle в Caddy](https://caddyserver.com/docs/caddyfile/directives/handle)

## CORS проверяющей системы

Проверка с `https://node-server.ru` отправляет OPTIONS с заголовком `ngrok-skip-browser-warning`. Конфигурация в `server/Caddyfile` отвечает на такие запросы к WordPress статусом 204 и разрешает этот заголовок. Блок `route` гарантирует обработку OPTIONS до WordPress; отложенная установка заголовков исключает конфликт с заголовками PHP. Для публичных ответов используется `Access-Control-Allow-Origin: *`, без cross-origin credentials.
