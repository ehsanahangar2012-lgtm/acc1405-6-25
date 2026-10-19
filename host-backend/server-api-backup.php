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
$rawInput = file_get_contents('php://input');
if (!is_string($rawInput)) $rawInput = '';
if (strlen($rawInput) > 50 * 1024 * 1024) {
    http_response_code(413);
    echo json_encode(['success' => false, 'error' => 'BACKUP_TOO_LARGE']);
    exit();
}
$input = json_decode($rawInput, true);
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

function backupAtomicWrite(string $path, string $content): bool {
    $temp = $path . '.tmp.' . bin2hex(random_bytes(8));
    $written = @file_put_contents($temp, $content, LOCK_EX);
    if ($written !== strlen($content)) {
        if (is_file($temp)) @unlink($temp);
        return false;
    }
    @chmod($temp, 0600);
    if (!@rename($temp, $path)) {
        @unlink($temp);
        return false;
    }
    @chmod($path, 0600);
    return true;
}

// Rebuild the index from the actual filenames. A client-supplied ID must never
// change the path used to restore or prune a backup.
function rebuildIndex($backupDir, $indexPath, $maxFiles = 10) {
    $files = glob($backupDir . '/backup_*.json') ?: [];
    $entries = [];
    foreach ($files as $file) {
        $content = @file_get_contents($file);
        if (!is_string($content)) continue;
        $data = json_decode($content, true);
        if (!is_array($data)) continue;

        $fileBase = basename($file, '.json');
        $id = str_starts_with($fileBase, 'backup_') ? substr($fileBase, 7) : $fileBase;
        if (!preg_match('/^[a-zA-Z0-9_-]{1,160}$/', $id)) continue;

        $entries[] = [
            'id' => $id,
            'timestamp' => $data['timestamp'] ?? (filemtime($file) * 1000),
            'label' => $data['label'] ?? 'Manual Backup',
            'size' => strlen($content),
            'type' => $data['type'] ?? 'auto',
            'checksum' => $data['checksum'] ?? '',
            'fileSha256' => hash('sha256', $content),
            'version' => $data['version'] ?? '2.0.0',
            'hasAssets' => $data['hasAssets'] ?? false
        ];
    }
    usort($entries, function($a, $b) {
        return $b['timestamp'] <=> $a['timestamp'];
    });

    if (count($entries) > $maxFiles) {
        $toRemove = array_slice($entries, $maxFiles);
        $entries = array_slice($entries, 0, $maxFiles);
        foreach ($toRemove as $rem) {
            $remFile = "$backupDir/backup_{$rem['id']}.json";
            if (is_file($remFile)) @unlink($remFile);
        }
    }

    $encoded = json_encode($entries, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    if (is_string($encoded)) backupAtomicWrite($indexPath, $encoded);
    return $entries;
}

$action = $input['action'] ?? $_GET['action'] ?? '';

switch ($action) {
    case 'create':
        $requestedId = is_string($input['id'] ?? null) ? $input['id'] : '';
        $id = substr((string)preg_replace('/[^a-zA-Z0-9_\-]/', '', $requestedId), 0, 160);
        if ($id === '') {
            $id = 'backup_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4));
        }
        $input['id'] = $id;
        $filePath = "$backupDir/backup_$id.json";

        $jsonData = json_encode($input, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        if (!is_string($jsonData)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'BACKUP_ENCODING_FAILED']);
            break;
        }
        if (strlen($jsonData) > 50 * 1024 * 1024) {
            http_response_code(413);
            echo json_encode(['success' => false, 'error' => 'BACKUP_TOO_LARGE']);
            break;
        }
        if (!backupAtomicWrite($filePath, $jsonData)) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'BACKUP_WRITE_FAILED']);
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
            'fileSha256' => hash('sha256', $jsonData),
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
                $fileBase = basename($ef, '.json');
                $fileId = str_starts_with($fileBase, 'backup_') ? substr($fileBase, 7) : $fileBase;
                if (!in_array($fileId, $indexedIds, true)) {
                    @unlink($ef);
                }
            }
        }
        
        $encodedIndex = json_encode($entries, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        if (!is_string($encodedIndex) || !backupAtomicWrite($indexPath, $encodedIndex)) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'BACKUP_INDEX_WRITE_FAILED']);
            break;
        }
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
        $requestedId = is_string($_GET['id'] ?? null) ? $_GET['id'] : '';
        $id = substr((string)preg_replace('/[^a-zA-Z0-9_\-]/', '', $requestedId), 0, 160);
        $filePath = "$backupDir/backup_$id.json";

        if ($id === '' || !is_file($filePath)) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Backup not found']);
            break;
        }

        $rawBackup = @file_get_contents($filePath);
        if (!is_string($rawBackup)) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'BACKUP_READ_FAILED']);
            break;
        }

        $entries = is_file($indexPath) ? json_decode((string)@file_get_contents($indexPath), true) : null;
        if (!is_array($entries)) $entries = rebuildIndex($backupDir, $indexPath, $MAX_BACKUP_FILES);
        $expectedHash = null;
        foreach ($entries as $entry) {
            if (is_array($entry) && ($entry['id'] ?? null) === $id && is_string($entry['fileSha256'] ?? null)) {
                $expectedHash = $entry['fileSha256'];
                break;
            }
        }
        $actualHash = hash('sha256', $rawBackup);
        if (is_string($expectedHash) && $expectedHash !== '' && !hash_equals($expectedHash, $actualHash)) {
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => 'BACKUP_INTEGRITY_FAILED']);
            break;
        }

        $content = json_decode($rawBackup, true);
        if (!is_array($content)) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'BACKUP_INVALID_JSON']);
            break;
        }
        echo json_encode([
            'success' => true,
            'data' => $content,
            'integrity' => [
                'algorithm' => 'sha256',
                'verified' => is_string($expectedHash) && $expectedHash !== ''
            ]
        ]);
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
                $encodedIndex = json_encode($entries, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
                if (is_string($encodedIndex) && !backupAtomicWrite($indexPath, $encodedIndex)) {
                    http_response_code(500);
                    echo json_encode(['success' => false, 'error' => 'BACKUP_INDEX_WRITE_FAILED']);
                    break;
                }
            }
        }
        
        echo json_encode(['success' => true]);
        break;
        
    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid action']);
}
