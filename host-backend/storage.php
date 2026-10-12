<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Workspace-ID, X-Workspace-Token, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// خواندن شناسه فضای کاری و توکن (Workspace ID & Token)
$headers = function_exists('getallheaders') ? getallheaders() : [];
$workspaceHeader = '';
$tokenHeader = '';
foreach ($headers as $k => $v) {
    if (strcasecmp($k, 'X-Workspace-ID') === 0) {
        $workspaceHeader = $v;
    } elseif (strcasecmp($k, 'X-Workspace-Token') === 0) {
        $tokenHeader = $v;
    }
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$workspace = trim($workspaceHeader ?: ($input['workspace_id'] ?? $_GET['workspace_id'] ?? ''));
$workspace = preg_replace('/[^a-zA-Z0-9_-]/', '', $workspace);
$token = trim($tokenHeader ?: ($input['workspace_token'] ?? $_GET['workspace_token'] ?? ''));

// بررسی لایسنس و توکن در صورت وجود فایل license_validator.php
if (file_exists(__DIR__ . '/license_validator.php')) {
    require_once __DIR__ . '/license_validator.php';
    $access = LicenseValidator::validateAccess($workspace, $token);
    if (!$access['allowed']) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error' => 'ACCESS_DENIED',
            'status' => $access['status'] ?? 'FORBIDDEN',
            'message' => $access['message'] ?? 'دسترسی به این فضای کاری مجاز نمی‌باشد.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// تفکیک مسیر ذخیره‌سازی بر پایه فضای کاری (ایزوله‌سازی داده‌های مشتریان و نسخه پرتابل)
if (!empty($workspace) && $workspace !== 'default' && $workspace !== 'main') {
    $DATA_DIR = __DIR__ . '/data/tenants/' . $workspace;
    $IMAGES_DIR = __DIR__ . '/uploads/tenants/' . $workspace;
} else {
    $DATA_DIR = __DIR__ . '/data';
    $IMAGES_DIR = __DIR__ . '/uploads';
}

// ایجاد پوشه‌ها
if (!is_dir($DATA_DIR)) mkdir($DATA_DIR, 0755, true);
if (!is_dir($IMAGES_DIR)) mkdir($IMAGES_DIR, 0755, true);
if (!is_dir($IMAGES_DIR . '/companies')) mkdir($IMAGES_DIR . '/companies', 0755, true);
if (!is_dir($IMAGES_DIR . '/products')) mkdir($IMAGES_DIR . '/products', 0755, true);
if (!is_dir($IMAGES_DIR . '/checks')) mkdir($IMAGES_DIR . '/checks', 0755, true);

$action = $input['action'] ?? $_GET['action'] ?? '';

switch ($action) {
    case 'test':
    case 'checkWorkspace':
        $files = glob($DATA_DIR . '/*.json');
        echo json_encode([
            'success' => true,
            'workspace' => !empty($workspace) ? $workspace : 'default',
            'is_isolated' => (!empty($workspace) && $workspace !== 'default' && $workspace !== 'main'),
            'record_count' => count($files),
            'server_time' => date('Y-m-d H:i:s'),
            'message' => 'اتصال به فضای کاری با موفقیت برقرار است'
        ]);
        break;

    case 'save':
        $key = preg_replace('/[^a-zA-Z0-9_-]/', '', $input['key']);
        $file = $DATA_DIR . '/' . $key . '.json';
        file_put_contents($file, $input['value'], LOCK_EX);

        // اگر کلید مربوط به امضا یا اسناد عمومی باشد، در پوشه عمومی اصلی /data/ نیز ذخیره می‌شود
        if (strpos($key, 'sig_') === 0 || strpos($key, 'share_') === 0 || strpos($key, 'public_') === 0) {
            $globalDir = __DIR__ . '/data';
            if (!is_dir($globalDir)) mkdir($globalDir, 0755, true);
            file_put_contents($globalDir . '/' . $key . '.json', $input['value'], LOCK_EX);
        }

        echo json_encode(['success' => true, 'workspace' => $workspace ?: 'default']);
        break;

    case 'load':
        $key = preg_replace('/[^a-zA-Z0-9_-]/', '', $input['key']);
        $file = $DATA_DIR . '/' . $key . '.json';
        $foundData = null;

        if (file_exists($file)) {
            $foundData = file_get_contents($file);
        } elseif (strpos($key, 'sig_') === 0 || strpos($key, 'share_') === 0 || strpos($key, 'public_') === 0) {
            // ۱. بررسی پوشه عمومی اصلی /data/
            $globalFile = __DIR__ . '/data/' . $key . '.json';
            if (file_exists($globalFile)) {
                $foundData = file_get_contents($globalFile);
            } else {
                // ۲. جستجو در تمام پوشه‌های فضاهای کاری /data/tenants/*/
                $tenantFiles = glob(__DIR__ . '/data/tenants/*/' . $key . '.json');
                if (!empty($tenantFiles) && file_exists($tenantFiles[0])) {
                    $foundData = file_get_contents($tenantFiles[0]);
                }
            }
        }

        if ($foundData !== null) {
            echo json_encode(['success' => true, 'data' => $foundData, 'workspace' => $workspace ?: 'default']);
        } else {
            echo json_encode(['success' => false, 'workspace' => $workspace ?: 'default']);
        }
        break;

    case 'saveImage':
        $folder = preg_replace('/[^a-zA-Z0-9_-]/', '', $input['folder'] ?? 'general');
        $filename = preg_replace('/[^a-zA-Z0-9_.-]/', '', $input['filename']);
        $base64 = $input['base64'];
        
        $targetFolder = $IMAGES_DIR . '/' . $folder;
        if (!is_dir($targetFolder)) mkdir($targetFolder, 0755, true);

        if (preg_match('/^data:image\/(\w+);base64,/', $base64, $type)) {
            $base64 = substr($base64, strpos($base64, ',') + 1);
            $type = strtolower($type[1]);
            $base64 = base64_decode($base64);
            
            $path = $targetFolder . '/' . $filename . '.' . $type;
            file_put_contents($path, $base64, LOCK_EX);
            
            $relativePath = str_replace(__DIR__, '', $path);
            echo json_encode(['success' => true, 'data' => $relativePath]);
        } else {
            echo json_encode(['success' => false, 'message' => 'فرمت تصویر نامعتبر']);
        }
        break;

    case 'deleteImage':
        $path = realpath(__DIR__ . '/' . ltrim($input['path'] ?? '', '/'));
        // امنیت: جلوگیری از دسترسی به خارج از پوشه uploads
        if ($path && strpos($path, realpath($IMAGES_DIR)) === 0 && file_exists($path)) {
            unlink($path);
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'message' => 'فایل یافت نشد']);
        }
        break;

    default:
        echo json_encode(['success' => false, 'message' => 'عملیات نامعتبر']);
}
?>
