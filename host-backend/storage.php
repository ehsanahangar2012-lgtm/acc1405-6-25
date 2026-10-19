<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Workspace-ID, X-Workspace-Token, X-Device-HWID, Authorization');

function storageRespond(int $status, array $payload): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function storageHeader(string $wanted): string {
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    if (is_array($headers)) {
        foreach ($headers as $name => $value) {
            if (strcasecmp((string)$name, $wanted) === 0) return trim((string)$value);
        }
    }
    $serverKey = 'HTTP_' . strtoupper(str_replace('-', '_', $wanted));
    return trim((string)($_SERVER[$serverKey] ?? ''));
}
function storageIsList(array $value): bool {
    $index = 0;
    foreach (array_keys($value) as $key) {
        if ($key !== $index) return false;
        $index++;
    }
    return true;
}
function storageCollectionCount(string $dataDir, string $key, ?string $overrideKey, ?string $overrideValue, bool &$corrupt): int {
    $file = $dataDir . DIRECTORY_SEPARATOR . $key . '.json';
    if ($overrideKey !== null && $key === $overrideKey) {
        $raw = $overrideValue ?? '';
    } elseif (is_file($file)) {
        $raw = @file_get_contents($file);
        if (!is_string($raw)) {
            $corrupt = true;
            return 0;
        }
    } else {
        return 0;
    }
    $value = json_decode($raw, true);
    if (!is_array($value) || !storageIsList($value)) {
        $corrupt = true;
        return 0;
    }
    return count($value);
}
function storageAliasGroupCount(string $dataDir, array $keys, ?string $overrideKey, ?string $overrideValue, bool &$corrupt): int {
    $count = 0;
    foreach ($keys as $key) {
        $count = max($count, storageCollectionCount($dataDir, $key, $overrideKey, $overrideValue, $corrupt));
    }
    return $count;
}
function storageQuotaSnapshot(string $dataDir, ?string $overrideKey = null, ?string $overrideValue = null): ?array {
    $corrupt = false;
    // Aliases are grouped using max, not sum, because old clients synced the
    // same check-transfer collection to both checkTransfers and check_transfers.
    $customers = storageAliasGroupCount($dataDir, ['people', 'customers', 'clients'], $overrideKey, $overrideValue, $corrupt);
    $users = storageAliasGroupCount($dataDir, ['users'], $overrideKey, $overrideValue, $corrupt);
    $documents = 0;
    foreach ([
        ['invoices'], ['vouchers'], ['checks'], ['transactions'], ['contracts'],
        ['salaries', 'salary'], ['checkTransfers', 'check_transfers']
    ] as $group) {
        $documents += storageAliasGroupCount($dataDir, $group, $overrideKey, $overrideValue, $corrupt);
    }
    return $corrupt ? null : ['customers' => $customers, 'documents' => $documents, 'users' => $users];
}
function storageAtomicWrite(string $file, string $value): bool {
    $directory = dirname($file);
    $temp = $file . '.tmp.' . bin2hex(random_bytes(6));
    if (@file_put_contents($temp, $value, LOCK_EX) === false) {
        if (is_file($temp)) @unlink($temp);
        return false;
    }
    @chmod($temp, 0600);
    if (!@rename($temp, $file)) {
        @unlink($temp);
        return false;
    }
    @chmod($file, 0600);
    return true;
}
function storageSaveValue(string $dataDir, string $key, string $value, array $access): array {
    $file = $dataDir . DIRECTORY_SEPARATOR . $key . '.json';
    $customerKeys = ['people', 'customers', 'clients'];
    $documentKeys = [
        'invoices', 'vouchers', 'checks', 'transactions', 'contracts',
        'salaries', 'salary', 'checkTransfers', 'check_transfers'
    ];
    $category = in_array($key, $customerKeys, true) ? 'customers' :
        (in_array($key, $documentKeys, true) ? 'documents' :
        ($key === 'users' ? 'users' : ''));
    if ($category === '') {
        return storageAtomicWrite($file, $value)
            ? ['success' => true, 'workspace' => true]
            : ['success' => false, 'error' => 'STORAGE_WRITE_FAILED'];
    }

    $lock = @fopen($dataDir . DIRECTORY_SEPARATOR . '.quota.lock', 'c');
    if ($lock === false || !flock($lock, LOCK_EX)) {
        if (is_resource($lock)) fclose($lock);
        return ['success' => false, 'error' => 'QUOTA_LOCK_UNAVAILABLE'];
    }

    $current = storageQuotaSnapshot($dataDir);
    $proposed = storageQuotaSnapshot($dataDir, $key, $value);
    if ($current === null || $proposed === null) {
        flock($lock, LOCK_UN);
        fclose($lock);
        return ['success' => false, 'error' => 'QUOTA_DATA_INVALID'];
    }

    $unlimited = !empty($access['is_unlimited']) || (($access['role'] ?? '') === 'SUPER_ADMIN');
    $limit = $category === 'customers'
        ? (int)($access['max_customers'] ?? 30)
        : ($category === 'documents'
            ? (int)($access['max_documents'] ?? 100)
            : (int)($access['max_users'] ?? 1));
    $before = (int)$current[$category];
    $after = (int)$proposed[$category];

    // Existing above-limit data may still be edited or reduced, but no operation
    // can grow the collection beyond the signed server-side entitlement.
    if (!$unlimited && $limit >= 0 && $after > $limit && $after > $before) {
        flock($lock, LOCK_UN);
        fclose($lock);
        return [
            'success' => false,
            'error' => $category === 'customers' ? 'CUSTOMER_QUOTA_EXCEEDED' :
                ($category === 'documents' ? 'DOCUMENT_QUOTA_EXCEEDED' : 'USER_QUOTA_EXCEEDED'),
            'category' => $category,
            'current' => $before,
            'requested' => $after,
            'max' => $limit
        ];
    }

    $saved = storageAtomicWrite($file, $value);
    flock($lock, LOCK_UN);
    fclose($lock);
    return $saved
        ? ['success' => true, 'workspace' => true, 'quota_category' => $category, 'count' => $after, 'max' => $limit]
        : ['success' => false, 'error' => 'STORAGE_WRITE_FAILED'];
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    header('Allow: POST, OPTIONS');
    storageRespond(405, ['success' => false, 'error' => 'METHOD_NOT_ALLOWED']);
}
$rawBody = file_get_contents('php://input');
$input = is_string($rawBody) ? json_decode($rawBody, true) : null;
if (!is_array($input)) storageRespond(400, ['success' => false, 'error' => 'INVALID_JSON_BODY']);

