<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

function getEnvVar($key, $default = '') {
    $envFile = __DIR__ . '/.env.local';
    if (file_exists($envFile)) {
        $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            if (strpos(trim($line), '#') === 0) continue;
            $parts = explode('=', $line, 2);
            if (count($parts) === 2 && trim($parts[0]) === $key) {
                return trim($parts[1]);
            }
        }
    }
    return getenv($key) ?: $default;
}

$expectedToken = getEnvVar('VITE_API_TOKEN');

$authHeader = '';
$headers = getallheaders();
if (is_array($headers)) {
    foreach ($headers as $name => $value) {
        if (strcasecmp($name, 'Authorization') === 0) {
            $authHeader = $value;
            break;
        }
    }
}
if (empty($authHeader) && isset($_SERVER['HTTP_AUTHORIZATION'])) {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
}
if (empty($authHeader) && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
    $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
}

$providedToken = '';
if (!empty($authHeader)) {
    if (preg_match('/Bearer\s(\S+)/i', $authHeader, $matches)) {
        $providedToken = $matches[1];
    } else {
        $providedToken = str_replace('Bearer ', '', $authHeader);
    }
}

if (empty($expectedToken) || $providedToken !== $expectedToken) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit();
}

$dataDir = __DIR__ . '/host-data';
if (!is_dir($dataDir)) mkdir($dataDir, 0755, true);

$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? $_GET['action'] ?? '';

