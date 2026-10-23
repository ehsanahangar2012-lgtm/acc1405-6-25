<?php
/**
 * First-party password recovery mail endpoint.
 * Requires an explicitly configured workspace credential, an existing active
 * account with a matching saved e-mail, and server-side rate limits.
 */
error_reporting(E_ALL);
ini_set('display_errors', '0');

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Workspace-ID, X-Workspace-Token');

function recoveryRespond($status, $payload) {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST, OPTIONS');
    recoveryRespond(405, ['success' => false, 'error' => 'METHOD_NOT_ALLOWED']);
}

$rawBody = file_get_contents('php://input');
if (!is_string($rawBody) || strlen($rawBody) > 16384) {
    recoveryRespond(413, ['success' => false, 'error' => 'REQUEST_TOO_LARGE']);
}
$data = json_decode($rawBody, true);
if (!is_array($data)) {
    recoveryRespond(400, ['success' => false, 'error' => 'INVALID_REQUEST']);
}

$headers = function_exists('getallheaders') ? getallheaders() : [];
$workspaceHeader = '';
$tokenHeader = '';
foreach ($headers as $name => $value) {
    if (strcasecmp($name, 'X-Workspace-ID') === 0) $workspaceHeader = (string)$value;
    if (strcasecmp($name, 'X-Workspace-Token') === 0) $tokenHeader = (string)$value;
}
$workspaceId = trim($workspaceHeader);
$token = trim($tokenHeader);
if ($workspaceId === '' || !preg_match('/^[a-zA-Z0-9_-]{1,80}$/', $workspaceId) || $token === '') {
    recoveryRespond(401, ['success' => false, 'error' => 'RECOVERY_NOT_CONFIGURED']);
}

$configFile = __DIR__ . '/data/workspaces_auth.json';
if (!is_file($configFile) || !is_readable($configFile)) {
    recoveryRespond(503, ['success' => false, 'error' => 'RECOVERY_NOT_CONFIGURED']);
}
$config = json_decode((string)file_get_contents($configFile), true);
if (!is_array($config)) {
    recoveryRespond(503, ['success' => false, 'error' => 'RECOVERY_NOT_CONFIGURED']);
}

$workspace = null;
if ($workspaceId === 'default' || $workspaceId === 'main') {
    // The general LicenseValidator intentionally bypasses the default workspace.
    // Password recovery must not inherit that bypass: a host admin must set
    // recovery_api_token in workspaces_auth.json or ASHK_RECOVERY_API_TOKEN
    // in the server environment. Do not put this secret in the repository.
    $expectedToken = trim((string)($config['recovery_api_token'] ?? ''));
    if ($expectedToken === '') {
        $environmentToken = getenv('ASHK_RECOVERY_API_TOKEN');
        $expectedToken = is_string($environmentToken) ? trim($environmentToken) : '';
    }
    if ($expectedToken === '' || !hash_equals($expectedToken, $token)) {
        recoveryRespond(401, ['success' => false, 'error' => 'RECOVERY_NOT_CONFIGURED']);
    }
} else {
    // Do not auto-register tenants for a password-recovery request.
    $workspace = $config['workspaces'][$workspaceId] ?? null;
    if (!is_array($workspace) ||
        ($workspace['status'] ?? 'ACTIVE') !== 'ACTIVE' ||
        empty($workspace['token']) ||
        !hash_equals((string)$workspace['token'], $token)) {
        recoveryRespond(401, ['success' => false, 'error' => 'RECOVERY_NOT_CONFIGURED']);
    }
    if (empty($workspace['is_unlimited']) && !empty($workspace['expire_date']) &&
        date('Y-m-d') > (string)$workspace['expire_date']) {
        recoveryRespond(403, ['success' => false, 'error' => 'WORKSPACE_EXPIRED']);
    }
}

$ip = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
function recoveryRateLimit($key, $limit, $windowSeconds) {
    $dir = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'ashk-recovery-rate-limit';
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) return false;
    $file = $dir . DIRECTORY_SEPARATOR . hash('sha256', (string)$key) . '.json';
    $handle = @fopen($file, 'c+');
    if (!$handle) return false;
    if (!flock($handle, LOCK_EX)) {
        fclose($handle);
        return false;
    }
    $contents = stream_get_contents($handle);
    $events = json_decode(is_string($contents) ? $contents : '', true);
    if (!is_array($events)) $events = [];
    $now = time();
    $events = array_values(array_filter($events, function($timestamp) use ($now, $windowSeconds) {
        return is_numeric($timestamp) && (int)$timestamp > ($now - $windowSeconds);
    }));
    if (count($events) >= $limit) {
        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, json_encode($events));
        fflush($handle);
        flock($handle, LOCK_UN);
        fclose($handle);
        return false;
    }
    $events[] = $now;
    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, json_encode($events));
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
    return true;
}

if (!recoveryRateLimit('ip:' . $ip, 20, 900)) {
    header('Retry-After: 900');
    recoveryRespond(429, ['success' => false, 'error' => 'RATE_LIMITED']);
}

