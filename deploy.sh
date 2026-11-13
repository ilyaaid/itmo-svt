#!/usr/bin/env bash
set -euo pipefail

SERVER_IP="104.128.134.95"
SERVER_USER="root"
# Путь относительно домашней директории пользователя на сервере (~/projects/svt)
REMOTE_DIR="projects/svt"

cd "$(dirname "$0")"

echo "Синхронизирую файлы в ~/$REMOTE_DIR на $SERVER_IP..."
rsync -avz --human-readable \
  --exclude='node_modules/' \
  --exclude='.git/' \
  --exclude='.backups/' \
  --exclude='completed/' \
  --exclude='.env' \
  --exclude='.env.*' \
  ./ \
  "$SERVER_USER@$SERVER_IP:$REMOTE_DIR/"

echo "Готово: файлы синхронизированы в ~/$REMOTE_DIR на $SERVER_IP"
