<?php
// فایل کرون جاب برای بکآپ روزانه
// مسیر: /home/username/public_html/daily-cron.php

error_reporting(E_ALL);
ini_set('display_errors', 1);

$logFile = __DIR__ . '/backup-log.txt';

function writeLog($message) {
    global $logFile;
    file_put_contents($logFile, date('Y-m-d H:i:s') . ': ' . $message . PHP_EOL, FILE_APPEND);
}

writeLog('Starting daily backup cron job');

try {
    // فراخوانی API بکآپ
    $url = 'https://acc.ashkghalam.ir/backup-system.php';
    $postData = 'action=daily_cleanup';
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode === 200) {
        writeLog('Daily cleanup completed successfully: ' . $response);
    } else {
        writeLog('Daily cleanup failed with HTTP code: ' . $httpCode);
    }
    
} catch (Exception $e) {
    writeLog('Error in daily backup: ' . $e->getMessage());
}

writeLog('Daily backup cron job finished');
?>