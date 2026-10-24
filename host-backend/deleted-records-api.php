<?php
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
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if (!in_array($method, ['GET', 'POST'], true)) {
    header('Allow: GET, POST, OPTIONS');
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'METHOD_NOT_ALLOWED']);
    exit;
}

function deletedRecordsHeader(string $wanted): string {
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    if (is_array($headers)) {
        foreach ($headers as $name => $value) {
            if (strcasecmp((string)$name, $wanted) === 0) return trim((string)$value);
        }
    }
    $serverKey = 'HTTP_' . strtoupper(str_replace('-', '_', $wanted));
    return trim((string)($_SERVER[$serverKey] ?? ''));
}

function deletedRecordsRespond(int $status, array $body): void {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$workspace = deletedRecordsHeader('X-Workspace-ID');
$token = deletedRecordsHeader('X-Workspace-Token');
$hwid = deletedRecordsHeader('X-Device-HWID');
if ($workspace === '' || !preg_match('/^[a-zA-Z0-9_-]{1,80}$/', $workspace) || $token === '') {
    deletedRecordsRespond(403, ['success' => false, 'error' => 'AUTH_REQUIRED']);
}

$validatorFile = __DIR__ . '/license_validator.php';
if (!is_file($validatorFile)) {
    deletedRecordsRespond(503, ['success' => false, 'error' => 'AUTHORITY_UNAVAILABLE']);
}
require_once $validatorFile;
$isMotherWorkspace = in_array($workspace, ['default', 'main'], true);
$access = LicenseValidator::validateAccess($workspace, $token, $isMotherWorkspace ? null : $hwid);
if (empty($access['allowed'])) {
    $status = ($access['status'] ?? '') === 'REGISTRY_UNAVAILABLE' ? 503 : 403;
    deletedRecordsRespond($status, ['success' => false, 'error' => $access['status'] ?? 'ACCESS_DENIED']);
}

$rawBody = file_get_contents('php://input');
$input = is_string($rawBody) ? json_decode($rawBody, true) : null;
if (!is_array($input)) $input = [];
$bodyWorkspace = trim((string)($input['workspace_id'] ?? ''));
if ($bodyWorkspace !== '' && !hash_equals($workspace, $bodyWorkspace)) {
    deletedRecordsRespond(403, ['success' => false, 'error' => 'WORKSPACE_MISMATCH']);
}
$action = trim((string)($_GET['action'] ?? $input['action'] ?? ''));
$workspaceDir = $isMotherWorkspace
    ? __DIR__ . '/db'
    : __DIR__ . '/db/tenants/' . $workspace;
if (!is_dir($workspaceDir) && !@mkdir($workspaceDir, 0700, true) && !is_dir($workspaceDir)) {
    deletedRecordsRespond(500, ['success' => false, 'error' => 'STORAGE_UNAVAILABLE']);
}
@chmod($workspaceDir, 0700);
$denyFile = $workspaceDir . '/.htaccess';
if (!is_file($denyFile)) @file_put_contents($denyFile, "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n  Deny from all\n</IfModule>\nOptions -Indexes\n", LOCK_EX);
$file = $workspaceDir . '/deleted_records.json';

function loadDeletedRecordsSecure(string $file): array {
    if (!is_file($file) || !is_readable($file)) return [];
    $raw = @file_get_contents($file);
    if (!is_string($raw) || $raw === '') return [];
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}
function saveDeletedRecordsSecure(string $file, array $records): bool {
    $dir = dirname($file);
    $lock = @fopen($file . '.lock', 'c');
    if ($lock === false || !flock($lock, LOCK_EX)) {
        if (is_resource($lock)) fclose($lock);
        return false;
    }
    $tmp = $file . '.tmp.' . bin2hex(random_bytes(6));
    $json = json_encode($records, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $ok = is_string($json) && @file_put_contents($tmp, $json, LOCK_EX) !== false;
    if ($ok) {
        @chmod($tmp, 0600);
        $ok = @rename($tmp, $file);
    }
    if (!$ok && file_exists($tmp)) @unlink($tmp);
    flock($lock, LOCK_UN);
    fclose($lock);
    return $ok;
}

$records = loadDeletedRecordsSecure($file);
try {
    switch ($action) {
        case 'register':
            if ($method !== 'POST') deletedRecordsRespond(405, ['success' => false, 'error' => 'METHOD_NOT_ALLOWED']);
            $incoming = $input['records'] ?? null;
            if (!is_array($incoming) || count($incoming) > 500) {
                deletedRecordsRespond(400, ['success' => false, 'error' => 'INVALID_RECORDS']);
            }
            $registered = 0;
            foreach ($incoming as $record) {
                if (!is_array($record)) continue;
                $id = trim((string)($record['id'] ?? ''));
                $type = trim((string)($record['type'] ?? ''));
                if ($id === '' || strlen($id) > 200 ||
                    !preg_match('/^[a-zA-Z0-9_.:-]+$/', $id) ||
                    !in_array($type, ['product','person','invoice','voucher','check','transaction','user','company','contract','salary','checkTransfer'], true)) {
                    continue;
                }
                $record = array_intersect_key($record, array_flip([
                    'id','type','deletedAt','deletedBy','deviceId','reason'
                ]));
                $record['id'] = $id;
                $record['type'] = $type;
                $record['serverReceivedAt'] = date(DATE_ATOM);
                $records[$id] = $record;
                $registered++;
            }
            if (!saveDeletedRecordsSecure($file, $records)) {
                deletedRecordsRespond(500, ['success' => false, 'error' => 'STORAGE_WRITE_FAILED']);
            }
            deletedRecordsRespond(200, ['success' => true, 'registered' => $registered, 'total' => count($records)]);
        case 'list':
            deletedRecordsRespond(200, ['success' => true, 'records' => array_values($records)]);
        case 'check':
            $id = trim((string)($_GET['id'] ?? ''));
            if ($id === '' || strlen($id) > 200) deletedRecordsRespond(400, ['success' => false, 'error' => 'INVALID_ID']);
            deletedRecordsRespond(200, ['success' => true, 'isDeleted' => isset($records[$id]), 'record' => $records[$id] ?? null]);
        case 'stats':
            $stats = ['total' => count($records), 'byType' => [], 'last24h' => 0, 'last7d' => 0];
            $now = time();
            foreach ($records as $record) {
                $type = (string)($record['type'] ?? 'unknown');
                $stats['byType'][$type] = ($stats['byType'][$type] ?? 0) + 1;
                $when = strtotime((string)($record['serverReceivedAt'] ?? '')) ?: 0;
                if ($when >= $now - 86400) $stats['last24h']++;
                if ($when >= $now - 604800) $stats['last7d']++;
            }
            deletedRecordsRespond(200, ['success' => true, 'stats' => $stats]);
        case 'cleanup':
            if (empty($access['role']) || $access['role'] !== 'SUPER_ADMIN' || !$isMotherWorkspace) {
                deletedRecordsRespond(403, ['success' => false, 'error' => 'MOTHER_PORTAL_ONLY']);
            }
            if ($method !== 'POST') deletedRecordsRespond(405, ['success' => false, 'error' => 'METHOD_NOT_ALLOWED']);
            $cutoff = time() - 90 * 86400;
            $before = count($records);
            foreach ($records as $id => $record) {
                $when = strtotime((string)($record['serverReceivedAt'] ?? '')) ?: 0;
                if ($when < $cutoff) unset($records[$id]);
            }
            if (!saveDeletedRecordsSecure($file, $records)) {
                deletedRecordsRespond(500, ['success' => false, 'error' => 'STORAGE_WRITE_FAILED']);
            }
            deletedRecordsRespond(200, ['success' => true, 'cleaned' => $before - count($records), 'remaining' => count($records)]);
        default:
            deletedRecordsRespond(400, ['success' => false, 'error' => 'INVALID_ACTION']);
    }
} catch (Throwable $e) {
    error_log('Deleted records API error: ' . $e->getMessage());
    deletedRecordsRespond(500, ['success' => false, 'error' => 'INTERNAL_ERROR']);
}
