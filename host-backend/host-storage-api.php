<?php
/**
 * سیستم ذخیره‌سازی مستقل و حرفه‌ای در هاست
 * بدون وابستگی به سرویس‌های خارجی
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Workspace-ID, X-Workspace-Token, X-Device-HWID');

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

// Read credentials from headers, with JSON-body compatibility for older clients.
$headers = function_exists('getallheaders') ? getallheaders() : [];
$workspaceHeader = '';
$tokenHeader = '';
$hwidHeader = '';
if (is_array($headers)) {
    foreach ($headers as $k => $v) {
        if (strcasecmp((string)$k, 'X-Workspace-ID') === 0) $workspaceHeader = (string)$v;
        elseif (strcasecmp((string)$k, 'X-Workspace-Token') === 0) $tokenHeader = (string)$v;
        elseif (strcasecmp((string)$k, 'X-Device-HWID') === 0) $hwidHeader = (string)$v;
    }
}
$rawBody = file_get_contents('php://input');
$input = is_string($rawBody) ? json_decode($rawBody, true) : null;
if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'INVALID_JSON_BODY']);
    exit;
}
$workspace = trim($workspaceHeader ?: (string)($input['workspace_id'] ?? ''));
if ($workspace === '' || !preg_match('/^[a-zA-Z0-9_-]{1,80}$/', $workspace)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'INVALID_WORKSPACE']);
    exit;
}
$token = trim($tokenHeader ?: (string)($input['workspace_token'] ?? ''));
$hwid = trim($hwidHeader ?: (string)($input['hwid'] ?? ''));

// اعتبارسنجی لایسنس و دسترسی
if (!is_file(__DIR__ . '/license_validator.php')) {
    http_response_code(503);
    echo json_encode([
        'success' => false,
        'error' => 'AUTHORITY_UNAVAILABLE',
        'message' => 'اعتبارسنج مرکزی لایسنس روی سرور نصب نیست.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
require_once __DIR__ . '/license_validator.php';
$access = LicenseValidator::validateAccess($workspace, $token, $hwid);
if (!$access['allowed']) {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'error' => 'ACCESS_DENIED',
        'status' => $access['status'] ?? 'FORBIDDEN',
        'message' => $access['message'] ?? 'دسترسی نامعتبر یا لایسنس منقضی شده است.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
// تنظیمات و تفکیک مسیرها
if (!empty($workspace) && $workspace !== 'default' && $workspace !== 'main') {
    define('DATA_ROOT', __DIR__ . '/data/tenants/' . $workspace);
    define('IMAGES_ROOT', __DIR__ . '/uploads/tenants/' . $workspace);
    define('BACKUP_ROOT', __DIR__ . '/backups/tenants/' . $workspace);
} else {
    define('DATA_ROOT', __DIR__ . '/data');
    define('IMAGES_ROOT', __DIR__ . '/uploads');
    define('BACKUP_ROOT', __DIR__ . '/backups');
}
define('LOG_FILE', DATA_ROOT . '/sync.log');
$ALLOWED_TABLES = [
    'companies', 'products', 'people', 'invoices', 'vouchers', 'checks',
    'transactions', 'config', 'check_transfers', 'checkTransfers',
    'salaries', 'contracts', 'users', 'roles', 'importConfigs'
];

// ایجاد ساختار پوشه‌ها
$folders = [
    DATA_ROOT,
    DATA_ROOT . '/companies',
    DATA_ROOT . '/products',
    DATA_ROOT . '/people',
    DATA_ROOT . '/invoices',
    DATA_ROOT . '/vouchers',
    DATA_ROOT . '/checks',
    DATA_ROOT . '/transactions',
    DATA_ROOT . '/config',
    IMAGES_ROOT . '/companies',
    IMAGES_ROOT . '/checks',
    IMAGES_ROOT . '/signatures',
    BACKUP_ROOT . '/daily',
    BACKUP_ROOT . '/manual'
];

foreach ($folders as $folder) {
    if (!is_dir($folder)) {
        mkdir($folder, 0755, true);
    }
}

// محافظت با .htaccess
$htaccess = "Options -Indexes\nDeny from all\n<FilesMatch \"\\.(jpg|jpeg|png|gif)$\">\n    Allow from all\n</FilesMatch>";
file_put_contents(DATA_ROOT . '/.htaccess', $htaccess, LOCK_EX);
file_put_contents(BACKUP_ROOT . '/.htaccess', "Options -Indexes\nDeny from all", LOCK_EX);

// The validated storage helpers below are the single source of truth.

// Protect tenant data and backups. Logs are stored inside the protected tenant directory.
$denyRules = "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n  Deny from all\n</IfModule>\nOptions -Indexes\n";
if (!is_file(DATA_ROOT . '/.htaccess')) @file_put_contents(DATA_ROOT . '/.htaccess', $denyRules, LOCK_EX);
if (!is_file(BACKUP_ROOT . '/.htaccess')) @file_put_contents(BACKUP_ROOT . '/.htaccess', $denyRules, LOCK_EX);
@chmod(DATA_ROOT, 0700);
@chmod(BACKUP_ROOT, 0700);
@chmod(IMAGES_ROOT, 0700);

function storageValidTable($table): bool {
    return is_string($table) && in_array($table, $GLOBALS['ALLOWED_TABLES'] ?? [], true);
}
function storageValidId($id): bool {
    return is_string($id) && $id !== '' && strlen($id) <= 160 && preg_match('/^[A-Za-z0-9_-]+$/', $id) === 1;
}
function storageIsList(array $value): bool {
    $index = 0;
    foreach (array_keys($value) as $key) {
        if ($key !== $index) return false;
        $index++;
    }
    return true;
}
function logAction($action, $data = []) {
    $log = date('Y-m-d H:i:s') . ' | ' . substr((string)$action, 0, 80) . ' | ' . json_encode($data, JSON_UNESCAPED_UNICODE) . "\n";
    @file_put_contents(LOG_FILE, $log, FILE_APPEND | LOCK_EX);
    @chmod(LOG_FILE, 0600);
}
function tableGroupIds(array $tables): ?array {
    $ids = [];
    foreach ($tables as $table) {
        $rootFile = DATA_ROOT . '/' . $table . '.json';
        if (is_file($rootFile)) {
            $raw = @file_get_contents($rootFile);
            $list = is_string($raw) ? json_decode($raw, true) : null;
            if (!is_array($list) || !storageIsList($list)) return null;
            foreach ($list as $record) {
                if (!is_array($record)) return null;
                $id = (string)($record['id'] ?? '');
                $ids[$id !== '' ? 'id:' . $id : 'row:' . hash('sha256', json_encode($record))] = true;
            }
        }
        $tableDir = DATA_ROOT . '/' . $table;
        if (is_dir($tableDir)) {
            foreach (glob($tableDir . '/*.json') ?: [] as $file) {
                $id = basename($file, '.json');
                $raw = @file_get_contents($file);
                $record = is_string($raw) ? json_decode($raw, true) : null;
                if (!is_array($record)) return null;
                $recordId = (string)($record['id'] ?? $id);
                $ids['id:' . ($recordId !== '' ? $recordId : $id)] = true;
            }
        }
    }
    return $ids;
}
function getStorageQuotaCounts(): ?array {
    $people = tableGroupIds(['people', 'customers', 'clients']);
    $users = tableGroupIds(['users']);
    if ($people === null || $users === null) return null;
    $documents = 0;
    foreach ([['invoices'], ['vouchers'], ['checks'], ['transactions'], ['contracts'],
              ['salaries', 'salary'], ['checkTransfers', 'check_transfers']] as $group) {
        $ids = tableGroupIds($group);
        if ($ids === null) return null;
        $documents += count($ids);
    }
    return ['customers' => count($people), 'users' => count($users), 'documents' => $documents];
}
function hasStorageRecordId(array $tables, string $id): bool {
    foreach ($tables as $table) {
        $rootFile = DATA_ROOT . '/' . $table . '.json';
        if (is_file($rootFile)) {
            $list = json_decode((string)@file_get_contents($rootFile), true);
            if (!is_array($list)) return false;
            foreach ($list as $record) {
                if (is_array($record) && isset($record['id']) && hash_equals((string)$record['id'], $id)) return true;
            }
        }
        if (is_file(DATA_ROOT . '/' . $table . '/' . $id . '.json')) return true;
    }
    return false;
}
function storageAtomicWrite(string $file, string $raw): bool {
    $temp = $file . '.tmp.' . bin2hex(random_bytes(6));
    if (@file_put_contents($temp, $raw, LOCK_EX) === false) {
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
function saveData($table, $data) {
    global $access;
    if (!storageValidTable($table)) return ['success' => false, 'error' => 'INVALID_TABLE'];
    if (!is_array($data)) return ['success' => false, 'error' => 'INVALID_RECORD'];
    $providedId = trim((string)($data['id'] ?? ''));
    $id = $providedId !== '' ? $providedId : bin2hex(random_bytes(12));
    if (!storageValidId($id)) return ['success' => false, 'error' => 'INVALID_RECORD_ID'];
    $data['id'] = $id;
    $tableDir = DATA_ROOT . '/' . $table;
    if (!is_dir($tableDir) && !@mkdir($tableDir, 0700, true) && !is_dir($tableDir)) {
        return ['success' => false, 'error' => 'TABLE_STORAGE_UNAVAILABLE'];
    }
    @chmod($tableDir, 0700);
    if (!is_file($tableDir . '/.htaccess')) @file_put_contents($tableDir . '/.htaccess', "Require all denied\nDeny from all\nOptions -Indexes\n", LOCK_EX);
    $file = $tableDir . '/' . $id . '.json';

    $category = in_array($table, ['people', 'customers', 'clients'], true) ? 'customers' :
        ($table === 'users' ? 'users' :
        (in_array($table, ['invoices', 'vouchers', 'checks', 'transactions', 'contracts', 'salaries', 'salary', 'checkTransfers', 'check_transfers'], true) ? 'documents' : ''));
    $isSuperAdmin = (($access['role'] ?? '') === 'SUPER_ADMIN');
    $unlimited = !empty($access['is_unlimited']) || $isSuperAdmin;
    $limit = $category === 'customers' ? (int)($access['max_customers'] ?? 30) :
        ($category === 'users' ? (int)($access['max_users'] ?? 1) : (int)($access['max_documents'] ?? 100));
    $quotaLock = null;
    if ($category !== '' && !$unlimited) {
        $quotaLock = @fopen(DATA_ROOT . '/.quota.lock', 'c');
        if ($quotaLock === false || !flock($quotaLock, LOCK_EX)) {
            if (is_resource($quotaLock)) fclose($quotaLock);
            return ['success' => false, 'error' => 'QUOTA_LOCK_UNAVAILABLE'];
        }
        $counts = getStorageQuotaCounts();
        if ($counts === null) {
            flock($quotaLock, LOCK_UN);
            fclose($quotaLock);
            return ['success' => false, 'error' => 'QUOTA_DATA_INVALID'];
        }
        $group = $category === 'customers' ? ['people', 'customers', 'clients'] :
            ($category === 'users' ? ['users'] :
            (in_array($table, ['salaries', 'salary'], true) ? ['salaries', 'salary'] :
            (in_array($table, ['checkTransfers', 'check_transfers'], true) ? ['checkTransfers', 'check_transfers'] : [$table])));
        $alreadyExists = hasStorageRecordId($group, $id);
        $current = (int)$counts[$category];
        if (!$alreadyExists && $limit >= 0 && $current >= $limit) {
            flock($quotaLock, LOCK_UN);
            fclose($quotaLock);
            return [
                'success' => false,
                'error' => $category === 'customers' ? 'CUSTOMER_QUOTA_EXCEEDED' :
                    ($category === 'users' ? 'USER_QUOTA_EXCEEDED' : 'DOCUMENT_QUOTA_EXCEEDED'),
                'current' => $current,
                'requested' => $current + 1,
                'max' => $limit
            ];
        }
    }

    $data['updated_at'] = date('Y-m-d H:i:s');
    if (!is_file($file)) $data['created_at'] = date('Y-m-d H:i:s');
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    $saved = is_string($json) && storageAtomicWrite($file, $json);
    if (is_resource($quotaLock)) {
        flock($quotaLock, LOCK_UN);
        fclose($quotaLock);
    }
    if ($saved) {
        logAction('SAVE_' . $table, ['id' => $id, 'workspace' => $GLOBALS['workspace'] ?? '']);
        return ['success' => true, 'id' => $id];
    }
    return ['success' => false, 'error' => 'STORAGE_WRITE_FAILED'];
}
function getData($table, $id = null) {
    if (!storageValidTable($table)) return null;
    if ($id !== null && $id !== '') {
        if (!storageValidId((string)$id)) return null;
        $file = DATA_ROOT . '/' . $table . '/' . $id . '.json';
        if (is_file($file)) return json_decode((string)@file_get_contents($file), true);
        return null;
    }
    $files = glob(DATA_ROOT . '/' . $table . '/*.json') ?: [];
    $data = [];
    foreach ($files as $file) {
        $record = json_decode((string)@file_get_contents($file), true);
        if (is_array($record)) $data[] = $record;
    }
    return $data;
}
function deleteData($table, $id) {
    global $access;
    if (!storageValidTable($table)) return ['success' => false, 'error' => 'INVALID_TABLE'];
    if (!storageValidId((string)$id)) return ['success' => false, 'error' => 'INVALID_RECORD_ID'];
    $file = DATA_ROOT . '/' . $table . '/' . $id . '.json';
    $quotaRelevant = in_array($table, ['people','customers','clients','users','invoices','vouchers','checks','transactions','contracts','salaries','salary','checkTransfers','check_transfers'], true);
    $lock = null;
    if ($quotaRelevant && empty($access['is_unlimited']) && (($access['role'] ?? '') !== 'SUPER_ADMIN')) {
        $lock = @fopen(DATA_ROOT . '/.quota.lock', 'c');
        if ($lock === false || !flock($lock, LOCK_EX)) {
            if (is_resource($lock)) fclose($lock);
            return ['success' => false, 'error' => 'QUOTA_LOCK_UNAVAILABLE'];
        }
    }
    $deleted = is_file($file) && @unlink($file);
    if (is_resource($lock)) {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
    if ($deleted) {
        logAction('DELETE_' . $table, ['id' => $id, 'workspace' => $GLOBALS['workspace'] ?? '']);
        return ['success' => true];
    }
    return ['success' => false, 'error' => 'NOT_FOUND'];
}
function uploadImage($base64, $folder, $filename) {
    if (!is_string($base64) || strlen($base64) > 7500000 ||
        !preg_match('/^data:image\/(?:png|jpeg|jpg|gif|webp);base64,/i', $base64)) {
        return ['success' => false, 'error' => 'INVALID_IMAGE'];
    }
    if (!preg_match('/^[A-Za-z0-9_-]{1,64}$/', (string)$folder) ||
        !preg_match('/^[A-Za-z0-9_-]{1,160}$/', (string)$filename)) {
        return ['success' => false, 'error' => 'INVALID_IMAGE_PATH'];
    }
    $bytes = base64_decode(substr($base64, strpos($base64, ',') + 1), true);
    if (!is_string($bytes) || strlen($bytes) > 5000000 || !function_exists('getimagesizefromstring')) {
        return ['success' => false, 'error' => 'INVALID_OR_UNSUPPORTED_IMAGE'];
    }
    $info = @getimagesizefromstring($bytes);
    if (!is_array($info)) return ['success' => false, 'error' => 'INVALID_IMAGE_DATA'];
    $extensions = [IMAGETYPE_PNG => 'png', IMAGETYPE_JPEG => 'jpg', IMAGETYPE_GIF => 'gif'];
    if (defined('IMAGETYPE_WEBP')) $extensions[IMAGETYPE_WEBP] = 'webp';
    $ext = $extensions[$info[2] ?? 0] ?? null;
    if ($ext === null) return ['success' => false, 'error' => 'UNSUPPORTED_IMAGE_TYPE'];
    $dir = IMAGES_ROOT . '/' . $folder;
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) return ['success' => false, 'error' => 'IMAGE_STORAGE_UNAVAILABLE'];
    @chmod($dir, 0700);
    $path = $dir . '/' . $filename . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
    if (!storageAtomicWrite($path, $bytes)) return ['success' => false, 'error' => 'IMAGE_WRITE_FAILED'];
    return ['success' => true, 'url' => str_replace(DIRECTORY_SEPARATOR, '/', substr($path, strlen(__DIR__)))];
}

function createBackup() {
    $timestamp = date('Y-m-d_H-i-s');
    $manualDir = BACKUP_ROOT . '/manual';
    if (!is_dir($manualDir) && !@mkdir($manualDir, 0700, true) && !is_dir($manualDir)) {
        return ['success' => false, 'error' => 'BACKUP_STORAGE_UNAVAILABLE'];
    }
    @chmod($manualDir, 0700);
    $backup = [
        'timestamp' => date(DATE_ATOM),
        'workspace' => $GLOBALS['workspace'] ?? '',
        'version' => '3.0',
        'data' => []
    ];
    foreach ($GLOBALS['ALLOWED_TABLES'] ?? [] as $table) {
        $records = getData($table);
        if (!is_array($records)) {
            return ['success' => false, 'error' => 'BACKUP_READ_FAILED', 'table' => $table];
        }
        $backup['data'][$table] = $records;
    }
    $encoded = json_encode($backup, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if (!is_string($encoded)) return ['success' => false, 'error' => 'BACKUP_ENCODE_FAILED'];
    $path = $manualDir . '/backup_' . $timestamp . '_' . bin2hex(random_bytes(3)) . '.json';
    if (!storageAtomicWrite($path, $encoded)) {
        return ['success' => false, 'error' => 'BACKUP_WRITE_FAILED'];
    }
    return ['success' => true, 'file' => basename($path), 'size' => filesize($path)];
}

// Keep the legacy API router separate from the secure storage helpers.

// Handle authenticated, workspace-bound storage actions.
$action = trim((string)($input['action'] ?? ''));
try {
    switch ($action) {
        case 'save':
            $table = $input['table'] ?? '';
            $data = $input['data'] ?? null;
            if (!storageValidTable($table) || !is_array($data)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => !storageValidTable($table) ? 'INVALID_TABLE' : 'INVALID_RECORD']);
                break;
            }
            if ($table === 'companies') {
                foreach (['logo', 'stamp', 'signature'] as $imageField) {
                    if (isset($data[$imageField]) && is_string($data[$imageField]) && strpos($data[$imageField], 'data:image') === 0) {
                        $savedImage = uploadImage($data[$imageField], 'companies', (string)($data['id'] ?? 'company') . '_' . $imageField);
                        if (empty($savedImage['success'])) {
                            http_response_code(400);
                            echo json_encode($savedImage);
                            break 2;
                        }
                        $data[$imageField] = $savedImage['url'];
                    }
                }
            }
            if ($table === 'checks' && isset($data['imageUrl']) && is_string($data['imageUrl']) && strpos($data['imageUrl'], 'data:image') === 0) {
                $savedImage = uploadImage($data['imageUrl'], 'checks', (string)($data['id'] ?? 'check'));
                if (empty($savedImage['success'])) {
                    http_response_code(400);
                    echo json_encode($savedImage);
                    break;
                }
                $data['imageUrl'] = $savedImage['url'];
            }
            $result = saveData($table, $data);
            if (empty($result['success'])) {
                http_response_code(in_array($result['error'] ?? '', ['CUSTOMER_QUOTA_EXCEEDED','DOCUMENT_QUOTA_EXCEEDED','USER_QUOTA_EXCEEDED'], true) ? 409 : 400);
            }
            echo json_encode($result, JSON_UNESCAPED_UNICODE);
            break;

        case 'get':
            $table = (string)($input['table'] ?? '');
            $id = $input['id'] ?? null;
            if (!storageValidTable($table) || ($id !== null && !storageValidId((string)$id))) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'INVALID_TABLE_OR_ID']);
                break;
            }
            echo json_encode(['success' => true, 'data' => getData($table, $id)], JSON_UNESCAPED_UNICODE);
            break;

        case 'delete':
            $result = deleteData($input['table'] ?? '', (string)($input['id'] ?? ''));
            if (empty($result['success'])) http_response_code(400);
            echo json_encode($result, JSON_UNESCAPED_UNICODE);
            break;

        case 'sync':
            $items = $input['data'] ?? null;
            if (!is_array($items) || count($items) > 1000) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'INVALID_SYNC_PAYLOAD']);
                break;
            }
            $synced = 0;
            $failed = false;
            foreach ($items as $item) {
                if (!is_array($item)) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'INVALID_SYNC_ITEM', 'synced' => $synced]);
                    $failed = true;
                    break;
                }
                $result = saveData($item['table'] ?? '', $item['data'] ?? null);
                if (empty($result['success'])) {
                    http_response_code(in_array($result['error'] ?? '', ['CUSTOMER_QUOTA_EXCEEDED','DOCUMENT_QUOTA_EXCEEDED','USER_QUOTA_EXCEEDED'], true) ? 409 : 400);
                    echo json_encode(['success' => false, 'error' => $result['error'] ?? 'SYNC_FAILED', 'synced' => $synced]);
                    $failed = true;
                    break;
                }
                $synced++;
            }
            if (!$failed) echo json_encode(['success' => true, 'synced' => $synced]);
            break;

        case 'backup':
            echo json_encode(createBackup(), JSON_UNESCAPED_UNICODE);
            break;

        case 'restore':
            $backup = $input['backup'] ?? null;
            if (!is_array($backup) || !is_array($backup['data'] ?? null)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'INVALID_BACKUP']);
                break;
            }
            $restored = 0;
            $failed = false;
            foreach ($backup['data'] as $table => $records) {
                if (!storageValidTable($table) || !is_array($records) || count($records) > 50000) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'INVALID_BACKUP_TABLE', 'restored' => $restored]);
                    $failed = true;
                    break;
                }
                foreach ($records as $record) {
                    $result = saveData($table, $record);
                    if (empty($result['success'])) {
                        http_response_code(in_array($result['error'] ?? '', ['CUSTOMER_QUOTA_EXCEEDED','DOCUMENT_QUOTA_EXCEEDED','USER_QUOTA_EXCEEDED'], true) ? 409 : 400);
                        echo json_encode(['success' => false, 'error' => $result['error'] ?? 'RESTORE_FAILED', 'restored' => $restored]);
                        $failed = true;
                        break 2;
                    }
                    $restored++;
                }
            }
            if (!$failed) echo json_encode(['success' => true, 'restored' => $restored]);
            break;

        case 'upload_image':
            if (!isset($_FILES['image']) || !is_array($_FILES['image']) ||
                ($_FILES['image']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK ||
                !is_uploaded_file($_FILES['image']['tmp_name'] ?? '')) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'INVALID_UPLOAD']);
                break;
            }
            $folder = trim((string)($_POST['folder'] ?? 'general'));
            $filename = trim((string)($_POST['filename'] ?? bin2hex(random_bytes(8))));
            if (!preg_match('/^[A-Za-z0-9_-]{1,64}$/', $folder) ||
                !preg_match('/^[A-Za-z0-9_-]{1,160}$/', $filename) ||
                (int)($_FILES['image']['size'] ?? 0) > 5000000 ||
                !function_exists('getimagesize')) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'INVALID_OR_OVERSIZED_UPLOAD']);
                break;
            }
            $imageInfo = @getimagesize($_FILES['image']['tmp_name']);
            if (!is_array($imageInfo)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'INVALID_IMAGE_DATA']);
                break;
            }
            $extensions = [IMAGETYPE_PNG => 'png', IMAGETYPE_JPEG => 'jpg', IMAGETYPE_GIF => 'gif'];
            if (defined('IMAGETYPE_WEBP')) $extensions[IMAGETYPE_WEBP] = 'webp';
            $ext = $extensions[$imageInfo[2] ?? 0] ?? null;
            if ($ext === null) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'UNSUPPORTED_IMAGE_TYPE']);
                break;
            }
            $targetDir = IMAGES_ROOT . '/' . $folder;
            if (!is_dir($targetDir) && !@mkdir($targetDir, 0700, true) && !is_dir($targetDir)) {
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'IMAGE_STORAGE_UNAVAILABLE']);
                break;
            }
            @chmod($targetDir, 0700);
            $targetFile = $targetDir . '/' . $filename . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
            if (!@move_uploaded_file($_FILES['image']['tmp_name'], $targetFile)) {
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'UPLOAD_FAILED']);
                break;
            }
            @chmod($targetFile, 0600);
            $url = str_replace(DIRECTORY_SEPARATOR, '/', substr($targetFile, strlen(__DIR__)));
            echo json_encode(['success' => true, 'url' => $url]);
            break;

        case 'stats':
            $stats = [];
            foreach (['companies', 'products', 'people', 'invoices', 'vouchers', 'checks', 'transactions'] as $table) {
                $files = glob(DATA_ROOT . '/' . $table . '/*.json') ?: [];
                $stats[$table] = count($files);
            }
            echo json_encode(['success' => true, 'stats' => $stats]);
            break;

        default:
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'INVALID_ACTION']);
    }
} catch (Throwable $e) {
    logAction('ERROR', ['message' => $e->getMessage()]);
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'INTERNAL_ERROR']);
}

