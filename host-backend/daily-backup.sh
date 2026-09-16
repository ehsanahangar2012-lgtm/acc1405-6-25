#!/bin/bash

# کرون جاب برای بکآپ روزانه
# اضافه کنید به crontab: 0 2 * * * /path/to/daily-backup.sh

BACKUP_URL="https://acc.ashkghalam.ir/backup-system.php"
LOG_FILE="/var/log/ashkghalam-backup.log"

echo "$(date): Starting daily backup..." >> $LOG_FILE

# پاکسازی فایلهای قدیمی
curl -s -X POST "$BACKUP_URL" -d "action=daily_cleanup" >> $LOG_FILE

# بکآپ کامل از localStorage (اگر امکان دسترسی وجود دارد)
# این بخش باید از طریق API یا webhook پیاده سازی شود

echo "$(date): Daily backup completed" >> $LOG_FILE