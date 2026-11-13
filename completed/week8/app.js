export default function appSrc(
  express,
  bodyParser,
  createReadStream,
  crypto,
  http,
  MongoClient,
  pug,
  fetchTemplate = fetch,
  puppeteer,
) {
  const app = express();
  const login = "aleldm";

  app.use((req, res, next) => {
    res.set({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,OPTIONS,DELETE",
      "Access-Control-Allow-Headers":
        "Content-Type,Accept,x-test,ngrok-skip-browser-warning",
      "Cache-Control": "no-store",
    });

    if (!req.path.endsWith("/")) {
      const queryIndex = req.originalUrl.indexOf("?");
      const query = queryIndex === -1 ? "" : req.originalUrl.slice(queryIndex);
      return res.redirect(308, req.path.replace(/^\/+/, "/") + "/" + query);
    }

    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());

  app.get("/login/", (req, res) => {
    res.type("text/plain").send(login);
  });

  app.get("/test/", async (req, res) => {
    let url;
    try {
      if (typeof req.query.URL !== "string") throw new Error();
      url = new URL(req.query.URL);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch {
      return res
        .status(400)
        .type("text/plain")
        .send("Укажите HTTP(S)-адрес в параметре URL");
    }

    let browser;
    let stage = "запуск браузера";
    try {
      browser = await puppeteer.launch({
        headless: true,
        timeout: 30000,
        args: ["--no-sandbox"],
      });
      stage = "создание вкладки";
      const page = await browser.newPage();
      page.setDefaultTimeout(15000);
      stage = "загрузка страницы";
      await page.goto(url.href, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      stage = "ожидание кнопки #bt";
      await page.waitForSelector("#bt", { visible: true });
      stage = "ожидание поля #inp";
      await page.waitForSelector("#inp");
      stage = "нажатие кнопки #bt";
      await page.click("#bt");
      stage = "ожидание числа в #inp";
      const result = await page.waitForFunction(() => {
        const value = document.querySelector("#inp")?.value?.trim();
        return value && Number.isFinite(Number(value)) ? value : false;
      });
      res.type("text/plain").send(await result.jsonValue());
    } catch (error) {
      const message = String(error?.message ?? "");
      let reason = "";
      if (/Running as root without --no-sandbox/i.test(message)) {
        reason =
          ". Chrome запущен от root: запускайте Node от отдельного непривилегированного пользователя";
      } else if (
        /Could not find Chrome|Could not find expected browser|executable.*does not exist/i.test(
          message,
        )
      ) {
        reason =
          ". Не установлен Chrome для пользователя приложения: выполните npx puppeteer browsers install chrome";
      } else if (/error while loading shared libraries/i.test(message)) {
        reason = ". На сервере отсутствуют системные библиотеки Chrome";
      } else if (/No usable sandbox|Operation not permitted/i.test(message)) {
        reason = ". Сервер блокирует запуск Chrome или его sandbox";
      } else if (/net::ERR_[A-Z_]+/.test(message)) {
        reason = ". " + message.match(/net::ERR_[A-Z_]+/)[0];
      }
      res
        .status(error.name === "TimeoutError" ? 504 : 502)
        .type("text/plain")
        .send("Не удалось получить число: " + stage + reason);
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  });

  app.post("/render/", async (req, res) => {
    if (!req.is("application/json")) {
      return res
        .status(415)
        .type("text/plain")
        .send("Отправьте application/json");
    }
    const { random2, random3 } = req.body ?? {};
    if (
      ![random2, random3].every(
        (value) => typeof value === "string" || typeof value === "number",
      )
    ) {
      return res
        .status(400)
        .type("text/plain")
        .send("Передайте random2 и random3");
    }
    let url;
    try {
      if (typeof req.query.addr !== "string") throw new Error();
      url = new URL(req.query.addr);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch {
      return res
        .status(400)
        .type("text/plain")
        .send("Укажите HTTP(S)-адрес шаблона в addr");
    }
    let template;
    try {
      const response = await fetchTemplate(url, {
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error();
      }
      const chunks = [];
      let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > 1024 * 1024) throw new Error();
        chunks.push(chunk);
      }
      template = Buffer.concat(chunks).toString("utf8");
    } catch {
      return res
        .status(502)
        .type("text/plain")
        .send("Не удалось загрузить шаблон");
    }
    try {
      res.type("html").send(pug.render(template, { random2, random3 }));
    } catch {
      res
        .status(422)
        .type("text/plain")
        .send("Не удалось обработать Pug-шаблон");
    }
  });

  app.use("/wordpress", (req, res) => {
    res
      .status(503)
      .type("text/plain")
      .send("WordPress должен быть подключён через Nginx");
  });

  app.post("/insert/", async (req, res) => {
    const { login, password, URL: url } = req.body ?? {};

    if (
      typeof login !== "string" ||
      typeof password !== "string" ||
      typeof url !== "string" ||
      !/^mongodb(?:\+srv)?:\/\//.test(url)
    ) {
      return res
        .status(400)
        .type("text/plain")
        .send("Передайте строки login, password и URL подключения MongoDB");
    }

    let client;
    try {
      client = new MongoClient(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 10000,
      });
      await client.connect();
      await client
        .db()
        .collection("users")
        .insertOne({ login, password }, { w: 1 });
      res.status(201).type("text/plain").send("Документ добавлен");
    } catch {
      res
        .status(502)
        .type("text/plain")
        .send("Не удалось записать документ в MongoDB");
    } finally {
      if (client) await client.close().catch(() => {});
    }
  });

  app.get("/code/", (req, res, next) => {
    res.type("text/plain");
    const source = createReadStream(
      decodeURIComponent(import.meta.url.substring(7)),
    );
    source.on("error", next);
    source.pipe(res);
  });

  app.get("/sha1/:input/", (req, res) => {
    res
      .type("text/plain")
      .send(crypto.createHash("sha1").update(req.params.input).digest("hex"));
  });

  const requestResource = (req, res) => {
    const addr = req.query.addr ?? req.body?.addr;
    let url;

    try {
      if (typeof addr !== "string") throw new Error();
      url = new URL(addr);
      if (url.protocol !== "http:") throw new Error();
    } catch {
      return res
        .status(400)
        .type("text/plain")
        .send("Укажите HTTP-адрес в параметре addr");
    }

    const upstream = http.get(url, (response) => {
      res.type("text/plain");
      response.on("error", () => {
        if (res.headersSent) res.destroy();
        else res.status(502).send("Не удалось прочитать ответ ресурса");
      });
      response.pipe(res);
    });

    upstream.setTimeout(10000, () => upstream.destroy(new Error("Timeout")));
    upstream.on("error", () => {
      if (!res.headersSent)
        res.status(502).type("text/plain").send("Не удалось получить ресурс");
      else res.destroy();
    });
    res.on("close", () => upstream.destroy());
  };

  app.route("/req/").get(requestResource).post(requestResource);

  app.all(/.*/, (req, res) => {
    res.type("text/plain").send(login);
  });

  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    res
      .status(err.status >= 400 && err.status < 500 ? err.status : 500)
      .type("text/plain")
      .send("Ошибка обработки запроса");
  });

  return app;
}
