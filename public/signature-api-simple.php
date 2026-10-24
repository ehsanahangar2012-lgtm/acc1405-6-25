<?php
// Link-based public signing API. Request creation is tenant-authenticated; public
// reading/signing is possible only with the exact high-entropy request capability.
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

function simpleSignatureRespond(int $status, array $body): void {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function simpleSignatureHeader(string $wanted): string {
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    if (is_array($headers)) {
        foreach ($headers as $name => $value) {
            if (strcasecmp((string)$name, $wanted) === 0) return trim((string)$value);
        }
    }
    $serverKey = 'HTTP_' . strtoupper(str_replace('-', '_', $wanted));
    return trim((string)($_SERVER[$serverKey] ?? ''));
}

function simpleSignatureWorkspaceAuth(): array {
    $workspaceId = simpleSignatureHeader('X-Workspace-ID');
    $token = simpleSignatureHeader('X-Workspace-Token');
    $hwid = simpleSignatureHeader('X-Device-HWID');
    if ($workspaceId === '' || $token === '' ||
        !preg_match('/^[a-zA-Z0-9_-]{1,80}$/', $workspaceId)) {
        return ['allowed' => false, 'status' => 'AUTH_REQUIRED'];
    }
    require_once __DIR__ . '/license_validator.php';
    $isMother = in_array($workspaceId, ['default', 'main'], true);
    $access = LicenseValidator::validateAccess($workspaceId, $token, $isMother ? null : $hwid);
    if (empty($access['allowed'])) {
        return ['allowed' => false, 'status' => $access['status'] ?? 'ACCESS_DENIED'];
    }
    return ['allowed' => true, 'workspace_id' => $workspaceId, 'role' => $access['role'] ?? 'TENANT'];
}

function simpleSignatureUuid(string $token): string {
    $parts = explode('~', $token, 2);
    $uuid = $parts[0] ?? '';
    if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $uuid)) {
        return '';
    }
    if (isset($parts[1]) && ($parts[1] === '' || strlen($parts[1]) > 32000 ||
        !preg_match('/^[A-Za-z0-9_-]+$/', $parts[1]))) {
        return '';
    }
    return $uuid;
}

function simpleSignatureLoad(string $path): ?array {
    if (!is_file($path) || !is_readable($path)) return null;
    $bytes = @file_get_contents($path);
    if (!is_string($bytes) || $bytes === '') return null;
    $record = json_decode($bytes, true);
    return is_array($record) ? $record : null;
}

function simpleSignatureSave(string $path, array $record): bool {
    $directory = dirname($path);
    if (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory)) return false;
    @chmod($directory, 0700);
    $lock = @fopen($path . '.lock', 'c');
    if ($lock === false || !flock($lock, LOCK_EX)) {
        if (is_resource($lock)) fclose($lock);
        return false;
    }
    $temporary = $path . '.tmp.' . bin2hex(random_bytes(6));
    $encoded = json_encode($record, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $ok = is_string($encoded) && @file_put_contents($temporary, $encoded, LOCK_EX) !== false;
    if ($ok) {
        @chmod($temporary, 0600);
        $ok = @rename($temporary, $path);
    }
    if (!$ok && file_exists($temporary)) @unlink($temporary);
    flock($lock, LOCK_UN);
    fclose($lock);
    return $ok;
}

function simpleSignatureLocate(string $root, string $uuid): ?string {
    $tenantPaths = glob($root . 'tenants/*/' . $uuid . '.json') ?: [];
    foreach ($tenantPaths as $path) {
        $record = simpleSignatureLoad($path);
        if (is_array($record) && simpleSignatureUuid((string)($record['token'] ?? '')) === $uuid) {
            return $path;
        }
    }

    // Read-only compatibility for pre-migration links. New requests are never
    // written into these unscoped global locations.
    $legacyPaths = [
        $root . $uuid . '.json',
        dirname($root) . '/' . $uuid . '.json',
        dirname($root) . '/sig_' . $uuid . '.json'
    ];
    foreach ($legacyPaths as $path) {
        $record = simpleSignatureLoad($path);
        if (is_array($record) && simpleSignatureUuid((string)($record['token'] ?? '')) === $uuid) {
            return $path;
        }
    }
    return null;
}

