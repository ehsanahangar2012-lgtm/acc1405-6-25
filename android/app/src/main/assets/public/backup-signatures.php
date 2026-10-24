<?php
/**
 * اسکریپت پشتیبانگیری خودکار امضاهای دیجیتال
 * برای اجرا روزانه از طریق cron job
 */

if (PHP_SAPI !== 'cli') {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'CLI_ONLY']);
    exit;
}

define('SIGNATURES_DIR', __DIR__ . '/signatures/');
define('BACKUP_DIR', __DIR__ . '/backups/signatures/');
define('RETENTION_DAYS', 90); // نگهداری 90 روز

// Signatures are private; this job is intentionally CLI-only.
if (!is_dir(SIGNATURES_DIR)) {
    fwrite(STDERR, "Signature storage directory is missing.\n");
    exit(1);
}
if (!is_dir(BACKUP_DIR) && !@mkdir(BACKUP_DIR, 0700, true) && !is_dir(BACKUP_DIR)) {
    fwrite(STDERR, "Signature backup directory is unavailable.\n");
    exit(1);
}
@chmod(BACKUP_DIR, 0700);
$deny = BACKUP_DIR . '.htaccess';
if (!is_file($deny)) @file_put_contents($deny, "<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\nOptions -Indexes\n", LOCK_EX);

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
