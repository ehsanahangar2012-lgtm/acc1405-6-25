<?php
/**
 * اسکریپت پشتیبانگیری خودکار امضاهای دیجیتال
 * برای اجرا روزانه از طریق cron job
 */

define('SIGNATURES_DIR', __DIR__ . '/signatures/');
define('BACKUP_DIR', __DIR__ . '/backups/signatures/');
define('RETENTION_DAYS', 90); // نگهداری 90 روز

// ایجاد دایرکتوری پشتیبان
if (!file_exists(BACKUP_DIR)) {
    mkdir(BACKUP_DIR, 0755, true);
}

// نام فایل پشتیبان
$backupFile = BACKUP_DIR . 'signatures_' . date('Y-m-d_His') . '.zip';

// ایجاد فایل ZIP
$zip = new ZipArchive();
if ($zip->open($backupFile, ZipArchive::CREATE) !== TRUE) {
    die("خطا در ایجاد فایل پشتیبان\n");
}

// اضافه کردن فایلها
$files = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator(SIGNATURES_DIR),
    RecursiveIteratorIterator::LEAVES_ONLY
);

$fileCount = 0;
foreach ($files as $file) {
    if (!$file->isDir()) {
        $filePath = $file->getRealPath();
        $relativePath = substr($filePath, strlen(SIGNATURES_DIR));
        $zip->addFile($filePath, $relativePath);
        $fileCount++;
    }
}

$zip->close();

// گزارش
$size = filesize($backupFile);
echo "پشتیبانگیری موفق: $fileCount فایل، حجم: " . round($size/1024/1024, 2) . " MB\n";
echo "فایل: $backupFile\n";

// حذف پشتیبانهای قدیمی
$cutoffDate = strtotime("-$RETENTION_DAYS days");
$backups = glob(BACKUP_DIR . 'signatures_*.zip');

foreach ($backups as $backup) {
    if (filemtime($backup) < $cutoffDate) {
        unlink($backup);
        echo "حذف پشتیبان قدیمی: " . basename($backup) . "\n";
    }
}

// ثبت لاگ
$logFile = __DIR__ . '/backup_log.txt';
$logEntry = date('Y-m-d H:i:s') . " - پشتیبانگیری موفق: $fileCount فایل\n";
file_put_contents($logFile, $logEntry, FILE_APPEND);