function simpleSignatureCurrent(array &$record): bool {
    $expiresAt = strtotime((string)($record['expiresAt'] ?? ''));
    if ($expiresAt === false || $expiresAt <= time()) {
        if (strtoupper((string)($record['status'] ?? '')) === 'PENDING') $record['status'] = 'EXPIRED';
        return false;
    }
    return strtoupper((string)($record['status'] ?? '')) === 'PENDING';
}

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if (!in_array($method, ['GET', 'POST'], true)) {
    header('Allow: GET, POST, OPTIONS');
    simpleSignatureRespond(405, ['success' => false, 'error' => 'METHOD_NOT_ALLOWED']);
}

$root = __DIR__ . '/data/public_signatures/';
if (!is_dir($root) && !@mkdir($root, 0700, true) && !is_dir($root)) {
    simpleSignatureRespond(503, ['success' => false, 'error' => 'SIGNATURE_STORAGE_UNAVAILABLE']);
}
@chmod($root, 0700);
$rawBody = file_get_contents('php://input');
$input = is_string($rawBody) ? json_decode($rawBody, true) : null;
if (!is_array($input)) $input = [];
$action = trim((string)($_GET['action'] ?? $_POST['action'] ?? $input['action'] ?? ''));
if ($action === '' && isset($_GET['token'])) $action = 'getRequest';
if ($action === '' && isset($input['request'])) $action = 'createRequest';

