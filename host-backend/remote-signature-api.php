<?php
/**
 * Remote signature API.
 * Management actions require a licensed workspace. External signers may only
 * access a request by its high-entropy signature link, and OTP workflows issue
 * a short-lived one-time session before signing or rejecting.
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Workspace-ID, X-Workspace-Token, X-Device-HWID');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

define('SIGNATURE_DIR', __DIR__ . '/signatures/');
define('SIGNATURE_REQUESTS_FILE', SIGNATURE_DIR . 'requests.json');
define('SIGNATURES_FILE', SIGNATURE_DIR . 'signatures.json');
define('AUTH_LOGS_FILE', SIGNATURE_DIR . 'auth_logs.json');
define('OTP_CODES_FILE', SIGNATURE_DIR . 'otp_codes.json');

if (!is_dir(SIGNATURE_DIR) && !@mkdir(SIGNATURE_DIR, 0700, true) && !is_dir(SIGNATURE_DIR)) {
    http_response_code(503);
    echo json_encode(['success' => false, 'error' => 'SIGNATURE_STORAGE_UNAVAILABLE']);
    exit;
}
@chmod(SIGNATURE_DIR, 0700);
$denyRules = SIGNATURE_DIR . '.htaccess';
if (!is_file($denyRules)) {
    @file_put_contents($denyRules, "Require all denied\nDeny from all\nOptions -Indexes\n", LOCK_EX);
}

function signatureRespond(int $status, array $payload): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function loadJSON(string $file): array {
    if (!is_file($file) || !is_readable($file)) return [];
    $content = @file_get_contents($file);
    if (!is_string($content) || $content === '') return [];
    $decoded = json_decode($content, true);
    return is_array($decoded) ? $decoded : [];
}

function saveJSON(string $file, array $data): bool {
    $dir = dirname($file);
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) return false;
    $lock = @fopen($file . '.lock', 'c');
    if ($lock === false || !flock($lock, LOCK_EX)) {
        if (is_resource($lock)) fclose($lock);
        return false;
    }
    $temp = $file . '.tmp.' . bin2hex(random_bytes(6));
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $ok = is_string($json) && @file_put_contents($temp, $json, LOCK_EX) !== false;
    if ($ok) {
        @chmod($temp, 0600);
        $ok = @rename($temp, $file);
    }
    if (!$ok && file_exists($temp)) @unlink($temp);
    flock($lock, LOCK_UN);
    fclose($lock);
    return $ok;
}

function getHeaderValue(string $wanted): string {
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    if (is_array($headers)) {
        foreach ($headers as $name => $value) {
            if (strcasecmp((string)$name, $wanted) === 0) return trim((string)$value);
        }
    }
    $serverKey = 'HTTP_' . strtoupper(str_replace('-', '_', $wanted));
    return trim((string)($_SERVER[$serverKey] ?? ''));
}

function getWorkspaceAuth(): array {
    $workspaceId = getHeaderValue('X-Workspace-ID');
    $token = getHeaderValue('X-Workspace-Token');
    $hwid = getHeaderValue('X-Device-HWID');
    if ($workspaceId === '' || $token === '') {
        return ['allowed' => false, 'status' => 'AUTH_REQUIRED'];
    }
    require_once __DIR__ . '/license_validator.php';
    $isMother = in_array($workspaceId, ['default', 'main'], true);
    $access = LicenseValidator::validateAccess($workspaceId, $token, $isMother ? null : $hwid);
    if (empty($access['allowed'])) {
        return ['allowed' => false, 'status' => $access['status'] ?? 'ACCESS_DENIED'];
    }
    return [
        'allowed' => true,
        'workspace_id' => $workspaceId,
        'is_mother_admin' => $isMother && (($access['role'] ?? '') === 'SUPER_ADMIN'),
        'role' => $access['role'] ?? ''
    ];
}

function getClientIP(): string {
    // REMOTE_ADDR is used intentionally; forwarding headers are caller-controlled unless
    // the hosting proxy is explicitly configured to replace them.
    return (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
}

function appendAuthLog(string $requestId, string $workspaceId, string $method, bool $success): void {
    $logs = loadJSON(AUTH_LOGS_FILE);
    $logs[] = [
        'id' => bin2hex(random_bytes(12)),
        'requestId' => $requestId,
        'workspace_id' => $workspaceId,
        'method' => $method,
        'success' => $success,
        'attemptedAt' => date(DATE_ATOM),
        'ipAddress' => getClientIP(),
        'userAgent' => substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 240)
    ];
    if (!saveJSON(AUTH_LOGS_FILE, $logs)) {
        error_log('Remote signature: failed to persist authentication log');
    }
}

function findRequestIndex(array $requests, string $requestId): int {
    foreach ($requests as $index => $request) {
        if (is_array($request) && isset($request['id']) &&
            hash_equals((string)$request['id'], $requestId)) {
            return (int)$index;
        }
    }
    return -1;
}

function findRequestByToken(array $requests, string $token): int {
    if ($token === '') return -1;
    foreach ($requests as $index => $request) {
        $stored = is_array($request) ? (string)($request['signatureToken'] ?? '') : '';
        if ($stored !== '' && hash_equals($stored, $token)) return (int)$index;
    }
    return -1;
}

function requestIsVisibleToWorkspace(array $request, array $auth): bool {
    if (!empty($auth['is_mother_admin'])) return true;
    return isset($request['workspace_id']) &&
        hash_equals((string)$request['workspace_id'], (string)$auth['workspace_id']);
}

function expectedOtpMethod(array $request): string {
    $method = strtolower((string)($request['authMethod'] ?? 'otp_sms'));
    if (in_array($method, ['otp_email', 'email'], true)) return 'email';
    if (in_array($method, ['otp_sms', 'sms'], true)) return 'sms';
    return '';
}

function requestIsCurrent(array $request): bool {
    $status = strtolower((string)($request['status'] ?? 'pending'));
    if (!in_array($status, ['pending', 'sent'], true)) return false;
    $expiresAt = strtotime((string)($request['expiresAt'] ?? ''));
    return $expiresAt !== false && $expiresAt > time();
}

function signerTokenMatches(array $request, string $token): bool {
    $stored = (string)($request['signatureToken'] ?? '');
    return $stored !== '' && $token !== '' && hash_equals($stored, $token);
}

function consumeRateLimit(string $key, int $limit, int $windowSeconds): bool {
    $file = SIGNATURE_DIR . 'rate_limits.json';
    $lock = @fopen($file . '.rate-lock', 'c');
    if ($lock === false || !flock($lock, LOCK_EX)) {
        if (is_resource($lock)) fclose($lock);
        return false;
    }

    $records = loadJSON($file);
    $now = time();
    $hash = hash('sha256', $key);
    $times = array_values(array_filter(
        is_array($records[$hash] ?? null) ? $records[$hash] : [],
        static fn($t) => is_numeric($t) && (int)$t > $now - $windowSeconds
    ));
    if (count($times) >= $limit) {
        $records[$hash] = $times;
        $ok = saveJSON($file, $records);
        flock($lock, LOCK_UN);
        fclose($lock);
        return false;
    }

    $times[] = $now;
    $records[$hash] = $times;
    $ok = saveJSON($file, $records);
    flock($lock, LOCK_UN);
    fclose($lock);
    return $ok;
}

function signerProofValid(array $request, array $input, array $otpCodes): bool {
    $providedToken = (string)($input['signatureToken'] ?? ($input['data']['signatureToken'] ?? ''));
    if (!signerTokenMatches($request, $providedToken)) return false;

    $expected = expectedOtpMethod($request);
    if ($expected === '') return true; // Explicit link-only request: possession of the link is the proof.

    $sessionToken = (string)($input['sessionToken'] ?? ($input['data']['sessionToken'] ?? ''));
    if ($sessionToken === '') return false;
    $challenge = $otpCodes[(string)($request['id'] ?? '')] ?? [];
    $sessionHash = (string)($challenge['sessionTokenHash'] ?? '');
    $expires = (int)($challenge['sessionExpiresAt'] ?? 0);
    return $sessionHash !== '' && $expires > time() &&
        hash_equals($sessionHash, hash('sha256', $sessionToken));
}

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if (!in_array($method, ['GET', 'POST'], true)) {
    header('Allow: GET, POST, OPTIONS');
    signatureRespond(405, ['success' => false, 'error' => 'METHOD_NOT_ALLOWED']);
}
$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) $input = [];
$action = (string)($input['action'] ?? $_GET['action'] ?? '');

$managementActions = ['create_request', 'get_request', 'list_requests', 'verify_signature', 'get_report', 'log_auth'];
$auth = null;
if (in_array($action, $managementActions, true)) {
    $auth = getWorkspaceAuth();
    if (empty($auth['allowed'])) {
        signatureRespond(403, ['success' => false, 'error' => $auth['status'] ?? 'ACCESS_DENIED']);
    }
}

$requests = loadJSON(SIGNATURE_REQUESTS_FILE);

try {
    switch ($action) {
        case 'create_request': {
            if ($method !== 'POST') signatureRespond(405, ['success' => false, 'error' => 'METHOD_NOT_ALLOWED']);
            if (!consumeRateLimit('create:' . $auth['workspace_id'] . ':' . getClientIP(), 40, 3600)) {
                signatureRespond(429, ['success' => false, 'error' => 'RATE_LIMITED']);
            }
            $source = $input['data'] ?? null;
            if (!is_array($source)) signatureRespond(400, ['success' => false, 'error' => 'INVALID_REQUEST']);
            $fields = ['documentId', 'documentType', 'documentTitle', 'documentUrl', 'signerName', 'authMethod'];
            foreach ($fields as $field) {
                if (!isset($source[$field]) || !is_string($source[$field]) || trim($source[$field]) === '' || strlen($source[$field]) > 3000) {
                    signatureRespond(400, ['success' => false, 'error' => 'INVALID_FIELD', 'field' => $field]);
                }
            }
            $authMethod = strtolower(trim((string)$source['authMethod']));
            if (!in_array($authMethod, ['otp_sms', 'otp_email', 'link'], true)) {
                signatureRespond(400, ['success' => false, 'error' => 'INVALID_AUTH_METHOD']);
            }
            $phone = trim((string)($source['signerPhone'] ?? ''));
            $email = trim((string)($source['signerEmail'] ?? ''));
            if (($authMethod === 'otp_sms' && $phone === '') ||
                ($authMethod === 'otp_email' && !filter_var($email, FILTER_VALIDATE_EMAIL))) {
                signatureRespond(400, ['success' => false, 'error' => 'SIGNER_CONTACT_REQUIRED']);
            }
            if (preg_match('/^\s*(javascript|data):/i', (string)$source['documentUrl'])) {
                signatureRespond(400, ['success' => false, 'error' => 'INVALID_DOCUMENT_URL']);
            }

            $request = [
                'id' => bin2hex(random_bytes(16)),
                'documentId' => trim($source['documentId']),
                'documentType' => trim($source['documentType']),
                'documentTitle' => trim($source['documentTitle']),
                'documentUrl' => trim($source['documentUrl']),
                'signerName' => trim((string)$source['signerName']),
                'signerNationalId' => substr(trim((string)($source['signerNationalId'] ?? '')), 0, 40),
                'signerPhone' => substr($phone, 0, 80),
                'signerEmail' => substr($email, 0, 254),
                'authMethod' => $authMethod,
                'requesterName' => substr(trim((string)($source['requesterName'] ?? 'کاربر')), 0, 160),
                'requesterUserId' => substr(trim((string)($source['requesterUserId'] ?? '')), 0, 120),
                'workspace_id' => $auth['workspace_id'],
                'status' => 'pending',
                'signatureToken' => bin2hex(random_bytes(32)),
                'expiresAt' => date(DATE_ATOM, time() + 48 * 3600),
                'createdAt' => date(DATE_ATOM)
            ];
            $requests[] = $request;
            if (!saveJSON(SIGNATURE_REQUESTS_FILE, $requests)) {
                signatureRespond(500, ['success' => false, 'error' => 'REQUEST_SAVE_FAILED']);
            }
            signatureRespond(201, ['success' => true, 'data' => $request]);
        }

        case 'get_by_token': {
            $token = trim((string)($_GET['token'] ?? $input['token'] ?? ''));
            $index = findRequestByToken($requests, $token);
            if ($index < 0) signatureRespond(404, ['success' => false, 'error' => 'REQUEST_NOT_FOUND']);
            $request = $requests[$index];
            if (!requestIsCurrent($request) && !in_array(strtolower((string)($request['status'] ?? '')), ['signed', 'rejected', 'expired'], true)) {
                $request['status'] = 'expired';
            }
            if (strtotime((string)($request['expiresAt'] ?? '')) <= time() &&
                !in_array(strtolower((string)($request['status'] ?? '')), ['signed', 'rejected'], true)) {
                $request['status'] = 'expired';
                $requests[$index] = $request;
                saveJSON(SIGNATURE_REQUESTS_FILE, $requests);
            }
            // A public link returns only the information needed by its recipient.
            $publicRequest = array_intersect_key($request, array_flip([
                'id', 'documentId', 'documentType', 'documentTitle', 'documentUrl',
                'signerName', 'signerPhone', 'signerEmail', 'authMethod',
                'signatureToken', 'status', 'expiresAt', 'createdAt'
            ]));
            signatureRespond(200, ['success' => true, 'data' => $publicRequest]);
        }

        case 'send_otp': {
            if ($method !== 'POST') signatureRespond(405, ['success' => false, 'error' => 'METHOD_NOT_ALLOWED']);
            $requestId = trim((string)($input['requestId'] ?? ''));
            $providedToken = trim((string)($input['signatureToken'] ?? ''));
            $otpMethod = strtolower(trim((string)($input['method'] ?? '')));
            $index = findRequestIndex($requests, $requestId);
            if ($index < 0) signatureRespond(404, ['success' => false, 'error' => 'REQUEST_NOT_FOUND']);
            $request = $requests[$index];
            if (!signerTokenMatches($request, $providedToken) || !requestIsCurrent($request)) {
                signatureRespond(403, ['success' => false, 'error' => 'SIGNATURE_LINK_INVALID_OR_EXPIRED']);
            }
            $expectedMethod = expectedOtpMethod($request);
            if ($expectedMethod === '' || $otpMethod !== $expectedMethod) {
                signatureRespond(400, ['success' => false, 'error' => 'AUTH_METHOD_MISMATCH']);
            }
            $ip = getClientIP();
            if (!consumeRateLimit('otp-request:' . $requestId . ':' . $ip, 3, 900) ||
                !consumeRateLimit('otp-ip:' . $ip, 12, 3600)) {
                signatureRespond(429, ['success' => false, 'error' => 'OTP_RATE_LIMITED']);
            }
            $otp = (string)random_int(0, 999999);
            $otp = str_pad($otp, 6, '0', STR_PAD_LEFT);
            $otpCodes = loadJSON(OTP_CODES_FILE);
            $otpCodes[$requestId] = [
                'requestId' => $requestId,
                'workspace_id' => (string)($request['workspace_id'] ?? ''),
                'codeHash' => password_hash($otp, PASSWORD_DEFAULT),
                'attempts' => 0,
                'expiresAt' => time() + 600
            ];
            if (!saveJSON(OTP_CODES_FILE, $otpCodes)) {
                signatureRespond(500, ['success' => false, 'error' => 'OTP_SAVE_FAILED']);
            }

            $sent = false;
            if ($otpMethod === 'sms') {
                require_once __DIR__ . '/sms-helper.php';
                $sent = SMSHelper::sendSMS($request['signerPhone'], 'کد تأیید امضای دیجیتال: ' . $otp . "\nاعتبار: ۱۰ دقیقه", $otp);
            } else {
                $sent = mail($request['signerEmail'], 'کد تأیید امضای دیجیتال', 'کد تأیید شما: ' . $otp . "\nاعتبار: ۱۰ دقیقه");
            }
            if (!$sent) {
                unset($otpCodes[$requestId]);
                saveJSON(OTP_CODES_FILE, $otpCodes);
                signatureRespond(502, ['success' => false, 'error' => 'OTP_DELIVERY_FAILED']);
            }
            signatureRespond(200, ['success' => true, 'message' => 'کد تأیید ارسال شد', 'expiresIn' => 600]);
        }

        case 'verify_otp': {
            if ($method !== 'POST') signatureRespond(405, ['success' => false, 'error' => 'METHOD_NOT_ALLOWED']);
            $requestId = trim((string)($input['requestId'] ?? ''));
            $providedToken = trim((string)($input['signatureToken'] ?? ''));
            $otp = trim((string)($input['otpCode'] ?? ''));
            $index = findRequestIndex($requests, $requestId);
            if ($index < 0) signatureRespond(404, ['success' => false, 'error' => 'REQUEST_NOT_FOUND']);
            $request = $requests[$index];
            if (!signerTokenMatches($request, $providedToken) || !requestIsCurrent($request) ||
                expectedOtpMethod($request) === '') {
                appendAuthLog($requestId, (string)($request['workspace_id'] ?? ''), expectedOtpMethod($request), false);
                signatureRespond(403, ['success' => false, 'error' => 'SIGNATURE_LINK_INVALID_OR_EXPIRED']);
            }
            if (!consumeRateLimit('otp-verify:' . $requestId . ':' . getClientIP(), 10, 600)) {
                signatureRespond(429, ['success' => false, 'error' => 'OTP_RATE_LIMITED']);
            }
            $otpCodes = loadJSON(OTP_CODES_FILE);
            $challenge = $otpCodes[$requestId] ?? [];
            if (!is_array($challenge) || empty($challenge['codeHash']) ||
                (int)($challenge['expiresAt'] ?? 0) <= time() ||
                (int)($challenge['attempts'] ?? 0) >= 3) {
                appendAuthLog($requestId, (string)($request['workspace_id'] ?? ''), expectedOtpMethod($request), false);
                signatureRespond(401, ['success' => false, 'error' => 'OTP_INVALID_OR_EXPIRED']);
            }
            if ($otp === '' || !password_verify($otp, (string)$challenge['codeHash'])) {
                $challenge['attempts'] = (int)($challenge['attempts'] ?? 0) + 1;
                $otpCodes[$requestId] = $challenge;
                saveJSON(OTP_CODES_FILE, $otpCodes);
                appendAuthLog($requestId, (string)($request['workspace_id'] ?? ''), expectedOtpMethod($request), false);
                signatureRespond(401, ['success' => false, 'error' => 'OTP_INVALID_OR_EXPIRED']);
            }
            $sessionToken = bin2hex(random_bytes(32));
            unset($challenge['codeHash']);
            $challenge['sessionTokenHash'] = hash('sha256', $sessionToken);
            $challenge['sessionExpiresAt'] = time() + 3600;
            $challenge['verifiedAt'] = time();
            $otpCodes[$requestId] = $challenge;
            if (!saveJSON(OTP_CODES_FILE, $otpCodes)) {
                signatureRespond(500, ['success' => false, 'error' => 'SESSION_SAVE_FAILED']);
            }
            appendAuthLog($requestId, (string)($request['workspace_id'] ?? ''), expectedOtpMethod($request), true);
            signatureRespond(200, ['success' => true, 'message' => 'کد تأیید شد', 'sessionToken' => $sessionToken]);
        }

        case 'sign_document': {
            if ($method !== 'POST') signatureRespond(405, ['success' => false, 'error' => 'METHOD_NOT_ALLOWED']);
            $source = $input['data'] ?? [];
            if (!is_array($source)) signatureRespond(400, ['success' => false, 'error' => 'INVALID_SIGNATURE']);
            $requestId = trim((string)($source['requestId'] ?? $input['requestId'] ?? ''));
            $index = findRequestIndex($requests, $requestId);
            if ($index < 0) signatureRespond(404, ['success' => false, 'error' => 'REQUEST_NOT_FOUND']);
            $request = $requests[$index];
            if (!requestIsCurrent($request)) signatureRespond(409, ['success' => false, 'error' => 'REQUEST_NOT_PENDING_OR_EXPIRED']);
            if (!signerProofValid($request, $input, loadJSON(OTP_CODES_FILE))) {
                signatureRespond(403, ['success' => false, 'error' => 'SIGNER_VERIFICATION_REQUIRED']);
            }
            $signatureData = (string)($source['signatureData'] ?? '');
            if ($signatureData === '' || strlen($signatureData) > 2_000_000) {
                signatureRespond(400, ['success' => false, 'error' => 'INVALID_SIGNATURE_DATA']);
            }
            $signatures = loadJSON(SIGNATURES_FILE);
            foreach ($signatures as $existing) {
                if (is_array($existing) && (string)($existing['requestId'] ?? '') === $requestId) {
                    signatureRespond(409, ['success' => false, 'error' => 'ALREADY_SIGNED']);
                }
            }
            $signature = [
                'id' => bin2hex(random_bytes(16)),
                'requestId' => $requestId,
                'workspace_id' => (string)($request['workspace_id'] ?? ''),
                'signatureData' => $signatureData,
                'signatureImage' => substr((string)($source['signatureImage'] ?? ''), 0, 1_500_000),
                'signerName' => (string)($request['signerName'] ?? ''),
                'signerNationalId' => (string)($request['signerNationalId'] ?? ''),
                'signedAt' => date(DATE_ATOM),
                'ipAddress' => getClientIP(),
                'userAgent' => substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 240),
                'certificateHash' => substr((string)($source['certificateHash'] ?? ''), 0, 200),
                'documentHash' => substr((string)($source['documentHash'] ?? ''), 0, 200)
            ];
            $signatures[] = $signature;
            $request['status'] = 'signed';
            $request['signedAt'] = $signature['signedAt'];
            $requests[$index] = $request;
            if (!saveJSON(SIGNATURES_FILE, $signatures) || !saveJSON(SIGNATURE_REQUESTS_FILE, $requests)) {
                signatureRespond(500, ['success' => false, 'error' => 'SIGNATURE_SAVE_FAILED']);
            }
            $otpCodes = loadJSON(OTP_CODES_FILE);
            unset($otpCodes[$requestId]);
            saveJSON(OTP_CODES_FILE, $otpCodes);
            signatureRespond(200, ['success' => true, 'data' => $signature]);
        }

        case 'reject_signature': {
            if ($method !== 'POST') signatureRespond(405, ['success' => false, 'error' => 'METHOD_NOT_ALLOWED']);
            $requestId = trim((string)($input['requestId'] ?? ''));
            $index = findRequestIndex($requests, $requestId);
            if ($index < 0) signatureRespond(404, ['success' => false, 'error' => 'REQUEST_NOT_FOUND']);
            $request = $requests[$index];
            if (!requestIsCurrent($request)) signatureRespond(409, ['success' => false, 'error' => 'REQUEST_NOT_PENDING_OR_EXPIRED']);
            if (!signerProofValid($request, $input, loadJSON(OTP_CODES_FILE))) {
                signatureRespond(403, ['success' => false, 'error' => 'SIGNER_VERIFICATION_REQUIRED']);
            }
            $reason = trim((string)($input['reason'] ?? ''));
            if ($reason === '' || strlen($reason) > 2000) signatureRespond(400, ['success' => false, 'error' => 'INVALID_REJECTION_REASON']);
            $request['status'] = 'rejected';
            $request['rejectedAt'] = date(DATE_ATOM);
            $request['rejectionReason'] = $reason;
            $requests[$index] = $request;
            if (!saveJSON(SIGNATURE_REQUESTS_FILE, $requests)) {
                signatureRespond(500, ['success' => false, 'error' => 'REQUEST_SAVE_FAILED']);
            }
            $otpCodes = loadJSON(OTP_CODES_FILE);
            unset($otpCodes[$requestId]);
            saveJSON(OTP_CODES_FILE, $otpCodes);
            signatureRespond(200, ['success' => true]);
        }

        case 'get_request': {
            $id = trim((string)($_GET['id'] ?? ''));
            $index = findRequestIndex($requests, $id);
            if ($index < 0 || !requestIsVisibleToWorkspace($requests[$index], $auth)) {
                signatureRespond(404, ['success' => false, 'error' => 'REQUEST_NOT_FOUND']);
            }
            signatureRespond(200, ['success' => true, 'data' => $requests[$index]]);
        }

        case 'list_requests': {
            $visible = array_values(array_filter($requests, static fn($request) =>
                is_array($request) && requestIsVisibleToWorkspace($request, $auth)
            ));
            if (isset($_GET['status'])) {
                $status = strtolower(trim((string)$_GET['status']));
                $visible = array_values(array_filter($visible, static fn($request) =>
                    strtolower((string)($request['status'] ?? '')) === $status
                ));
            }
            if (isset($_GET['documentType'])) {
                $type = trim((string)$_GET['documentType']);
                $visible = array_values(array_filter($visible, static fn($request) =>
                    (string)($request['documentType'] ?? '') === $type
                ));
            }
            if (isset($_GET['fromDate'])) {
                $visible = array_values(array_filter($visible, static fn($request) =>
                    (string)($request['createdAt'] ?? '') >= (string)$_GET['fromDate']
                ));
            }
            if (isset($_GET['toDate'])) {
                $visible = array_values(array_filter($visible, static fn($request) =>
                    (string)($request['createdAt'] ?? '') <= (string)$_GET['toDate']
                ));
            }
            usort($visible, static fn($a, $b) =>
                strcmp((string)($b['createdAt'] ?? ''), (string)($a['createdAt'] ?? ''))
            );
            signatureRespond(200, ['success' => true, 'data' => $visible]);
        }

        case 'verify_signature': {
            $id = trim((string)($_GET['id'] ?? ''));
            $signatures = loadJSON(SIGNATURES_FILE);
            foreach ($signatures as $signature) {
                if (!is_array($signature) || (string)($signature['id'] ?? '') !== $id) continue;
                $requestIndex = findRequestIndex($requests, (string)($signature['requestId'] ?? ''));
                if ($requestIndex < 0 || !requestIsVisibleToWorkspace($requests[$requestIndex], $auth)) {
                    signatureRespond(404, ['success' => false, 'error' => 'SIGNATURE_NOT_FOUND']);
                }
                signatureRespond(200, ['success' => true, 'data' => [
                    'isValid' => strtolower((string)($requests[$requestIndex]['status'] ?? '')) === 'signed',
                    'signedAt' => $signature['signedAt'] ?? null,
                    'signerName' => $signature['signerName'] ?? '',
                    'signerNationalId' => $signature['signerNationalId'] ?? '',
                    'documentHash' => $signature['documentHash'] ?? '',
                    'certificateHash' => $signature['certificateHash'] ?? '',
                    'verifiedAt' => date(DATE_ATOM)
                ]]);
            }
            signatureRespond(404, ['success' => false, 'error' => 'SIGNATURE_NOT_FOUND']);
        }

        case 'get_report': {
            $visible = array_values(array_filter($requests, static fn($request) =>
                is_array($request) && requestIsVisibleToWorkspace($request, $auth)
            ));
            $report = [
                'totalRequests' => count($visible),
                'pendingRequests' => count(array_filter($visible, static fn($r) => strtolower((string)($r['status'] ?? '')) === 'pending')),
                'signedRequests' => count(array_filter($visible, static fn($r) => strtolower((string)($r['status'] ?? '')) === 'signed')),
                'rejectedRequests' => count(array_filter($visible, static fn($r) => strtolower((string)($r['status'] ?? '')) === 'rejected')),
                'expiredRequests' => count(array_filter($visible, static fn($r) => strtolower((string)($r['status'] ?? '')) === 'expired')),
                'requestsByType' => [],
                'recentActivity' => array_slice(array_reverse($visible), 0, 10)
            ];
            foreach ($visible as $request) {
                $type = (string)($request['documentType'] ?? 'unknown');
                $report['requestsByType'][$type] = ($report['requestsByType'][$type] ?? 0) + 1;
            }
            signatureRespond(200, ['success' => true, 'data' => $report]);
        }

        case 'log_auth': {
            if ($method !== 'POST') signatureRespond(405, ['success' => false, 'error' => 'METHOD_NOT_ALLOWED']);
            $data = $input['data'] ?? [];
            $requestId = trim((string)($data['requestId'] ?? ''));
            $index = findRequestIndex($requests, $requestId);
            if ($index < 0 || !requestIsVisibleToWorkspace($requests[$index], $auth)) {
                signatureRespond(404, ['success' => false, 'error' => 'REQUEST_NOT_FOUND']);
            }
            appendAuthLog($requestId, (string)$auth['workspace_id'], substr((string)($data['method'] ?? 'unknown'), 0, 40), !empty($data['success']));
            signatureRespond(200, ['success' => true]);
        }

        default:
            signatureRespond(400, ['success' => false, 'error' => 'INVALID_ACTION']);
    }
} catch (Throwable $e) {
    error_log('Remote signature API error: ' . $e->getMessage());
    signatureRespond(500, ['success' => false, 'error' => 'INTERNAL_ERROR']);
}
