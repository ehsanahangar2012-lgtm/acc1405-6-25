<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Workspace-ID, X-Workspace-Token, X-Device-HWID, X-Admin-Secret');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$dbFile = __DIR__ . '/data/acc_database.db';
$dataDir = __DIR__ . '/data';

if (!file_exists($dataDir)) {
    mkdir($dataDir, 0755, true);
}

try {
    $db = new PDO('sqlite:' . $dbFile);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Create tables if not exist
    $db->exec("
        CREATE TABLE IF NOT EXISTS app_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data_key TEXT UNIQUE NOT NULL,
            data_value TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");
    
    $method = $_SERVER['REQUEST_METHOD'];
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $_GET['action'] ?? ($input['action'] ?? null);

    // Health / Status Check
    if ($action === 'health' || $action === 'status') {
        echo json_encode([
            'status' => 'online',
            'version' => '15.2.0',
            'database' => 'sqlite',
            'timestamp' => date('Y-m-d H:i:s'),
            'server' => 'Ashke Ghalam Cloud Host Backend & Company Vault'
        ]);
        exit;
    }

    // Every non-health endpoint requires a registered tenant credential + bound HWID,
    // or the mother portal's server-held admin secret. Never allow global anonymous CRUD.
    $requestHeaders = function_exists('getallheaders') ? getallheaders() : [];
    $headerValue = static function (string $name) use ($requestHeaders): string {
        foreach ($requestHeaders as $key => $value) {
            if (strcasecmp((string)$key, $name) === 0) return (string)$value;
        }
        $serverKey = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
        return isset($_SERVER[$serverKey]) ? (string)$_SERVER[$serverKey] : '';
    };
    $workspaceId = trim($headerValue('X-Workspace-ID') ?: (string)($input['workspace_id'] ?? ''));
    $workspaceToken = trim($headerValue('X-Workspace-Token') ?: (string)($input['workspace_token'] ?? ''));
    $deviceHwid = trim($headerValue('X-Device-HWID') ?: (string)($input['hwid'] ?? ''));
    if ($workspaceId === '' || $workspaceToken === '') {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'AUTH_REQUIRED', 'message' => 'برای این عملیات، اعتبارنامهٔ معتبر فضای کاری لازم است.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    require_once __DIR__ . '/license_validator.php';
    $isMotherWorkspace = in_array($workspaceId, ['default', 'main'], true);
    $access = LicenseValidator::validateAccess($workspaceId, $workspaceToken, $isMotherWorkspace ? null : $deviceHwid);
    if (empty($access['allowed'])) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error' => 'ACCESS_DENIED',
            'status' => $access['status'] ?? 'FORBIDDEN',
            'message' => $access['message'] ?? 'دسترسی به این API مجاز نیست.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $isMotherAdmin = $isMotherWorkspace && (($access['role'] ?? '') === 'SUPER_ADMIN');
    $tenantActions = ['support_chat', 'send_invoice_sms'];
    if (!$isMotherAdmin && !in_array($action, $tenantActions, true)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'MOTHER_PORTAL_ONLY', 'message' => 'این API قدیمی فقط برای مدیر احرازشدهٔ پرتال مادر در دسترس است.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Small file-backed rate limit. Fail closed if the limit store cannot be locked/written.
    $consumeApiRateLimit = static function (string $key, int $limit, int $windowSeconds): bool {
        $path = __DIR__ . '/data/api_rate_limits.json';
        $lock = @fopen($path . '.lock', 'c');
        if ($lock === false || !flock($lock, LOCK_EX)) {
            if (is_resource($lock)) fclose($lock);
            return false;
        }
        @chmod($path . '.lock', 0600);
        $all = json_decode((string)@file_get_contents($path), true);
        if (!is_array($all)) $all = [];
        $now = time();
        $events = array_values(array_filter($all[$key] ?? [], static fn($ts) => is_int($ts) && $ts > $now - $windowSeconds));
        if (count($events) >= $limit) {
            $all[$key] = $events;
            flock($lock, LOCK_UN);
            fclose($lock);
            return false;
        }
        $events[] = $now;
        $all[$key] = $events;
        $encoded = json_encode($all, JSON_UNESCAPED_SLASHES);
        $ok = $encoded !== false && @file_put_contents($path, $encoded, LOCK_EX) !== false;
        if ($ok) @chmod($path, 0600);
        flock($lock, LOCK_UN);
        fclose($lock);
        return $ok;
    };
    $rateIdentity = hash('sha256', $workspaceId . '|' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));

    // Support Chat & Mobile Notification API (ذخیره‌سازی پیام‌ها در هاست مادر، اعلان به موبایل و وضعیت آنلاین)
    if ($action === 'support_chat') {
        $chatFile = __DIR__ . '/data/support_chat.json';
        if ($method === 'GET') {
            $stmt = $db->prepare("SELECT data_value FROM app_data WHERE data_key = 'support_chat_messages'");
            $stmt->execute();
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            $messages = $result ? json_decode($result['data_value'], true) : [];
            if (empty($messages) && file_exists($chatFile)) {
                $messages = json_decode(file_get_contents($chatFile), true) ?: [];
            }
            if (!is_array($messages)) $messages = [];
            // Customers can read only their own workspace's messages; legacy unscoped messages
            // are intentionally hidden from client tenants to prevent historical cross-tenant leaks.
            if (!$isMotherAdmin) {
                $messages = array_values(array_filter($messages, static fn($m) =>
                    is_array($m) && (string)($m['workspace_id'] ?? '') === $workspaceId
                ));
            }
            echo json_encode([
                'success' => true,
                'status' => 'online',
                'server_time' => date('Y-m-d H:i:s'),
                'messages' => $messages,
                'unread_count' => 0
            ]);
            exit;
        } else if ($method === 'POST') {
            $messageText = trim((string)($input['text'] ?? ''));
            $senderName = trim((string)($input['senderName'] ?? 'کاربر سیستم'));
            $phone = trim((string)($input['phone'] ?? ''));
            if ($messageText === '' || mb_strlen($messageText, 'UTF-8') > 5000 || mb_strlen($senderName, 'UTF-8') > 120 || strlen($phone) > 40) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'INVALID_MESSAGE', 'message' => 'متن، نام فرستنده یا شماره تماس معتبر نیست.'], JSON_UNESCAPED_UNICODE);
                exit;
            }
            if (!$consumeApiRateLimit('support_chat:' . $rateIdentity, 10, 300)) {
                http_response_code(429);
                echo json_encode(['success' => false, 'error' => 'RATE_LIMITED', 'message' => 'تعداد پیام‌ها بیش از حد مجاز است.'], JSON_UNESCAPED_UNICODE);
                exit;
            }

            $messageWorkspaceId = $workspaceId;
            $sender = 'user';
            if ($isMotherAdmin) {
                $targetWorkspaceId = trim((string)($input['target_workspace_id'] ?? ''));
                $registry = json_decode((string)@file_get_contents(__DIR__ . '/data/workspaces_auth.json'), true);
                if ($targetWorkspaceId === '' || in_array($targetWorkspaceId, ['default', 'main'], true) ||
                    !is_array($registry) || !isset($registry['workspaces'][$targetWorkspaceId])) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'SUPPORT_TARGET_REQUIRED', 'message' => 'برای پاسخ‌گویی، فضای کاری مشتری را انتخاب کنید.'], JSON_UNESCAPED_UNICODE);
                    exit;
                }
                $messageWorkspaceId = $targetWorkspaceId;
                $sender = 'support';
                if (!empty($registry['workspaces'][$targetWorkspaceId]['status']) && $registry['workspaces'][$targetWorkspaceId]['status'] !== 'ACTIVE') {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'error' => 'SUPPORT_TARGET_INACTIVE', 'message' => 'فضای کاری انتخاب‌شده فعال نیست.'], JSON_UNESCAPED_UNICODE);
                    exit;
                }
            }

            // Get existing messages
            $stmt = $db->prepare("SELECT data_value FROM app_data WHERE data_key = 'support_chat_messages'");
            $stmt->execute();
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            $messages = $result ? json_decode($result['data_value'], true) : [];

            $newMsg = [
                'id' => uniqid('msg_', true),
                'workspace_id' => $messageWorkspaceId,
                'text' => $messageText,
                'sender' => $sender,
                'senderName' => $senderName,
                'phone' => $sender === 'user' ? $phone : '',
                'timestamp' => date('Y-m-d H:i:s'),
                'synced_to_mother' => true
            ];
            $messages[] = $newMsg;

            // Keep last 100 messages
            if (count($messages) > 100) {
                $messages = array_slice($messages, -100);
            }

            $stmt = $db->prepare("
                INSERT INTO app_data (data_key, data_value, updated_at) 
                VALUES ('support_chat_messages', ?, CURRENT_TIMESTAMP)
                ON CONFLICT(data_key) DO UPDATE SET 
                    data_value = excluded.data_value,
                    updated_at = CURRENT_TIMESTAMP
            ");
            $stmt->execute([json_encode($messages, JSON_UNESCAPED_UNICODE)]);
            file_put_contents($chatFile, json_encode($messages, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

            // ارسال اعلان پیامک به موبایل پشتیبان در صورت ارسال پیام کاربر
            $smsNotified = false;
            if ($sender === 'user' && !empty($phone)) {
                require_once __DIR__ . '/sms-helper.php';
                $adminPhone = '09120000000'; // شماره پیشفرض ادمین در سیستم
                $alertText = "پیام جدید پشتیبانی از طرف {$senderName} ({$phone}): " . mb_substr($messageText, 0, 40) . "...";
                @SMSHelper::sendSMS($adminPhone, $alertText);
                $smsNotified = true;
            }

            echo json_encode([
                'success' => true,
                'message' => 'پیام با موفقیت در سرور مادر ذخیره شد',
                'newMessage' => $newMsg,
                'sms_notified' => $smsNotified,
                'server_status' => 'online'
            ]);
            exit;
        }
    }

    // ارسال پیامک صورتحساب به مشتری همراه با لینک امضا و پرداخت
    if ($action === 'send_invoice_sms') {
        if ($method === 'POST') {
            if (!$consumeApiRateLimit('invoice_sms:' . $rateIdentity, 20, 3600)) {
                http_response_code(429);
                echo json_encode(['success' => false, 'error' => 'RATE_LIMITED', 'message' => 'سقف ارسال پیامک این فضای کاری در بازهٔ زمانی فعلی تکمیل شده است.'], JSON_UNESCAPED_UNICODE);
                exit;
            }
            $phone = trim((string)($input['phone'] ?? ''));
            $message = trim((string)($input['message'] ?? ''));
            if (strlen($phone) > 40 || mb_strlen($message, 'UTF-8') > 1000) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'INVALID_SMS_PAYLOAD'], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            if (empty($phone) || empty($message)) {
                http_response_code(400);
                echo json_encode(['error' => 'شماره همراه و متن پیامک الزامی است.']);
                exit;
            }

            require_once __DIR__ . '/sms-helper.php';
            $sent = SMSHelper::sendSMS($phone, $message);

            echo json_encode([
                'success' => $sent,
                'target' => $phone,
                'message' => $sent ? 'پیامک با موفقیت ارسال شد.' : 'پیامک با موفقیت ثبت یا ارسال شد.'
            ]);
            exit;
        }
    }

    // Company Vault & Dedicated Asset Storage
    if ($action === 'company_vault') {
        $companiesDir = __DIR__ . '/uploads/companies';
        if (!file_exists($companiesDir)) mkdir($companiesDir, 0755, true);

        if ($method === 'POST') {
            $companies = $input['companies'] ?? [];
            $stmt = $db->prepare("
                INSERT INTO app_data (data_key, data_value, updated_at) 
                VALUES ('companies_vault', ?, CURRENT_TIMESTAMP)
                ON CONFLICT(data_key) DO UPDATE SET 
                    data_value = excluded.data_value,
                    updated_at = CURRENT_TIMESTAMP
            ");
            $stmt->execute([json_encode($companies, JSON_UNESCAPED_UNICODE)]);
            file_put_contents(__DIR__ . '/data/companies_vault.json', json_encode($companies, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            echo json_encode(['success' => true, 'count' => count($companies), 'message' => 'اطلاعات و مستندات شرکت‌ها با موفقیت در بخش مجزای هاست ذخیره شد.']);
            exit;
        } else if ($method === 'GET') {
            $stmt = $db->prepare("SELECT data_value FROM app_data WHERE data_key = 'companies_vault'");
            $stmt->execute();
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            $companies = $result ? json_decode($result['data_value']) : [];
            echo json_encode(['success' => true, 'companies' => $companies]);
            exit;
        }
    }

    // Background Backup Action
    if ($action === 'background_backup') {
        $backupsDir = __DIR__ . '/backups/auto';
        if (!file_exists($backupsDir)) mkdir($backupsDir, 0755, true);
        if ($method === 'POST') {
            $payload = $input['payload'] ?? [];
            $backupFilename = 'backup_' . date('Ymd_His') . '.json.gz';
            $backupPath = $backupsDir . '/' . $backupFilename;
            file_put_contents($backupPath, gzencode(json_encode($payload, JSON_UNESCAPED_UNICODE), 9));
            
            // Prune old backups keeping last 14
            $existing = glob($backupsDir . '/*.gz');
            if (count($existing) > 14) {
                usort($existing, function($a, $b) { return filemtime($a) - filemtime($b); });
                while (count($existing) > 14) {
                    $oldest = array_shift($existing);
                    if ($oldest) @unlink($oldest);
                }
            }
            
            echo json_encode([
                'success' => true, 
                'backupId' => $backupFilename, 
                'timestamp' => date('Y-m-d H:i:s'),
                'size' => filesize($backupPath)
            ]);
            exit;
        }
    }

    // Mobile Sync / Batch Sync Action
    if ($action === 'mobile_sync' || $action === 'batch_sync') {
        if ($method === 'POST' && isset($input['records']) && is_array($input['records'])) {
            $db->beginTransaction();
            try {
                $stmt = $db->prepare("
                    INSERT INTO app_data (data_key, data_value, updated_at) 
                    VALUES (?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(data_key) DO UPDATE SET 
                        data_value = excluded.data_value,
                        updated_at = CURRENT_TIMESTAMP
                ");
                $savedCount = 0;
                foreach ($input['records'] as $item) {
                    if (isset($item['key']) && isset($item['value'])) {
                        $stmt->execute([$item['key'], json_encode($item['value'])]);
                        $savedCount++;
                    }
                }
                $db->commit();
                echo json_encode(['success' => true, 'syncedCount' => $savedCount, 'version' => '15.0.0']);
            } catch (Exception $e) {
                $db->rollBack();
                http_response_code(500);
                echo json_encode(['error' => 'Batch sync failed: ' . $e->getMessage()]);
            }
            exit;
        }
    }

    switch ($method) {
        case 'GET':
            // Get all data or specific key
            if (isset($_GET['key'])) {
                $stmt = $db->prepare("SELECT data_value FROM app_data WHERE data_key = ?");
                $stmt->execute([$_GET['key']]);
                $result = $stmt->fetch(PDO::FETCH_ASSOC);
                echo json_encode($result ? json_decode($result['data_value']) : null);
            } else {
                $stmt = $db->query("SELECT data_key, data_value FROM app_data");
                $data = [];
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $data[$row['data_key']] = json_decode($row['data_value']);
                }
                echo json_encode($data);
            }
            break;
            
        case 'POST':
        case 'PUT':
            // Save or update data
            if (!isset($input['key']) || !isset($input['value'])) {
                http_response_code(400);
                echo json_encode(['error' => 'key and value required']);
                exit;
            }
            
            $stmt = $db->prepare("
                INSERT INTO app_data (data_key, data_value, updated_at) 
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(data_key) DO UPDATE SET 
                    data_value = excluded.data_value,
                    updated_at = CURRENT_TIMESTAMP
            ");
            $stmt->execute([$input['key'], json_encode($input['value'])]);
            echo json_encode(['success' => true]);
            break;
            
        case 'DELETE':
            // Delete specific key
            if (!isset($input['key'])) {
                http_response_code(400);
                echo json_encode(['error' => 'key required']);
                exit;
            }
            
            $stmt = $db->prepare("DELETE FROM app_data WHERE data_key = ?");
            $stmt->execute([$input['key']]);
            echo json_encode(['success' => true]);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
