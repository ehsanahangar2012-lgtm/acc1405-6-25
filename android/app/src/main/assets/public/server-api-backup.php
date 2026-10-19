<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Workspace-ID, X-Workspace-Token, X-Device-HWID');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$headers = function_exists('getallheaders') ? getallheaders() : [];
$workspaceHeader = '';
$tokenHeader = '';
$hwidHeader = '';
foreach ($headers as $name => $value) {
    if (strcasecmp($name, 'X-Workspace-ID') === 0) $workspaceHeader = $value;
    elseif (strcasecmp($name, 'X-Workspace-Token') === 0) $tokenHeader = $value;
    elseif (strcasecmp($name, 'X-Device-HWID') === 0) $hwidHeader = $value;
}
$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) $input = [];
$workspace = trim((string)($workspaceHeader ?: ($input['workspace_id'] ?? '')));
$token = trim((string)($tokenHeader ?: ($input['workspace_token'] ?? '')));
$hwid = trim((string)($hwidHeader ?: ($input['hwid'] ?? '')));
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

// Backups are separated by workspace. The mother portal retains the legacy master location.
$backupDir = ($workspace === 'default' || $workspace === 'main')
    ? __DIR__ . '/backup'
    : __DIR__ . '/backups/tenants/' . $workspace;
if (!is_dir($backupDir) && !mkdir($backupDir, 0700, true) && !is_dir($backupDir)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'BACKUP_STORAGE_UNAVAILABLE']);
    exit();
}
@chmod($backupDir, 0700);
$denyRule = "Options -Indexes\nDeny from all\n";
if (!is_file($backupDir . '/.htaccess')) @file_put_contents($backupDir . '/.htaccess', $denyRule, LOCK_EX);
if (($workspace === 'default' || $workspace === 'main')) {
    // Migrate the old index only for the mother portal, never into a customer tenant.
    $legacyDir = __DIR__ . '/backups';
    if (is_dir($legacyDir) && !file_exists($backupDir . '/backups_index.json') && file_exists($legacyDir . '/backups_index.json')) {
        @copy($legacyDir . '/backups_index.json', $backupDir . '/backups_index.json');
    }
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
