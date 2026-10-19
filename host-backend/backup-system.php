<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Workspace-ID, X-Workspace-Token, X-Device-HWID');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

$headers = function_exists('getallheaders') ? getallheaders() : [];
$workspace = '';
$token = '';
$hwid = '';
foreach ($headers as $name => $value) {
    if (strcasecmp($name, 'X-Workspace-ID') === 0) $workspace = (string)$value;
    elseif (strcasecmp($name, 'X-Workspace-Token') === 0) $token = (string)$value;
    elseif (strcasecmp($name, 'X-Device-HWID') === 0) $hwid = (string)$value;
}
$workspace = trim($workspace);
$token = trim($token);
$hwid = trim($hwid);
if ($workspace === '' || !preg_match('/^[a-zA-Z0-9_-]{1,128}$/', $workspace)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'INVALID_WORKSPACE']);
    exit();
}
$validatorFile = __DIR__ . '/license_validator.php';
if (!is_file($validatorFile)) {
    http_response_code(503);
    echo json_encode(['success' => false, 'error' => 'AUTHORITY_UNAVAILABLE']);
    exit();
}
require_once $validatorFile;
$access = LicenseValidator::validateAccess($workspace, $token, $hwid);
if (!($access['allowed'] ?? false)) {
    http_response_code(($access['status'] ?? '') === 'REGISTRY_UNAVAILABLE' ? 503 : 403);
    echo json_encode(['success' => false, 'error' => 'ACCESS_DENIED', 'status' => $access['status'] ?? 'FORBIDDEN']);
    exit();
}

// Customer backups and uploads are isolated by workspace; never use a shared client directory.
if ($workspace === 'default' || $workspace === 'main') {
    $BACKUP_ROOT = __DIR__ . '/backup';
    $DAILY_BACKUP_ROOT = __DIR__ . '/daily-backups';
    $IMAGES_ROOT = __DIR__ . '/uploads';
} else {
    $BACKUP_ROOT = __DIR__ . '/backup/tenants/' . $workspace;
    $DAILY_BACKUP_ROOT = __DIR__ . '/daily-backups/tenants/' . $workspace;
    $IMAGES_ROOT = __DIR__ . '/uploads/tenants/' . $workspace;
}
foreach ([$BACKUP_ROOT, $DAILY_BACKUP_ROOT, $IMAGES_ROOT] as $protectedDir) {
    if (!is_dir($protectedDir) && !mkdir($protectedDir, 0700, true) && !is_dir($protectedDir)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'STORAGE_UNAVAILABLE']);
        exit();
    }
    @chmod($protectedDir, 0700);
    $denyFile = $protectedDir . '/.htaccess';
    if (!is_file($denyFile)) @file_put_contents($denyFile, "Options -Indexes\nDeny from all\n", LOCK_EX);
}

// تنظیمات
$BACKUP_ROOT = __DIR__ . '/backup';
$DAILY_BACKUP_ROOT = __DIR__ . '/daily-backups';
$IMAGES_ROOT = __DIR__ . '/uploads';

// ایجاد پوشه‌ها
if (!is_dir($BACKUP_ROOT)) mkdir($BACKUP_ROOT, 0755, true);
if (!is_dir($DAILY_BACKUP_ROOT)) mkdir($DAILY_BACKUP_ROOT, 0755, true);
if (!is_dir($IMAGES_ROOT)) mkdir($IMAGES_ROOT, 0755, true);

function createBackupStructure($root) {
    $folders = ['invoices', 'vouchers', 'checks', 'customers', 'products', 'transactions', 'images'];
    foreach ($folders as $folder) {
        $path = $root . '/' . $folder;
        if (!is_dir($path)) mkdir($path, 0755, true);
    }
}

function saveCompressedData($data, $filename, $targetDir = null, $maxFiles = 10) {
    $saved = file_put_contents($filename, gzcompress(json_encode($data, JSON_UNESCAPED_UNICODE), 9));
    if ($saved !== false && $targetDir && is_dir($targetDir)) {
        $files = glob($targetDir . '/*.gz');
        if (count($files) > $maxFiles) {
            usort($files, function($a, $b) {
                return filemtime($b) - filemtime($a);
            });
            $toRemove = array_slice($files, $maxFiles);
            foreach ($toRemove as $rem) {
                @unlink($rem);
            }
        }
    }
    return $saved;
}

function loadCompressedData($filename) {
    if (!file_exists($filename)) return null;
    return json_decode(gzuncompress(file_get_contents($filename)), true);
}

createBackupStructure($BACKUP_ROOT);
createBackupStructure($DAILY_BACKUP_ROOT);

$action = $_POST['action'] ?? $_GET['action'] ?? '';

switch ($action) {
    case 'backup_data':
        $data = json_decode(file_get_contents('php://input'), true);
        $type = $data['type'] ?? 'general';
        $timestamp = date('Y-m-d_H-i-s');
        
        // بک‌آپ فوری (حداکثر 10 فایل)
        $targetFolder = $BACKUP_ROOT . '/' . $type;
        $filename = $targetFolder . '/' . $timestamp . '.gz';
        saveCompressedData($data['payload'], $filename, $targetFolder, 10);
        
        // بک‌آپ روزانه (حداکثر 10 فایل)
        $dailyFolder = $DAILY_BACKUP_ROOT . '/' . $type;
        $daily_filename = $dailyFolder . '/' . date('Y-m-d') . '.gz';
        saveCompressedData($data['payload'], $daily_filename, $dailyFolder, 10);
        
        echo json_encode(['success' => true, 'file' => basename($filename)]);
        break;
        
    case 'upload_image':
        if (isset($_FILES['image'])) {
            $folder = $_POST['folder'] ?? 'general';
            $target_dir = $IMAGES_ROOT . '/' . $folder . '/';
            if (!is_dir($target_dir)) mkdir($target_dir, 0755, true);
            
            $filename = uniqid() . '_' . basename($_FILES['image']['name']);
            $target_file = $target_dir . $filename;
            
            if (move_uploaded_file($_FILES['image']['tmp_name'], $target_file)) {
                echo json_encode(['success' => true, 'url' => '/uploads/' . $folder . '/' . $filename]);
            } else {
                echo json_encode(['success' => false, 'error' => 'Upload failed']);
            }
        }
        break;
        
    case 'daily_cleanup':
        // حذف فایل‌های قدیمی‌تر از 30 روز
        $cutoff = time() - (30 * 24 * 60 * 60);
        $folders = glob($DAILY_BACKUP_ROOT . '/*', GLOB_ONLYDIR);
        
        foreach ($folders as $folder) {
            $files = glob($folder . '/*.gz');
            foreach ($files as $file) {
                if (filemtime($file) < $cutoff) {
                    unlink($file);
                }
            }
        }
        echo json_encode(['success' => true, 'cleaned' => count($files ?? [])]);
        break;
        
    case 'get_backup_list':
        $type = $_GET['type'] ?? 'invoices';
        $files = glob($BACKUP_ROOT . '/' . $type . '/*.gz');
        $list = array_map(function($file) {
            return [
                'name' => basename($file),
                'size' => filesize($file),
                'date' => date('Y-m-d H:i:s', filemtime($file))
            ];
        }, $files);
        echo json_encode($list);
        break;
        
    default:
        echo json_encode(['error' => 'Invalid action']);
}
?>