$workspace = storageHeader('X-Workspace-ID');
if ($workspace === '') $workspace = trim((string)($input['workspace_id'] ?? ''));
if ($workspace === '' || !preg_match('/^[a-zA-Z0-9_-]{1,80}$/', $workspace)) {
    storageRespond(400, ['success' => false, 'error' => 'INVALID_WORKSPACE']);
}
$token = storageHeader('X-Workspace-Token');
if ($token === '') $token = trim((string)($input['workspace_token'] ?? ''));
$hwid = storageHeader('X-Device-HWID');
if ($hwid === '') $hwid = trim((string)($input['hwid'] ?? ''));

$validatorFile = __DIR__ . '/license_validator.php';
if (!is_file($validatorFile)) storageRespond(503, ['success' => false, 'error' => 'AUTHORITY_UNAVAILABLE']);
require_once $validatorFile;
$access = LicenseValidator::validateAccess($workspace, $token, in_array($workspace, ['default', 'main'], true) ? null : $hwid);
if (empty($access['allowed'])) {
    storageRespond(($access['status'] ?? '') === 'REGISTRY_UNAVAILABLE' ? 503 : 403, [
        'success' => false,
        'error' => 'ACCESS_DENIED',
        'status' => $access['status'] ?? 'FORBIDDEN'
    ]);
}

$DATA_DIR = in_array($workspace, ['default', 'main'], true)
    ? __DIR__ . '/data'
    : __DIR__ . '/data/tenants/' . $workspace;
$IMAGES_DIR = in_array($workspace, ['default', 'main'], true)
    ? __DIR__ . '/uploads'
    : __DIR__ . '/uploads/tenants/' . $workspace;

foreach ([$DATA_DIR, $IMAGES_DIR, $IMAGES_DIR . '/companies', $IMAGES_DIR . '/products', $IMAGES_DIR . '/checks'] as $folder) {
    if (!is_dir($folder) && !@mkdir($folder, 0700, true) && !is_dir($folder)) {
        storageRespond(500, ['success' => false, 'error' => 'STORAGE_UNAVAILABLE']);
    }
    @chmod($folder, 0700);
}
$denyRules = "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n  Deny from all\n</IfModule>\nOptions -Indexes\n";
if (!is_file($DATA_DIR . '/.htaccess')) @file_put_contents($DATA_DIR . '/.htaccess', $denyRules, LOCK_EX);
if (!is_file($IMAGES_DIR . '/.htaccess')) {
    @file_put_contents($IMAGES_DIR . '/.htaccess', "Options -Indexes\n<FilesMatch \"\\.(php|php[0-9]*|phtml|phar)$\">\n  Require all denied\n</FilesMatch>\n", LOCK_EX);
}

$action = trim((string)($input['action'] ?? ''));
$key = trim((string)($input['key'] ?? ''));

