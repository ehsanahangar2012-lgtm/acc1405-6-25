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

$backupDir = __DIR__ . '/backup';
if (!is_dir($backupDir)) {
    mkdir($backupDir, 0755, true);
}
// If old 'backups' folder exists, copy any files if needed
$legacyDir = __DIR__ . '/backups';
if (is_dir($legacyDir) && !file_exists($backupDir . '/backups_index.json') && file_exists($legacyDir . '/backups_index.json')) {
    @copy($legacyDir . '/backups_index.json', $backupDir . '/backups_index.json');
}

$indexPath = $backupDir . '/backups_index.json';
$MAX_BACKUP_FILES = 10;

// Helper function to rebuild index dynamically if it is missing
function rebuildIndex($backupDir, $indexPath, $maxFiles = 10) {
    $files = glob($backupDir . '/backup_*.json');
    $entries = [];
    foreach ($files as $file) {
        $content = file_get_contents($file);
        $data = json_decode($content, true);
        if (is_array($data)) {
            $id = $data['id'] ?? basename($file, '.json');
            $id = str_replace('backup_', '', $id);
            $entries[] = [
                'id' => $id,
                'timestamp' => $data['timestamp'] ?? (filemtime($file) * 1000),
                'label' => $data['label'] ?? 'Manual Backup',
                'size' => filesize($file),
                'type' => $data['type'] ?? 'auto',
                'checksum' => $data['checksum'] ?? '',
                'version' => $data['version'] ?? '2.0.0',
                'hasAssets' => $data['hasAssets'] ?? false
            ];
        }
    }
    usort($entries, function($a, $b) {
        return $b['timestamp'] - $a['timestamp'];
    });

    // Enforce 10 files limit
    if (count($entries) > $maxFiles) {
        $toRemove = array_slice($entries, $maxFiles);
        $entries = array_slice($entries, 0, $maxFiles);
        foreach ($toRemove as $rem) {
            $remFile = "$backupDir/backup_{$rem['id']}.json";
            if (file_exists($remFile)) {
                @unlink($remFile);
            }
        }
    }

    file_put_contents($indexPath, json_encode($entries, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    return $entries;
}

$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? $_GET['action'] ?? '';

switch ($action) {
    case 'create':
        $id = $input['id'] ?? '';
        $id = preg_replace('/[^a-zA-Z0-9_\-]/', '', $id);
        if (empty($id)) {
            $id = 'backup_' . date('Ymd_His') . '_' . uniqid();
        }
        
        $filePath = "$backupDir/backup_$id.json";
        
        // Write the full backup file
        $jsonData = json_encode($input, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        if (file_put_contents($filePath, $jsonData) === false) {
            echo json_encode(['success' => false, 'message' => 'Failed to write backup file']);
            break;
        }
        
        // Update the index
        $entries = [];
        if (file_exists($indexPath)) {
            $entries = json_decode(file_get_contents($indexPath), true);
            if (!is_array($entries)) $entries = [];
        }
        
        $entry = [
            'id' => $id,
            'timestamp' => $input['timestamp'] ?? (time() * 1000),
            'label' => $input['label'] ?? 'Manual Backup',
            'size' => strlen($jsonData),
            'type' => $input['type'] ?? 'auto',
            'checksum' => $input['checksum'] ?? '',
            'version' => $input['version'] ?? '2.0.0',
            'hasAssets' => $input['hasAssets'] ?? false
        ];
        
        $found = false;
        foreach ($entries as $i => $e) {
            if ($e['id'] === $id) {
                $entries[$i] = $entry;
                $found = true;
                break;
            }
        }
        if (!$found) {
            $entries[] = $entry;
        }
        
        // Sort descending by timestamp
        usort($entries, function($a, $b) {
            return $b['timestamp'] - $a['timestamp'];
        });
        
        // Keep at most 10 backups
        if (count($entries) > $MAX_BACKUP_FILES) {
            $toRemove = array_slice($entries, $MAX_BACKUP_FILES);
            $entries = array_slice($entries, 0, $MAX_BACKUP_FILES);
            foreach ($toRemove as $rem) {
                $remFile = "$backupDir/backup_{$rem['id']}.json";
                if (file_exists($remFile)) {
                    @unlink($remFile);
                }
            }
        }
        
        // Also cleanup any orphan backup files exceeding 10 files
        $existingFiles = glob($backupDir . '/backup_*.json');
        if (count($existingFiles) > $MAX_BACKUP_FILES) {
            $indexedIds = array_column($entries, 'id');
            foreach ($existingFiles as $ef) {
                $fileId = str_replace(['backup_', '.json'], '', basename($ef));
                if (!in_array($fileId, $indexedIds)) {
                    @unlink($ef);
                }
            }
        }
        
        file_put_contents($indexPath, json_encode($entries, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        echo json_encode(['success' => true, 'id' => $id, 'retained' => count($entries)]);
        break;
        
    case 'list':
        $entries = [];
        if (file_exists($indexPath)) {
            $entries = json_decode(file_get_contents($indexPath), true);
            if (!is_array($entries)) {
                $entries = rebuildIndex($backupDir, $indexPath);
            }
        } else {
            $entries = rebuildIndex($backupDir, $indexPath);
        }
        echo json_encode(['success' => true, 'backups' => $entries]);
        break;
        
    case 'restore':
        $id = $_GET['id'] ?? '';
        $id = preg_replace('/[^a-zA-Z0-9_\-]/', '', $id);
        $filePath = "$backupDir/backup_$id.json";
        
        if (empty($id) || !file_exists($filePath)) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Backup not found']);
        } else {
            $content = json_decode(file_get_contents($filePath), true);
            echo json_encode(['success' => true, 'data' => $content]);
        }
        break;
        
    case 'delete':
        $id = $input['id'] ?? '';
        $id = preg_replace('/[^a-zA-Z0-9_\-]/', '', $id);
        $filePath = "$backupDir/backup_$id.json";
        
        if (file_exists($filePath)) {
            unlink($filePath);
        }
        
        // Update the index
        if (file_exists($indexPath)) {
            $entries = json_decode(file_get_contents($indexPath), true);
            if (is_array($entries)) {
                $entries = array_values(array_filter($entries, function($e) use ($id) {
                    return $e['id'] !== $id;
                }));
                file_put_contents($indexPath, json_encode($entries, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            }
        }
        
        echo json_encode(['success' => true]);
        break;
        
    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid action']);
}
