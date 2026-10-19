<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Workspace-ID, X-Workspace-Token, X-Device-HWID');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    header('Allow: POST, OPTIONS');
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'METHOD_NOT_ALLOWED']);
    exit;
}

function geminiRespond(int $status, array $payload): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function geminiHeader(string $wanted): string {
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    if (is_array($headers)) {
        foreach ($headers as $name => $value) {
            if (strcasecmp((string)$name, $wanted) === 0) return trim((string)$value);
        }
    }
    $serverKey = 'HTTP_' . strtoupper(str_replace('-', '_', $wanted));
    return trim((string)($_SERVER[$serverKey] ?? ''));
}

$workspaceId = geminiHeader('X-Workspace-ID');
$workspaceToken = geminiHeader('X-Workspace-Token');
$hwid = geminiHeader('X-Device-HWID');
if ($workspaceId === '' || !preg_match('/^[a-zA-Z0-9_-]{1,80}$/', $workspaceId) || $workspaceToken === '') {
    geminiRespond(403, ['success' => false, 'error' => 'AUTH_REQUIRED']);
}
$validatorFile = __DIR__ . '/license_validator.php';
if (!is_file($validatorFile)) geminiRespond(503, ['success' => false, 'error' => 'AUTHORITY_UNAVAILABLE']);
require_once $validatorFile;
$isMotherWorkspace = in_array($workspaceId, ['default', 'main'], true);
$access = LicenseValidator::validateAccess($workspaceId, $workspaceToken, $isMotherWorkspace ? null : $hwid);
if (empty($access['allowed'])) {
    $status = ($access['status'] ?? '') === 'REGISTRY_UNAVAILABLE' ? 503 : 403;
    geminiRespond($status, ['success' => false, 'error' => $access['status'] ?? 'ACCESS_DENIED']);
}

// Server-side budget guard: cap each workspace/IP at 60 requests/hour. If the
// rate-limit store cannot be safely locked and written, fail closed.
$rateKey = hash('sha256', $workspaceId . '|' . (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
$rateFile = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'ashk-gemini-rate-' . $rateKey . '.json';
$rateLock = @fopen($rateFile . '.lock', 'c');
if ($rateLock === false || !flock($rateLock, LOCK_EX)) {
    if (is_resource($rateLock)) fclose($rateLock);
    geminiRespond(503, ['success' => false, 'error' => 'RATE_LIMIT_STORE_UNAVAILABLE']);
}
$times = [];
if (is_file($rateFile)) {
    $saved = json_decode((string)@file_get_contents($rateFile), true);
    if (is_array($saved)) $times = $saved;
}
$now = time();
$times = array_values(array_filter($times, static fn($time) => is_numeric($time) && (int)$time > $now - 3600));
if (count($times) >= 60) {
    flock($rateLock, LOCK_UN);
    fclose($rateLock);
    geminiRespond(429, ['success' => false, 'error' => 'RATE_LIMITED']);
}
$times[] = $now;
$tempFile = $rateFile . '.tmp.' . bin2hex(random_bytes(6));
$rateWritten = @file_put_contents($tempFile, json_encode($times), LOCK_EX);
if ($rateWritten === false) {
    if (file_exists($tempFile)) @unlink($tempFile);
    flock($rateLock, LOCK_UN);
    fclose($rateLock);
    geminiRespond(503, ['success' => false, 'error' => 'RATE_LIMIT_STORE_UNAVAILABLE']);
}
@chmod($tempFile, 0600);
if (!@rename($tempFile, $rateFile)) {
    @unlink($tempFile);
    flock($rateLock, LOCK_UN);
    fclose($rateLock);
    geminiRespond(503, ['success' => false, 'error' => 'RATE_LIMIT_STORE_UNAVAILABLE']);
}
flock($rateLock, LOCK_UN);
fclose($rateLock);

$geminiKey = trim((string)getenv('GEMINI_API_KEY'));
if ($geminiKey === '') {
    geminiRespond(503, ['success' => false, 'error' => 'AI_SERVICE_NOT_CONFIGURED']);
}
$rawInput = file_get_contents('php://input');
if (!is_string($rawInput) || trim($rawInput) === '' || strlen($rawInput) > 15_000_000) {
    geminiRespond(413, ['success' => false, 'error' => 'INVALID_OR_OVERSIZED_REQUEST']);
}
$decoded = json_decode($rawInput, true);
if (!is_array($decoded) || !is_array($decoded['contents'] ?? null) || count($decoded['contents']) === 0) {
    geminiRespond(400, ['success' => false, 'error' => 'INVALID_REQUEST_BODY']);
}

$url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=' . rawurlencode($geminiKey);
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $rawInput,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_TIMEOUT => 45
]);
$response = curl_exec($ch);
$httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);
if (!is_string($response)) {
    error_log('Gemini upstream request failed: ' . substr($curlError, 0, 300));
    geminiRespond(502, ['success' => false, 'error' => 'AI_UPSTREAM_UNAVAILABLE']);
}
if ($httpCode < 200 || $httpCode >= 300) {
    error_log('Gemini upstream returned HTTP ' . $httpCode);
    geminiRespond($httpCode >= 400 && $httpCode < 500 ? 502 : 502, ['success' => false, 'error' => 'AI_UPSTREAM_REJECTED_REQUEST']);
}
http_response_code(200);
echo $response;
