<?php
// CLI-only scheduled cleanup. Public HTTP execution is disabled.
if (PHP_SAPI !== 'cli') {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'CLI_ONLY']);
    exit;
}

error_reporting(E_ALL);
ini_set('display_errors', '0');

$dataDir = __DIR__ . '/data';
if (!is_dir($dataDir) && !@mkdir($dataDir, 0700, true) && !is_dir($dataDir)) {
    fwrite(STDERR, "Private cron storage unavailable.\n");
    exit(1);
}
@chmod($dataDir, 0700);
$deny = $dataDir . '/.htaccess';
if (!is_file($deny)) {
    @file_put_contents($deny, "<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\nOptions -Indexes\n", LOCK_EX);
}
$logFile = $dataDir . '/backup-cron.log';

function writeLog(string $message): void {
    global $logFile;
    @file_put_contents($logFile, date('Y-m-d H:i:s') . ': ' . substr($message, 0, 1000) . PHP_EOL, FILE_APPEND | LOCK_EX);
}

$registryFile = $dataDir . '/workspaces_auth.json';
$registry = is_file($registryFile) ? json_decode((string)@file_get_contents($registryFile), true) : null;
$adminSecret = is_array($registry) ? trim((string)($registry['admin_secret_key'] ?? '')) : '';
if ($adminSecret === '') {
    writeLog('Daily cleanup skipped: mother-portal server credential is not configured.');
    fwrite(STDERR, "Mother-portal server credential is not configured.\n");
    exit(1);
}

$url = trim((string)getenv('ASHK_BACKUP_API_URL'));
if ($url === '') $url = 'https://acc.ashkghalam.ir/backup-system.php';
if (!preg_match('#^https://[a-zA-Z0-9.-]+(?::[0-9]+)?/[^\s]*$#', $url)) {
    writeLog('Daily cleanup skipped: ASHK_BACKUP_API_URL must be a trusted HTTPS URL.');
    fwrite(STDERR, "Invalid backup API URL.\n");
    exit(1);
}

writeLog('Starting authenticated daily backup cleanup.');
$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL => $url,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => http_build_query(['action' => 'daily_cleanup']),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/x-www-form-urlencoded',
        'X-Workspace-ID: default',
        'X-Workspace-Token: ' . $adminSecret
    ],
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2
]);

$response = curl_exec($ch);
$httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if (!is_string($response)) {
    writeLog('Daily cleanup failed: HTTPS request error: ' . substr($curlError, 0, 300));
    fwrite(STDERR, "Daily cleanup HTTPS request failed.\n");
    exit(1);
}
if ($httpCode !== 200) {
    writeLog('Daily cleanup failed with HTTP ' . $httpCode . ': ' . substr($response, 0, 500));
    fwrite(STDERR, "Daily cleanup API returned HTTP {$httpCode}.\n");
    exit(1);
}

$result = json_decode($response, true);
if (!is_array($result) || empty($result['success'])) {
    writeLog('Daily cleanup failed: API did not confirm success.');
    fwrite(STDERR, "Daily cleanup API did not confirm success.\n");
    exit(1);
}
writeLog('Daily cleanup completed successfully; cleaned=' . (int)($result['cleaned'] ?? 0));
echo "Daily cleanup completed successfully.\n";