function saveData($table, $data) {
    global $dataDir;
    $table = preg_replace('/[^a-zA-Z0-9_\-]/', '', $table);
    if (empty($table)) return false;
    $file = "$dataDir/$table.json";
    
    // باز کردن یا ایجاد فایل
    $fp = fopen($file, 'c+');
    if (!$fp) return false;
    
    // اعمال قفل انحصاری (Exclusive lock) برای جلوگیری از تداخل نوشتن
    if (flock($fp, LOCK_EX)) {
        $size = filesize($file);
        $content = '';
        if ($size > 0) {
            $content = fread($fp, $size);
        }
        $existing = json_decode($content, true);
        if (!is_array($existing)) $existing = [];
        
        if (isset($data['id'])) {
            $found = false;
            foreach ($existing as $i => $item) {
                if (isset($item['id']) && $item['id'] === $data['id']) {
                    $existing[$i] = array_merge($item, $data);
                    $found = true;
                    break;
                }
            }
            if (!$found) $existing[] = $data;
        } else {
            $data['id'] = uniqid('host_', true);
            $existing[] = $data;
        }
        
        // خالی کردن فایل و بازنشانی نشانگر
        ftruncate($fp, 0);
        rewind($fp);
        $result = fwrite($fp, json_encode($existing, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        
        // آزادسازی قفل و بستن فایل
        flock($fp, LOCK_UN);
        fclose($fp);
        return $result !== false;
    } else {
        fclose($fp);
        return false;
    }
}

function getData($table, $id = null) {
    global $dataDir;
    $table = preg_replace('/[^a-zA-Z0-9_\-]/', '', $table);
    if (empty($table)) return $id ? null : [];
    $file = "$dataDir/$table.json";
    if (!file_exists($file)) return $id ? null : [];
    
    $fp = fopen($file, 'r');
    if (!$fp) return $id ? null : [];
    
    $data = [];
    // اعمال قفل مشترک (Shared lock) برای خواندن همزمان بدون تداخل با نوشتن
    if (flock($fp, LOCK_SH)) {
        $size = filesize($file);
        $content = '';
        if ($size > 0) {
            $content = fread($fp, $size);
        }
        $data = json_decode($content, true);
        flock($fp, LOCK_UN);
    }
    fclose($fp);
    
    if (!is_array($data)) return $id ? null : [];
    
    if ($id) {
        foreach ($data as $item) {
            if (isset($item['id']) && $item['id'] === $id) return $item;
        }
        return null;
    }
    return $data;
}

function deleteData($table, $id) {
    global $dataDir;
    $table = preg_replace('/[^a-zA-Z0-9_\-]/', '', $table);
    if (empty($table)) return false;
    $file = "$dataDir/$table.json";
    if (!file_exists($file)) return false;
    
    $fp = fopen($file, 'c+');
    if (!$fp) return false;
    
    // اعمال قفل انحصاری (Exclusive lock) برای فرآیند حذف داده‌ها
    if (flock($fp, LOCK_EX)) {
        $size = filesize($file);
        $content = '';
        if ($size > 0) {
            $content = fread($fp, $size);
        }
        $data = json_decode($content, true);
        if (!is_array($data)) $data = [];
        
        $data = array_filter($data, fn($item) => !isset($item['id']) || $item['id'] !== $id);
        
        ftruncate($fp, 0);
        rewind($fp);
        $result = fwrite($fp, json_encode(array_values($data), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        
        flock($fp, LOCK_UN);
        fclose($fp);
        return $result !== false;
    } else {
        fclose($fp);
        return false;
    }
}

switch ($action) {
    case 'status':
        echo json_encode([
            'success' => true,
            'version' => '2.0.0',
            'phpVersion' => phpversion(),
            'diskSpace' => disk_free_space('.') ? round(disk_free_space('.') / 1024 / 1024 / 1024, 2) . ' GB' : 'Unknown',
            'lastBackup' => file_exists("$dataDir/last_backup.txt") ? file_get_contents("$dataDir/last_backup.txt") : 'Never',
            'timestamp' => date('Y-m-d H:i:s')
        ]);
        break;
    
    case 'list_files':
        $files = [];
        foreach (glob("$dataDir/*.json") as $file) {
            $files[] = [
                'name' => basename($file),
                'size' => filesize($file),
                'modified' => date('Y-m-d H:i:s', filemtime($file)),
                'type' => 'data'
            ];
        }
        echo json_encode(['success' => true, 'files' => $files]);
        break;
    
    case 'read_file':
        $filename = basename($_GET['file'] ?? '');
        $filepath = "$dataDir/$filename";
        if (!empty($filename) && file_exists($filepath) && pathinfo($filepath, PATHINFO_EXTENSION) === 'json') {
            $content = json_decode(file_get_contents($filepath), true);
            echo json_encode(['success' => true, 'content' => $content]);
        } else {
            echo json_encode(['success' => false, 'error' => 'File not found']);
        }
        break;
    
    case 'save':
        $table = $input['table'] ?? null;
        $data = $input['data'] ?? null;
        if (!$table || !$data) {
            echo json_encode(['success' => false, 'error' => 'Missing table or data']);
        } else {
            $result = saveData($table, $data);
            echo json_encode(['success' => $result, 'message' => $result ? 'Data saved' : 'Failed to save']);
        }
        break;
    
    case 'get':
        $table = $input['table'] ?? $_GET['table'];
        $id = $input['id'] ?? $_GET['id'] ?? null;
        echo json_encode(['success' => true, 'data' => getData($table, $id)]);
        break;
    
    case 'delete':
        $table = $input['table'] ?? null;
        $id = $input['id'] ?? null;
        if (!$table || !$id) {
            echo json_encode(['success' => false, 'error' => 'Missing table or id']);
        } else {
            $result = deleteData($table, $id);
            echo json_encode(['success' => $result, 'message' => $result ? 'Data deleted' : 'Failed to delete']);
        }
        break;
    
    case 'sync':
        $synced = 0;
        $failed = 0;
        $data = $input['data'] ?? [];
        if (!is_array($data)) {
            echo json_encode(['success' => false, 'error' => 'Invalid data format']);
            break;
        }
        foreach ($data as $item) {
            if (isset($item['table']) && isset($item['data'])) {
                if (saveData($item['table'], $item['data'])) {
                    $synced++;
                } else {
                    $failed++;
                }
            } else {
                $failed++;
            }
        }
        echo json_encode(['success' => true, 'synced' => $synced, 'failed' => $failed]);
        break;
    
    case 'backup':
        $backup = [];
        foreach (glob("$dataDir/*.json") as $file) {
            $table = basename($file, '.json');
            $backup[$table] = json_decode(file_get_contents($file), true);
        }
        file_put_contents("$dataDir/last_backup.txt", date('Y-m-d H:i:s'));
        echo json_encode(['success' => true, 'backup' => $backup, 'timestamp' => date('Y-m-d H:i:s')]);
        break;
    
    default:
        echo json_encode(['error' => 'Invalid action']);
}