switch ($action) {
    case 'test':
    case 'checkWorkspace':
        $files = glob($DATA_DIR . '/*.json') ?: [];
        storageRespond(200, [
            'success' => true,
            'workspace' => $workspace,
            'is_isolated' => !in_array($workspace, ['default', 'main'], true),
            'record_count' => count($files),
            'server_time' => date(DATE_ATOM)
        ]);

    case 'save':
        if ($key === '' || !preg_match('/^[A-Za-z0-9_-]{1,128}$/', $key)) {
            storageRespond(400, ['success' => false, 'error' => 'INVALID_KEY']);
        }
        $value = $input['value'] ?? null;
        if (!is_string($value) || strlen($value) > 25_000_000) {
            storageRespond(413, ['success' => false, 'error' => 'INVALID_OR_OVERSIZED_VALUE']);
        }
        $result = storageSaveValue($DATA_DIR, $key, $value, $access);
        if (!empty($result['success'])) $result['workspace'] = $workspace;
        if (empty($result['success'])) {
            $status = in_array($result['error'] ?? '', ['CUSTOMER_QUOTA_EXCEEDED', 'DOCUMENT_QUOTA_EXCEEDED', 'USER_QUOTA_EXCEEDED'], true) ? 409 :
                (($result['error'] ?? '') === 'QUOTA_LOCK_UNAVAILABLE' ? 503 : 400);
            storageRespond($status, $result);
        }
        storageRespond(200, $result);

    case 'load':
        if ($key === '' || !preg_match('/^[A-Za-z0-9_-]{1,128}$/', $key)) {
            storageRespond(400, ['success' => false, 'error' => 'INVALID_KEY']);
        }
        $file = $DATA_DIR . DIRECTORY_SEPARATOR . $key . '.json';
        if (!is_file($file)) storageRespond(200, ['success' => false, 'workspace' => $workspace]);
        $value = @file_get_contents($file);
        if (!is_string($value)) storageRespond(500, ['success' => false, 'error' => 'STORAGE_READ_FAILED']);
        storageRespond(200, ['success' => true, 'data' => $value, 'workspace' => $workspace]);

    case 'saveImage':
        $folder = trim((string)($input['folder'] ?? 'general'));
        $filename = trim((string)($input['filename'] ?? ''));
        $base64 = $input['base64'] ?? '';
        if (!preg_match('/^[A-Za-z0-9_-]{1,64}$/', $folder) ||
            $filename === '' || strlen($filename) > 160 ||
            !preg_match('/^[A-Za-z0-9_-]{1,160}$/', $filename) ||
            !is_string($base64) || strlen($base64) > 7_500_000 ||
            !preg_match('#^data:image/(?:png|jpeg|jpg|gif|webp);base64,#i', $base64, $m)) {
            storageRespond(400, ['success' => false, 'error' => 'INVALID_IMAGE']);
        }
        $encoded = substr($base64, strpos($base64, ',') + 1);
        $bytes = base64_decode($encoded, true);
        if (!is_string($bytes) || strlen($bytes) > 5_000_000) {
            storageRespond(413, ['success' => false, 'error' => 'INVALID_OR_OVERSIZED_IMAGE']);
        }
        $imageInfo = function_exists('getimagesizefromstring') ? @getimagesizefromstring($bytes) : false;
        if (!is_array($imageInfo)) storageRespond(400, ['success' => false, 'error' => 'INVALID_IMAGE_DATA']);
        $allowedTypes = [IMAGETYPE_PNG => 'png', IMAGETYPE_JPEG => 'jpg', IMAGETYPE_GIF => 'gif', IMAGETYPE_WEBP => 'webp'];
        $ext = $allowedTypes[$imageInfo[2] ?? 0] ?? null;
        if ($ext === null) storageRespond(400, ['success' => false, 'error' => 'UNSUPPORTED_IMAGE_TYPE']);
        $targetFolder = $IMAGES_DIR . DIRECTORY_SEPARATOR . $folder;
        if (!is_dir($targetFolder) && !@mkdir($targetFolder, 0700, true) && !is_dir($targetFolder)) {
            storageRespond(500, ['success' => false, 'error' => 'IMAGE_STORAGE_UNAVAILABLE']);
        }
        @chmod($targetFolder, 0700);
        $target = $targetFolder . DIRECTORY_SEPARATOR . $filename . '.' . $ext;
        if (!storageAtomicWrite($target, $bytes)) storageRespond(500, ['success' => false, 'error' => 'IMAGE_WRITE_FAILED']);
        $relative = str_replace(DIRECTORY_SEPARATOR, '/', substr($target, strlen(__DIR__)));
        storageRespond(200, ['success' => true, 'data' => $relative]);

    case 'deleteImage':
        $requested = trim((string)($input['path'] ?? ''));
        if ($requested === '' || str_contains($requested, "\0")) {
            storageRespond(400, ['success' => false, 'error' => 'INVALID_IMAGE_PATH']);
        }
        $resolved = realpath(__DIR__ . DIRECTORY_SEPARATOR . ltrim($requested, '/\\'));
        $imageRoot = realpath($IMAGES_DIR);
        $prefix = $imageRoot ? rtrim($imageRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR : '';
        if ($resolved && is_file($resolved) && $prefix !== '' && strpos($resolved, $prefix) === 0) {
            if (!@unlink($resolved)) storageRespond(500, ['success' => false, 'error' => 'IMAGE_DELETE_FAILED']);
            storageRespond(200, ['success' => true]);
        }
        storageRespond(404, ['success' => false, 'error' => 'IMAGE_NOT_FOUND']);

    default:
        storageRespond(400, ['success' => false, 'error' => 'INVALID_ACTION']);
}
