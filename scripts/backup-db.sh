#!/bin/sh
# Резервная копия базы CRM (SQLite — один файл db/custom.db).
# Данные хранятся в одном файле: скопировать = сделать бэкап.
#
# Автоматический бэкап каждый день в 04:00 (на VPS):
#   crontab -e
#   0 4 * * * /путь/к/playzone-crm/scripts/backup-db.sh /путь/к/playzone-crm
#
# Восстановление: остановить CRM, заменить db/custom.db на копию, запустить CRM.

set -e
PROJECT_DIR="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
BACKUP_DIR="$PROJECT_DIR/backups"
DB_FILE="$PROJECT_DIR/db/custom.db"
KEEP=30  # сколько последних копий хранить

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y-%m-%d_%H-%M-%S)"
cp "$DB_FILE" "$BACKUP_DIR/custom_$STAMP.db"
echo "Копия создана: backups/custom_$STAMP.db"

# Удаляем старые копии, оставляя последние $KEEP
ls -1t "$BACKUP_DIR"/custom_*.db 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
  rm -f "$old"
done
echo "Старые копии удалены (хранится последних: $KEEP)"
