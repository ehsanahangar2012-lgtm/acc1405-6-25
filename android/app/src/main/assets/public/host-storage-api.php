<?php
/**
 * سیستم ذخیره‌سازی مستقل و حرفه‌ای در هاست
 * بدون وابستگی به سرویس‌های خارجی
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Workspace-ID, X-Workspace-Token, X-Device-HWID');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// خواندن شناسه فضای کاری و توکن (Workspace ID & Token)
$headers = function_exists('getallheaders') ? getallheaders() : [];
$workspaceHeader = '';
$tokenHeader = '';
$hwidHeader = '';
foreach ($headers as $k => $v) {
    if (strcasecmp($k, 'X-Workspace-ID') === 0) {
        $workspaceHeader = $v;
    } elseif (strcasecmp($k, 'X-Workspace-Token') === 0) {
        $tokenHeader = $v;
    } elseif (strcasecmp($k, 'X-Device-HWID') === 0) {
        $hwidHeader = $v;
    }
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$workspace = trim($workspaceHeader ?: ($input['workspace_id'] ?? $_GET['workspace_id'] ?? ''));
$workspace = preg_replace('/[^a-zA-Z0-9_-]/', '', $workspace);
// Do not accept workspace tokens in query strings: URLs can be captured in access logs and referrers.
$token = trim($tokenHeader ?: ($input['workspace_token'] ?? ''));
$hwid = trim($hwidHeader ?: ($input['hwid'] ?? ''));

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
define('LOG_FILE', __DIR__ . '/sync.log');

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

// توابع کمکی
function logAction($action, $data = []) {
    $log = date('Y-m-d H:i:s') . " | $action | " . json_encode($data, JSON_UNESCAPED_UNICODE) . "\n";
    file_put_contents(LOG_FILE, $log, FILE_APPEND | LOCK_EX);
}

function saveData($table, $data) {
    $id = $data['id'] ?? uniqid();
    $file = DATA_ROOT . "/$table/$id.json";
    
    $data['updated_at'] = date('Y-m-d H:i:s');
    if (!file_exists($file)) {
        $data['created_at'] = date('Y-m-d H:i:s');
    }
    
    $result = file_put_contents($file, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
    
    if ($result) {
        logAction("SAVE_$table", ['id' => $id]);
        return ['success' => true, 'id' => $id];
    }
    
    return ['success' => false, 'error' => 'Failed to save'];
}

function getData($table, $id = null) {
    if ($id) {
        $file = DATA_ROOT . "/$table/$id.json";
        if (file_exists($file)) {
            return json_decode(file_get_contents($file), true);
        }
        return null;
    }
    
    // بازگشت تمام رکوردها
    $files = glob(DATA_ROOT . "/$table/*.json");
    $data = [];
    foreach ($files as $file) {
        $data[] = json_decode(file_get_contents($file), true);
    }
    return $data;
}

function deleteData($table, $id) {
    $file = DATA_ROOT . "/$table/$id.json";
    if (file_exists($file)) {
        unlink($file);
        logAction("DELETE_$table", ['id' => $id]);
        return ['success' => true];
    }
    return ['success' => false, 'error' => 'Not found'];
}

function uploadImage($base64, $folder, $filename) {
    if (!preg_match('/^data:image\/(\w+);base64,/', $base64, $type)) {
        return $base64; // اگر base64 نیست، همان را برگردان
    }
    
    $data = substr($base64, strpos($base64, ',') + 1);
    $data = base64_decode($data);
    
    if ($data === false) {
        return $base64;
    }
    
    $ext = strtolower($type[1]);
    $path = IMAGES_ROOT . "/$folder/" . $filename . '_' . time() . '.' . $ext;
    
    if (file_put_contents($path, $data)) {
        $url = str_replace(__DIR__, '', $path);
        return 'https://' . $_SERVER['HTTP_HOST'] . $url;
    }
    
    return $base64;
}

function createBackup() {
    $timestamp = date('Y-m-d_H-i-s');
    $backupFile = BACKUP_ROOT . "/manual/backup_$timestamp.json";
    
    $backup = [
        'timestamp' => date('c'),
        'version' => '2.0',
        'data' => []
    ];
    
    $tables = ['companies', 'products', 'people', 'invoices', 'vouchers', 'checks', 'transactions', 'config'];
    
    foreach ($tables as $table) {
        $backup['data'][$table] = getData($table);
    }
    
    file_put_contents($backupFile, json_encode($backup, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
    
    return ['success' => true, 'file' => basename($backupFile), 'size' => filesize($backupFile)];
}

function restoreBackup($backupData) {
    foreach ($backupData['data'] as $table => $records) {
        foreach ($records as $record) {
            saveData($table, $record);
        }
    }
    return ['success' => true, 'message' => 'Restored successfully'];
}

// مدیریت درخواست‌ها
$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? $_GET['action'] ?? '';

try {
    switch ($action) {
        case 'save':
            $table = $input['table'];
            $data = $input['data'];
            
            // پردازش تصاویر
            if ($table === 'companies') {
                if (isset($data['logo']) && strpos($data['logo'], 'data:image') === 0) {
                    $data['logo'] = uploadImage($data['logo'], 'companies', $data['id'] . '_logo');
                }
                if (isset($data['stamp']) && strpos($data['stamp'], 'data:image') === 0) {
                    $data['stamp'] = uploadImage($data['stamp'], 'companies', $data['id'] . '_stamp');
                }
                if (isset($data['signature']) && strpos($data['signature'], 'data:image') === 0) {
                    $data['signature'] = uploadImage($data['signature'], 'companies', $data['id'] . '_signature');
                }
            }
            
            if ($table === 'checks' && isset($data['imageUrl']) && strpos($data['imageUrl'], 'data:image') === 0) {
                $data['imageUrl'] = uploadImage($data['imageUrl'], 'checks', $data['id']);
            }
            
            echo json_encode(saveData($table, $data));
            break;
            
        case 'get':
            $table = $_GET['table'];
            $id = $_GET['id'] ?? null;
            echo json_encode(['success' => true, 'data' => getData($table, $id)]);
            break;
            
        case 'delete':
            $table = $input['table'];
            $id = $input['id'];
            echo json_encode(deleteData($table, $id));
            break;
            
        case 'sync':
            // سینک دسته‌ای
            $synced = 0;
            foreach ($input['data'] as $item) {
                $result = saveData($item['table'], $item['data']);
                if ($result['success']) $synced++;
            }
            echo json_encode(['success' => true, 'synced' => $synced]);
            break;
            
        case 'backup':
            echo json_encode(createBackup());
            break;
            
        case 'restore':
            echo json_encode(restoreBackup($input['backup']));
            break;
            
        case 'upload_image':
            if (isset($_FILES['image'])) {
                $folder = $_POST['folder'] ?? 'general';
                $filename = $_POST['filename'] ?? uniqid();
                
                $target = IMAGES_ROOT . "/$folder/" . $filename . '_' . time() . '.' . pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION);
                
                if (move_uploaded_file($_FILES['image']['tmp_name'], $target)) {
                    $url = str_replace(__DIR__, '', $target);
                    echo json_encode(['success' => true, 'url' => 'https://' . $_SERVER['HTTP_HOST'] . $url]);
                } else {
                    echo json_encode(['success' => false, 'error' => 'Upload failed']);
                }
            }
            break;
            
        case 'stats':
            $stats = [];
            $tables = ['companies', 'products', 'people', 'invoices', 'vouchers', 'checks', 'transactions'];
            foreach ($tables as $table) {
                $files = glob(DATA_ROOT . "/$table/*.json");
                $stats[$table] = count($files);
            }
            echo json_encode(['success' => true, 'stats' => $stats]);
            break;
            
        default:
            echo json_encode(['success' => false, 'error' => 'Invalid action']);
    }
} catch (Exception $e) {
    logAction('ERROR', ['message' => $e->getMessage()]);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
