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

const SERVER_BACKUP_FORMAT = 'ASHKEGHALAM_SERVER_BACKUP_V1';

/**
 * Server at-rest encryption. The key is stored outside the backup directories and
 * excluded from deployment packages. If the key disappears while encrypted files
 * remain, fail closed rather than silently replacing it and losing old backups.
 */
function getServerBackupKey(): string {
    static $cachedKey = null;
    if (is_string($cachedKey) && strlen($cachedKey) === 32) return $cachedKey;
    if (!function_exists('openssl_encrypt') || !function_exists('openssl_decrypt')) {
        throw new RuntimeException('BACKUP_OPENSSL_UNAVAILABLE');
    }

    $environmentCandidate = null;
    $environmentKey = getenv('ASHK_BACKUP_ENCRYPTION_KEY');
    if ($environmentKey !== false && trim((string)$environmentKey) !== '') {
        $candidate = trim((string)$environmentKey);
        if (preg_match('/^[a-f0-9]{64}$/i', $candidate)) $environmentCandidate = hex2bin($candidate);
        else $environmentCandidate = base64_decode($candidate, true);
        if (!is_string($environmentCandidate) || strlen($environmentCandidate) !== 32) {
            throw new RuntimeException('BACKUP_ENCRYPTION_KEY_INVALID');
        }
    }

    // The key must be provided from outside the public web deployment tree.
    // No automatic key file is created under this directory because Nginx may ignore .htaccess.
    $keyFilePath = trim((string)(getenv('ASHK_BACKUP_ENCRYPTION_KEY_FILE') ?: ''));
    if (is_string($environmentCandidate)) {
        if ($keyFilePath !== '') {
            throw new RuntimeException('BACKUP_KEY_SOURCE_CONFLICT');
        }
        $cachedKey = $environmentCandidate;
        return $cachedKey;
    }
    if ($keyFilePath !== '') {
        $realKeyPath = realpath($keyFilePath);
        $documentRoot = realpath((string)($_SERVER['DOCUMENT_ROOT'] ?? ''));
        $codeRoot = realpath(__DIR__);
        if (!is_string($realKeyPath) || !is_file($realKeyPath)) {
            throw new RuntimeException('BACKUP_ENCRYPTION_KEY_FILE_INVALID');
        }
        if (($documentRoot !== false && ($realKeyPath === $documentRoot || str_starts_with($realKeyPath, rtrim($documentRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR))) ||
            ($codeRoot !== false && ($realKeyPath === $codeRoot || str_starts_with($realKeyPath, rtrim($codeRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR)))) {
            throw new RuntimeException('BACKUP_KEY_FILE_MUST_BE_OUTSIDE_WEB_ROOT');
        }
        $keyText = trim((string)@file_get_contents($realKeyPath));
        if (preg_match('/^[a-f0-9]{64}$/i', $keyText)) $key = hex2bin($keyText);
        else $key = base64_decode($keyText, true);
        if (!is_string($key) || strlen($key) !== 32) {
            throw new RuntimeException('BACKUP_ENCRYPTION_KEY_FILE_INVALID');
        }
        $cachedKey = $key;
        return $cachedKey;
    }

    // Fail closed when neither key source is configured; never write financial backups in plaintext.
    throw new RuntimeException('BACKUP_ENCRYPTION_KEY_MISSING');

}

function encryptServerBackupPayload(string $plainJson, string $workspace, string $id, string $key): string {
    $nonce = random_bytes(12);
    $tag = '';
    $aad = SERVER_BACKUP_FORMAT . '|' . $workspace . '|' . $id;
    $ciphertext = openssl_encrypt($plainJson, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $nonce, $tag, $aad, 16);
    if (!is_string($ciphertext) || strlen($tag) !== 16) {
        throw new RuntimeException('BACKUP_ENCRYPTION_FAILED');
    }
    $envelope = [
        'format' => SERVER_BACKUP_FORMAT,
        'version' => 1,
        'cipher' => 'AES-256-GCM',
        'workspace' => $workspace,
        'id' => $id,
        'nonce' => base64_encode($nonce),
        'tag' => base64_encode($tag),
        'ciphertext' => base64_encode($ciphertext)
    ];
    $encoded = json_encode($envelope, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if (!is_string($encoded)) throw new RuntimeException('BACKUP_ENVELOPE_ENCODING_FAILED');
    return $encoded;
}

/** Return decrypted JSON; null means the stored envelope is invalid or cannot be authenticated. */
function decryptServerBackupPayload(string $raw, string $workspace, string $expectedId, string $key): ?string {
    $envelope = json_decode($raw, true);
    if (!is_array($envelope) || ($envelope['format'] ?? '') !== SERVER_BACKUP_FORMAT) {
        // Prior releases stored ordinary JSON. It is migrated on the first request
        // authenticated to this workspace; all newly created files are encrypted.
        return $raw;
    }
    if (($envelope['version'] ?? null) !== 1 || ($envelope['cipher'] ?? '') !== 'AES-256-GCM' ||
        ($envelope['workspace'] ?? '') !== $workspace || ($envelope['id'] ?? '') !== $expectedId) {
        return null;
    }
    $nonce = base64_decode((string)($envelope['nonce'] ?? ''), true);
    $tag = base64_decode((string)($envelope['tag'] ?? ''), true);
    $ciphertext = base64_decode((string)($envelope['ciphertext'] ?? ''), true);
    if (!is_string($nonce) || strlen($nonce) !== 12 || !is_string($tag) || strlen($tag) !== 16 ||
        !is_string($ciphertext) || strlen($ciphertext) === 0 || strlen($ciphertext) > 50 * 1024 * 1024) {
        return null;
    }
    $aad = SERVER_BACKUP_FORMAT . '|' . $workspace . '|' . $expectedId;
    $plain = openssl_decrypt($ciphertext, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $nonce, $tag, $aad);
    return is_string($plain) ? $plain : null;
}

/**
 * Rebuild an index using metadata from the decrypted payload, but hash the stored
 * ciphertext for disk-integrity checks. Financial content itself never goes in the index.
 */
function rebuildIndex($backupDir, $indexPath, $maxFiles = 10, $workspace = '', $key = null) {
    if (!is_string($key) || strlen($key) !== 32) $key = getServerBackupKey();
    if ($workspace === '') throw new RuntimeException('BACKUP_WORKSPACE_MISSING');
    $files = glob($backupDir . '/backup_*.json') ?: [];
    $entries = [];
    foreach ($files as $file) {
        $storedContent = @file_get_contents($file);
        if (!is_string($storedContent)) continue;
        $fileBase = basename($file, '.json');
        $id = str_starts_with($fileBase, 'backup_') ? substr($fileBase, 7) : $fileBase;
        if (!preg_match('/^[a-zA-Z0-9_-]{1,160}$/', $id)) continue;
        $plainContent = decryptServerBackupPayload($storedContent, $workspace, $id, $key);
        if (!is_string($plainContent)) throw new RuntimeException('BACKUP_DECRYPT_OR_AUTHENTICATION_FAILED');
        $data = json_decode($plainContent, true);
        if (!is_array($data)) continue;
        $entries[] = [
            'id' => $id,
            'timestamp' => $data['timestamp'] ?? (filemtime($file) * 1000),
            'label' => $data['label'] ?? 'Manual Backup',
            'size' => strlen($storedContent),
            'type' => $data['type'] ?? 'auto',
            'checksum' => $data['checksum'] ?? '',
            'fileSha256' => hash('sha256', $storedContent),
            'version' => $data['version'] ?? '2.0.0',
            'hasAssets' => $data['hasAssets'] ?? false,
            'encryptedAtRest' => true,
            'encryption' => 'AES-256-GCM'
        ];
    }
    usort($entries, function($a, $b) { return $b['timestamp'] <=> $a['timestamp']; });

    if (count($entries) > $maxFiles) {
        $toRemove = array_slice($entries, $maxFiles);
        $entries = array_slice($entries, 0, $maxFiles);
        foreach ($toRemove as $rem) {
            $remFile = "$backupDir/backup_{$rem['id']}.json";
            if (is_file($remFile)) @unlink($remFile);
        }
    }
    $encoded = json_encode($entries, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    if (is_string($encoded) && !backupAtomicWrite($indexPath, $encoded)) {
        throw new RuntimeException('BACKUP_INDEX_WRITE_FAILED');
    }
    return $entries;
}

function migrateLegacyBackupFiles($backupDir, $workspace, $key): bool {
    $changed = false;
    $files = glob($backupDir . '/backup_*.json') ?: [];
    foreach ($files as $file) {
        $fileBase = basename($file, '.json');
        $id = str_starts_with($fileBase, 'backup_') ? substr($fileBase, 7) : $fileBase;
        if (!preg_match('/^[a-zA-Z0-9_-]{1,160}$/', $id)) continue;
        $raw = @file_get_contents($file);
        if (!is_string($raw)) throw new RuntimeException('BACKUP_READ_FAILED');
        $stored = json_decode($raw, true);
        if (is_array($stored) && ($stored['format'] ?? '') === SERVER_BACKUP_FORMAT) {
            $decrypted = decryptServerBackupPayload($raw, $workspace, $id, $key);
            if (!is_string($decrypted) || !is_array(json_decode($decrypted, true))) {
                throw new RuntimeException('BACKUP_DECRYPT_OR_AUTHENTICATION_FAILED');
            }
            continue;
        }
        if (!is_array($stored)) continue;
        $encrypted = encryptServerBackupPayload($raw, $workspace, $id, $key);
        if (!backupAtomicWrite($file, $encrypted)) throw new RuntimeException('BACKUP_MIGRATION_WRITE_FAILED');
        $changed = true;
    }
    return $changed;
}

// Existing files from prior app versions are migrated before any response or new write.
// When encryption is not available or the key is lost, fail closed rather than accepting
// another plaintext backup write or silently re-keying the stored ciphertext.
try {
    $backupKey = getServerBackupKey();
    if (migrateLegacyBackupFiles($backupDir, $workspace, $backupKey)) {
        rebuildIndex($backupDir, $indexPath, $MAX_BACKUP_FILES, $workspace, $backupKey);
    }
} catch (Throwable $error) {
    error_log('Server backup encryption unavailable: ' . ($error->getMessage() ?: 'unknown'));
    http_response_code(503);
    echo json_encode(['success' => false, 'error' => 'BACKUP_ENCRYPTION_UNAVAILABLE']);
    exit();
}

$action = $input['action'] ?? $_GET['action'] ?? '';

switch ($action) {
    case 'capabilities':
        echo json_encode([
            'success' => true,
            'backupEncryption' => 'AES-256-GCM',
            'encryptedAtRest' => true,
            'version' => 1
        ]);
        break;

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
        $storedJson = encryptServerBackupPayload($jsonData, $workspace, $id, $backupKey);
        if (strlen($storedJson) > 50 * 1024 * 1024) {
            http_response_code(413);
            echo json_encode(['success' => false, 'error' => 'BACKUP_TOO_LARGE']);
            break;
        }
        if (!backupAtomicWrite($filePath, $storedJson)) {
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
            'size' => strlen($storedJson),
            'type' => $input['type'] ?? 'auto',
            'checksum' => $input['checksum'] ?? '',
            'fileSha256' => hash('sha256', $storedJson),
            'version' => $input['version'] ?? '2.0.0',
            'hasAssets' => $input['hasAssets'] ?? false,
            'encryptedAtRest' => true,
            'encryption' => 'AES-256-GCM'
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
        echo json_encode(['success' => true, 'id' => $id, 'retained' => count($entries), 'encryptedAtRest' => true, 'encryption' => 'AES-256-GCM']);
        break;
        
    case 'list':
        $entries = [];
        if (file_exists($indexPath)) {
            $entries = json_decode(file_get_contents($indexPath), true);
            if (!is_array($entries)) {
                $entries = rebuildIndex($backupDir, $indexPath, $MAX_BACKUP_FILES, $workspace, $backupKey);
            }
        } else {
            $entries = rebuildIndex($backupDir, $indexPath, $MAX_BACKUP_FILES, $workspace, $backupKey);
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
        if (!is_array($entries)) $entries = rebuildIndex($backupDir, $indexPath, $MAX_BACKUP_FILES, $workspace, $backupKey);
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

        $plainBackup = decryptServerBackupPayload($rawBackup, $workspace, $id, $backupKey);
        if (!is_string($plainBackup)) {
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => 'BACKUP_DECRYPT_OR_AUTHENTICATION_FAILED']);
            break;
        }
        $content = json_decode($plainBackup, true);
        if (!is_array($content)) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'BACKUP_INVALID_JSON']);
            break;
        }
        echo json_encode([
            'success' => true,
            'data' => $content,
            'encryptedAtRest' => true,
            'encryption' => 'AES-256-GCM',
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