try {
    if ($action === 'createRequest') {
        if ($method !== 'POST') simpleSignatureRespond(405, ['success' => false, 'error' => 'METHOD_NOT_ALLOWED']);
        $auth = simpleSignatureWorkspaceAuth();
        if (empty($auth['allowed'])) {
            simpleSignatureRespond(403, ['success' => false, 'error' => $auth['status'] ?? 'ACCESS_DENIED']);
        }
        $request = $input['request'] ?? null;
        if (!is_array($request)) simpleSignatureRespond(400, ['success' => false, 'error' => 'INVALID_REQUEST']);
        $token = trim((string)($request['token'] ?? ''));
        $uuid = simpleSignatureUuid($token);
        if ($uuid === '' || strlen($token) > 32768) {
            simpleSignatureRespond(400, ['success' => false, 'error' => 'INVALID_LINK_TOKEN']);
        }
        foreach (['documentId', 'documentType', 'documentPreview'] as $required) {
            if (!isset($request[$required]) || !is_string($request[$required]) ||
                trim($request[$required]) === '' || strlen($request[$required]) > 2_000_000) {
                simpleSignatureRespond(400, ['success' => false, 'error' => 'INVALID_FIELD', 'field' => $required]);
            }
        }
        // Serialize token creation globally to prevent two workspaces from claiming
        // the same public link token concurrently.
        $tokenLock = @fopen($root . '.token-' . $uuid . '.lock', 'c');
        if ($tokenLock === false || !flock($tokenLock, LOCK_EX)) {
            if (is_resource($tokenLock)) fclose($tokenLock);
            simpleSignatureRespond(503, ['success' => false, 'error' => 'TOKEN_LOCK_UNAVAILABLE']);
        }
        if (simpleSignatureLocate($root, $uuid) !== null) {
            flock($tokenLock, LOCK_UN);
            fclose($tokenLock);
            simpleSignatureRespond(409, ['success' => false, 'error' => 'LINK_TOKEN_ALREADY_EXISTS']);
        }
        $now = time();
        $record = [
            'id' => bin2hex(random_bytes(16)),
            'token' => $token,
            'documentId' => trim($request['documentId']),
            'documentType' => substr(trim($request['documentType']), 0, 120),
            'documentPreview' => $request['documentPreview'],
            'workspace_id' => (string)$auth['workspace_id'],
            'createdAt' => date(DATE_ATOM, $now),
            'expiresAt' => date(DATE_ATOM, $now + 48 * 3600),
            'status' => 'PENDING'
        ];
        $tenantDir = $root . 'tenants/' . $auth['workspace_id'] . '/';
        if (!is_dir($tenantDir) && !@mkdir($tenantDir, 0700, true) && !is_dir($tenantDir)) {
            simpleSignatureRespond(503, ['success' => false, 'error' => 'SIGNATURE_STORAGE_UNAVAILABLE']);
        }
        @chmod($tenantDir, 0700);
        $filePath = $tenantDir . $uuid . '.json';
        if (file_exists($filePath)) {
            flock($tokenLock, LOCK_UN);
            fclose($tokenLock);
            simpleSignatureRespond(409, ['success' => false, 'error' => 'LINK_TOKEN_ALREADY_EXISTS']);
        }
        $saved = simpleSignatureSave($filePath, $record);
        flock($tokenLock, LOCK_UN);
        fclose($tokenLock);
        if (!$saved) simpleSignatureRespond(500, ['success' => false, 'error' => 'REQUEST_SAVE_FAILED']);
        simpleSignatureRespond(201, ['success' => true, 'request' => $record]);
    }

    if ($action === 'getRequest') {
        $token = trim((string)($_GET['token'] ?? $input['token'] ?? ''));
        $uuid = simpleSignatureUuid($token);
        if ($uuid === '') simpleSignatureRespond(400, ['success' => false, 'error' => 'INVALID_LINK_TOKEN']);
        $path = simpleSignatureLocate($root, $uuid);
        $record = $path ? simpleSignatureLoad($path) : null;
        if (!$path || !is_array($record) || !hash_equals((string)($record['token'] ?? ''), $token)) {
            simpleSignatureRespond(404, ['success' => false, 'error' => 'REQUEST_NOT_FOUND']);
        }
        if (simpleSignatureCurrent($record) === false && strtoupper((string)($record['status'] ?? '')) === 'EXPIRED') {
            simpleSignatureSave($path, $record);
        }
        $publicRecord = array_intersect_key($record, array_flip([
            'id', 'token', 'documentId', 'documentType', 'documentPreview',
            'createdAt', 'expiresAt', 'status', 'signedAt', 'signerName', 'signatureData'
        ]));
        simpleSignatureRespond(200, ['success' => true, 'request' => $publicRecord]);
    }

    if ($action === 'signRequest') {
        if ($method !== 'POST') simpleSignatureRespond(405, ['success' => false, 'error' => 'METHOD_NOT_ALLOWED']);
        $token = trim((string)($input['token'] ?? ''));
        $uuid = simpleSignatureUuid($token);
        if ($uuid === '') simpleSignatureRespond(400, ['success' => false, 'error' => 'INVALID_LINK_TOKEN']);
        $path = simpleSignatureLocate($root, $uuid);
        $record = $path ? simpleSignatureLoad($path) : null;
        if (!$path || !is_array($record) || !hash_equals((string)($record['token'] ?? ''), $token)) {
            simpleSignatureRespond(404, ['success' => false, 'error' => 'REQUEST_NOT_FOUND']);
        }
        if (!simpleSignatureCurrent($record)) {
            if (strtoupper((string)($record['status'] ?? '')) === 'EXPIRED') simpleSignatureSave($path, $record);
            simpleSignatureRespond(409, ['success' => false, 'error' => 'REQUEST_NOT_PENDING_OR_EXPIRED']);
        }
        $signerName = trim((string)($input['signerName'] ?? ''));
        $signatureData = (string)($input['signatureData'] ?? '');
        if ($signerName === '' || strlen($signerName) > 160 || $signatureData === '' || strlen($signatureData) > 2_000_000) {
            simpleSignatureRespond(400, ['success' => false, 'error' => 'INVALID_SIGNATURE']);
        }
        $record['status'] = 'SIGNED';
        $record['signedAt'] = date(DATE_ATOM);
        $record['signerName'] = $signerName;
        $record['signatureData'] = $signatureData;
        if (!simpleSignatureSave($path, $record)) {
            simpleSignatureRespond(500, ['success' => false, 'error' => 'SIGNATURE_SAVE_FAILED']);
        }
        $publicRecord = array_intersect_key($record, array_flip([
            'id', 'token', 'documentId', 'documentType', 'documentPreview',
            'createdAt', 'expiresAt', 'status', 'signedAt', 'signerName', 'signatureData'
        ]));
        simpleSignatureRespond(200, ['success' => true, 'request' => $publicRecord]);
    }

    simpleSignatureRespond(400, ['success' => false, 'error' => 'INVALID_ACTION']);
} catch (Throwable $e) {
    error_log('Simple signature API error: ' . $e->getMessage());
    simpleSignatureRespond(500, ['success' => false, 'error' => 'INTERNAL_ERROR']);
}
