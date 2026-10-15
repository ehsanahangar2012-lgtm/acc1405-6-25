<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// تنظیمات
$BACKUP_ROOT = __DIR__ . '/backups';
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

function saveCompressedData($data, $filename) {
    return file_put_contents($filename, gzcompress(json_encode($data, JSON_UNESCAPED_UNICODE), 9));
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
        
        // بک‌آپ فوری
        $filename = $BACKUP_ROOT . '/' . $type . '/' . $timestamp . '.gz';
        saveCompressedData($data['payload'], $filename);
        
        // بک‌آپ روزانه
        $daily_filename = $DAILY_BACKUP_ROOT . '/' . $type . '/' . date('Y-m-d') . '.gz';
        saveCompressedData($data['payload'], $daily_filename);
        
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