$emailInput = trim((string)($data['email'] ?? ''));
$usernameInput = trim((string)($data['username'] ?? ''));
$otpCode = trim((string)($data['otpCode'] ?? ''));
if (!filter_var($emailInput, FILTER_VALIDATE_EMAIL) ||
    !preg_match('/^[a-zA-Z0-9_.@+-]{1,120}$/', $usernameInput) ||
    !preg_match('/^[0-9]{6}$/', $otpCode)) {
    recoveryRespond(400, ['success' => false, 'error' => 'INVALID_RECOVERY_REQUEST']);
}

// Resolve the active user's e-mail from the server-side workspace data.
// A client cannot provide an arbitrary recipient or a made-up account name.
$dataDir = __DIR__ . '/data';
if ($workspaceId !== 'default' && $workspaceId !== 'main') {
    $dataDir .= '/tenants/' . $workspaceId;
}
$usersFile = $dataDir . '/users.json';
if (!is_file($usersFile) || !is_readable($usersFile)) {
    recoveryRespond(503, ['success' => false, 'error' => 'RECOVERY_NOT_CONFIGURED']);
}
$users = json_decode((string)file_get_contents($usersFile), true);
if (is_string($users)) $users = json_decode($users, true);
if (isset($users['state']['users']) && is_array($users['state']['users'])) $users = $users['state']['users'];
elseif (isset($users['users']) && is_array($users['users'])) $users = $users['users'];
if (!is_array($users)) {
    recoveryRespond(503, ['success' => false, 'error' => 'RECOVERY_NOT_CONFIGURED']);
}

$account = null;
foreach ($users as $candidate) {
    if (!is_array($candidate) || ($candidate['is_active'] ?? true) === false) continue;
    $candidateName = strtolower(trim((string)($candidate['username'] ?? '')));
    if ($candidateName === strtolower($usernameInput)) {
        $savedEmail = trim((string)($candidate['email'] ?? ''));
        if ($savedEmail !== '' && strcasecmp($savedEmail, $emailInput) === 0 &&
            filter_var($savedEmail, FILTER_VALIDATE_EMAIL)) {
            $account = $candidate;
            $emailInput = $savedEmail;
            break;
        }
    }
}
if (!$account) {
    recoveryRespond(400, ['success' => false, 'error' => 'INVALID_RECOVERY_REQUEST']);
}

$rateKey = 'account:' . $workspaceId . ':' . strtolower($usernameInput) . ':' . strtolower($emailInput);
if (!recoveryRateLimit($rateKey, 3, 3600)) {
    header('Retry-After: 3600');
    recoveryRespond(429, ['success' => false, 'error' => 'RATE_LIMITED']);
}

$fullName = trim((string)($account['fullName'] ?? $account['full_name'] ?? $usernameInput));
$fullName = preg_replace('/[\r\n\x00-\x1F\x7F]+/', ' ', $fullName);
$username = preg_replace('/[^a-zA-Z0-9_.@+-]/', '', (string)($account['username'] ?? $usernameInput));

// Do not trust a client-supplied host name in mail headers.
$mailHost = preg_replace('/[^a-zA-Z0-9.-]/', '', (string)($_SERVER['SERVER_NAME'] ?? ''));
if ($mailHost === '' || strpos($mailHost, '.') === false) $mailHost = 'ashkghalam.ir';
$fromEmail = 'admin@' . $mailHost;
$subject = 'کد اعتبارسنجی بازیابی رمز عبور اشک قلم';
$message = "کاربر گرامی {$fullName},\n\n";
$message .= "درخواست بازیابی رمز عبور برای حساب کاربری شما ({$username}) ثبت شده است.\n\n";
$message .= "کد اعتبارسنجی شش‌رقمی شما:\n{$otpCode}\n\n";
$message .= "این کد را با هیچ‌کس به اشتراک نگذارید. اگر شما درخواست نداده‌اید، این پیام را نادیده بگیرید.\n\n";
$message .= "سامانه اشک قلم";

$mailHeaders = "From: =?UTF-8?B?" . base64_encode('اشک قلم') . "?= <{$fromEmail}>\r\n";
$mailHeaders .= "Reply-To: {$fromEmail}\r\n";
$mailHeaders .= "Content-Type: text/plain; charset=UTF-8\r\n";
$mailHeaders .= "X-Mailer: AshkeGhalam Recovery";

$errorMsg = null;
set_error_handler(function($errno, $errstr) use (&$errorMsg) {
    $errorMsg = $errstr;
    return true;
});
try {
    $sent = mail($emailInput, $subject, $message, $mailHeaders);
} catch (Throwable $error) {
    $sent = false;
    $errorMsg = $error->getMessage();
}
restore_error_handler();

if ($sent) {
    recoveryRespond(200, ['success' => true, 'message' => 'اگر اطلاعات بازیابی معتبر باشد، پیام ارسال می‌شود.']);
}
error_log('[AshkeGhalam] Recovery mail send failed: ' . (string)($errorMsg ?: 'mail() returned false'));
recoveryRespond(503, ['success' => false, 'error' => 'RECOVERY_DELIVERY_FAILED']);
