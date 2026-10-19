<?php
/**
 * پنل مدیریت تحت وب و API جهت تعریف توکن، تمدید تاریخ انقضا و مدیریت کاربران/مشتریان در سرور
 * کاملاً سازگار با cPanel معمولی بدون وابستگی به هیچ کتابخانه جانبی
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Admin-Secret');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once __DIR__ . '/license_validator.php';

$authFile = __DIR__ . '/data/workspaces_auth.json';

if (!file_exists($authFile)) {
    // Create a closed-by-default registry. Admin must read/configure this random key on the server.
    LicenseValidator::validateAccess('__initialize_registry__');
}

$config = json_decode((string)@file_get_contents($authFile), true);
if (!is_array($config) || !is_array($config['workspaces'] ?? null) || empty($config['admin_secret_key'])) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'فهرست لایسنس سرور پیکربندی معتبر ندارد؛ فایل data/workspaces_auth.json را بررسی کنید.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Generate a per-server RSA keypair at runtime; never commit a private signing key to Git.
$signingReady = !empty($config['license_signing_private_key']) && !empty($config['license_signing_public_key']);
if (!$signingReady && function_exists('openssl_pkey_new') && function_exists('openssl_sign')) {
    $keyResource = openssl_pkey_new([
        'private_key_type' => OPENSSL_KEYTYPE_RSA,
        'private_key_bits' => 2048
    ]);
    $privatePem = '';
    if ($keyResource !== false && openssl_pkey_export($keyResource, $privatePem)) {
        $keyDetails = openssl_pkey_get_details($keyResource);
        if (is_array($keyDetails) && !empty($keyDetails['key'])) {
            $config['license_signing_private_key'] = $privatePem;
            $config['license_signing_public_key'] = $keyDetails['key'];
            $savedConfig = json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            if ($savedConfig !== false && file_put_contents($authFile, $savedConfig, LOCK_EX) !== false) {
                @chmod($authFile, 0600);
                $signingReady = true;
            }
        }
    }
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$action = $input['action'] ?? $_GET['action'] ?? 'list';
$adminSecret = (string)($_SERVER['HTTP_X_ADMIN_SECRET'] ?? $input['admin_secret'] ?? '');

// اگر اکشن عمومی برای بررسی وضعیت باشد
if ($action === 'verify_license') {
    $wsId = trim($input['workspace_id'] ?? $_GET['workspace_id'] ?? '');
    $tkn = trim($input['token'] ?? $_GET['token'] ?? '');

    // The reserved mother-server workspaces are not client licenses.
    // Never auto-register an unknown workspace during an activation check.
    if (
        $wsId === '' ||
        in_array($wsId, ['default', 'main'], true) ||
        $tkn === '' ||
        !isset($config['workspaces'][$wsId])
    ) {
        http_response_code(403);
        echo json_encode([
            'allowed' => false,
            'status' => 'NOT_FOUND',
            'message' => 'شناسه فضای کاری اختصاصی در سرور ثبت نشده است یا کلید لایسنس خالی است.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $workspaceEntry = $config['workspaces'][$wsId];
    // Validate the server-issued token, status, and expiry before binding HWID; invalid requests must not lock out the owner.
    $preValidation = LicenseValidator::validateAccess($wsId, $tkn);
    if (empty($preValidation['allowed'])) {
        http_response_code(403);
        echo json_encode($preValidation, JSON_UNESCAPED_UNICODE);
        exit;
    }
    $submittedHwid = strtoupper(trim((string)($input['hwid'] ?? '')));
    $registeredHwid = strtoupper(trim((string)($workspaceEntry['hwid'] ?? '')));
    if ($submittedHwid === '' || strlen($submittedHwid) > 256 || preg_match('/[\\x00-\\x1F\\x7F]/', $submittedHwid)) {
        http_response_code(400);
        echo json_encode([
            'allowed' => false,
            'status' => 'INVALID_HWID',
            'message' => 'شناسه سخت‌افزاری معتبر برای فعال‌سازی ارسال نشده است.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if ($registeredHwid !== '' && !hash_equals($registeredHwid, $submittedHwid)) {
        http_response_code(403);
        echo json_encode([
            'allowed' => false,
            'status' => 'HWID_MISMATCH',
            'message' => 'این لایسنس برای شناسه سخت‌افزاری دیگری ثبت شده است.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // First activation permanently binds an unbound license to this device on the server.
    // Persist the binding before signing any receipt; a failed write must fail closed.
    if ($registeredHwid === '') {
        $config['workspaces'][$wsId]['hwid'] = $submittedHwid;
        $savedRegistry = json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        if ($savedRegistry === false || file_put_contents($authFile, $savedRegistry, LOCK_EX) === false) {
            http_response_code(503);
            echo json_encode([
                'allowed' => false,
                'status' => 'HWID_BIND_FAILED',
                'message' => 'ثبت امن دستگاه روی سرور انجام نشد؛ فعال‌سازی متوقف شد.'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
        @chmod($authFile, 0600);
        $workspaceEntry = $config['workspaces'][$wsId];
        $registeredHwid = $submittedHwid;
    }

    $validation = LicenseValidator::validateAccess($wsId, $tkn);
    if (!empty($validation['allowed'])) {
        $plan = (string)($workspaceEntry['plan'] ?? 'TRIAL');
        $maxCustomers = isset($workspaceEntry['max_customers']) ? (int)$workspaceEntry['max_customers'] : 30;
        $maxDocuments = isset($workspaceEntry['max_documents']) ? (int)$workspaceEntry['max_documents'] : 100;
        $features = is_array($workspaceEntry['features'] ?? null) ? array_values(array_filter($workspaceEntry['features'], 'is_string')) : ['BASIC_MODULES'];
        $isUnlimited = !empty($workspaceEntry['is_unlimited']);

        $validation['plan'] = $plan;
        $validation['max_customers'] = $maxCustomers;
        $validation['max_documents'] = $maxDocuments;
        $validation['features'] = $features;

        if (!$signingReady || empty($config['license_signing_private_key']) || !function_exists('openssl_sign')) {
            http_response_code(503);
            echo json_encode([
                'allowed' => false,
                'status' => 'SIGNING_UNAVAILABLE',
                'message' => 'امضای امن لایسنس روی سرور فعال نیست؛ افزونه OpenSSL و دسترسی نوشتن پوشه data را بررسی کنید.'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        // Signed payload is base64-encoded so the verifier signs and checks the exact same bytes.
        $receiptPayload = [
            'issuer' => 'ashkghalam-license-v1',
            'workspace_id' => $wsId,
            'license_key_hash' => hash('sha256', strtoupper($tkn)),
            'hwid' => $registeredHwid,
            'plan' => $plan,
            'max_customers' => $maxCustomers,
            'max_documents' => $maxDocuments,
            'max_users' => isset($workspaceEntry['max_users']) ? (int)$workspaceEntry['max_users'] : 1,
            'is_unlimited' => $isUnlimited,
            'features' => $features,
            'expire_date' => (string)($workspaceEntry['expire_date'] ?? ''),
            'issued_at' => time(),
            'expires_at' => time() + 600
        ];
        $receiptJson = json_encode($receiptPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $signatureBinary = '';
        if ($receiptJson === false || !openssl_sign($receiptJson, $signatureBinary, $config['license_signing_private_key'], OPENSSL_ALGO_SHA256)) {
            http_response_code(503);
            echo json_encode([
                'allowed' => false,
                'status' => 'SIGNING_FAILED',
                'message' => 'امضای دیجیتال لایسنس تولید نشد؛ تنظیمات OpenSSL سرور را بررسی کنید.'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $validation['license_receipt'] = [
            'signed_payload' => base64_encode($receiptJson),
            'signature' => base64_encode($signatureBinary),
            'algorithm' => 'RSASSA-PKCS1-v1_5-SHA256'
        ];
    }
    echo json_encode($validation, JSON_UNESCAPED_UNICODE);
    exit;
}

// The public key is safe to expose; all registry-management operations below still require admin authentication.
if ($action === 'public_key') {
    if (!$signingReady || empty($config['license_signing_public_key'])) {
        http_response_code(503);
        echo json_encode(['success' => false, 'message' => 'کلید امضای امن در سرور ساخته نشده است.'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    echo json_encode([
        'success' => true,
        'algorithm' => 'RSASSA-PKCS1-v1_5-SHA256',
        'public_key' => $config['license_signing_public_key']
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Every registry mutation/list operation requires the server-only admin secret.
// DISABLED / empty keys fail closed; the secret is accepted only in a POST body or header.
$configuredAdminSecret = (string)($config['admin_secret_key'] ?? '');
if ($configuredAdminSecret === '' || $configuredAdminSecret === 'DISABLED' || $adminSecret === '' || !hash_equals($configuredAdminSecret, $adminSecret)) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'کلید امنیتی مدیریت سرور نامعتبر است؛ مقدار admin_secret_key را در فایل سمت سرور بررسی کنید.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if (in_array($action, ['add', 'save_workspace', 'update'], true) && !$signingReady) {
    http_response_code(503);
    echo json_encode([
        'success' => false,
        'message' => 'صدور لایسنس متوقف شد؛ برای امضای امن باید OpenSSL روی سرور فعال و پوشه data قابل نوشتن باشد.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

switch ($action) {
    case 'list':
        // دریافت لیست کلیه کاربران و فضاهای کاری تعریف شده در سرور
        echo json_encode([
            'success' => true,
            'workspaces' => array_values($config['workspaces'] ?? []),
            'auto_register' => (!empty($config['auto_register_new_tenants']) && getenv('ASHK_ALLOW_AUTO_REGISTER_TENANTS') === '1'),
            'server_time' => date('Y-m-d H:i:s')
        ], JSON_UNESCAPED_UNICODE);
        break;

    case 'save_workspace':
    case 'add':
    case 'update':
        $wsId = preg_replace('/[^a-zA-Z0-9_-]/', '', trim($input['workspace_id'] ?? ''));
        if (empty($wsId) || in_array($wsId, ['default', 'main'], true)) {
            echo json_encode(['success' => false, 'message' => 'شناسه فضای کاری (Workspace ID) الزامی است.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $existing = $config['workspaces'][$wsId] ?? [];

        $config['workspaces'][$wsId] = [
            'workspace_id' => $wsId,
            'title' => trim($input['title'] ?? ($existing['title'] ?? 'مشتری ' . $wsId)),
            'token' => trim($input['token'] ?? ($existing['token'] ?? 'TKN_' . strtoupper(bin2hex(random_bytes(6))))),
            'created_at' => $existing['created_at'] ?? date('Y-m-d H:i:s'),
            'expire_date' => trim($input['expire_date'] ?? ($existing['expire_date'] ?? date('Y-m-d', strtotime('+1 year')))),
            'status' => in_array($input['status'] ?? '', ['ACTIVE', 'SUSPENDED', 'EXPIRED']) ? $input['status'] : ($existing['status'] ?? 'ACTIVE'),
            'max_users' => intval($input['max_users'] ?? ($existing['max_users'] ?? 10)),
            'is_unlimited' => !empty($input['is_unlimited']),
            'plan' => preg_match('/^(TRIAL|HEMAYAT|BRONZE|SILVER|GOLD|ENTERPRISE)$/', (string)($input['plan'] ?? ($existing['plan'] ?? 'TRIAL'))) ? (string)($input['plan'] ?? ($existing['plan'] ?? 'TRIAL')) : 'TRIAL',
            'max_customers' => max(-1, intval($input['max_customers'] ?? ($existing['max_customers'] ?? 30))),
            'max_documents' => max(-1, intval($input['max_documents'] ?? ($existing['max_documents'] ?? 100))),
            'features' => is_array($input['features'] ?? null) ? array_values(array_filter($input['features'], 'is_string')) : ($existing['features'] ?? ['BASIC_MODULES']),
            'hwid' => trim($input['hwid'] ?? ($existing['hwid'] ?? '')),
            'price_paid' => max(0, (int)($input['price_paid'] ?? ($existing['price_paid'] ?? 0))),
            'contact_person' => trim($input['contact_person'] ?? ($existing['contact_person'] ?? '')),
            'phone' => trim($input['phone'] ?? ($existing['phone'] ?? '')),
            'notes' => trim($input['notes'] ?? ($existing['notes'] ?? ''))
        ];

        file_put_contents($authFile, json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);

        echo json_encode([
            'success' => true,
            'message' => 'اطلاعات و لایسنس فضای کاری با موفقیت در سرور ذخیره شد.',
            'workspace' => $config['workspaces'][$wsId]
        ], JSON_UNESCAPED_UNICODE);
        break;

    case 'revoke_license':
        $wsId = trim((string)($input['workspace_id'] ?? ''));
        if ($wsId === '' || in_array($wsId, ['default', 'main'], true) || !isset($config['workspaces'][$wsId])) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'لایسنس/فضای کاری یافت نشد.'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $config['workspaces'][$wsId]['status'] = 'SUSPENDED';
        $config['workspaces'][$wsId]['revoked_at'] = date('Y-m-d H:i:s');
        file_put_contents($authFile, json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
        echo json_encode(['success' => true, 'message' => 'لایسنس در سرور ابطال شد.'], JSON_UNESCAPED_UNICODE);
        break;

    case 'delete':
        $wsId = trim($input['workspace_id'] ?? '');
        if (isset($config['workspaces'][$wsId])) {
            unset($config['workspaces'][$wsId]);
            file_put_contents($authFile, json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
            echo json_encode(['success' => true, 'message' => 'فضای کاری با موفقیت حذف شد.'], JSON_UNESCAPED_UNICODE);
        } else {
            echo json_encode(['success' => false, 'message' => 'فضای کاری یافت نشد.'], JSON_UNESCAPED_UNICODE);
        }
        break;

    case 'toggle_status':
        $wsId = trim($input['workspace_id'] ?? '');
        if (isset($config['workspaces'][$wsId])) {
            $curr = $config['workspaces'][$wsId]['status'] ?? 'ACTIVE';
            $config['workspaces'][$wsId]['status'] = ($curr === 'ACTIVE') ? 'SUSPENDED' : 'ACTIVE';
            file_put_contents($authFile, json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
            echo json_encode([
                'success' => true, 
                'new_status' => $config['workspaces'][$wsId]['status'],
                'message' => 'وضعیت دسترسی تغییر یافت.'
            ], JSON_UNESCAPED_UNICODE);
        } else {
            echo json_encode(['success' => false, 'message' => 'فضای کاری یافت نشد.'], JSON_UNESCAPED_UNICODE);
        }
        break;

    default:
        echo json_encode(['success' => false, 'message' => 'دستور نامعتبر است.'], JSON_UNESCAPED_UNICODE);
        break;
}
