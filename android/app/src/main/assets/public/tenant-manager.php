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
    $submittedHwid = trim((string)($input['hwid'] ?? ''));
    $registeredHwid = trim((string)($workspaceEntry['hwid'] ?? ''));
    if ($registeredHwid !== '' && ($submittedHwid === '' || !hash_equals(strtoupper($registeredHwid), strtoupper($submittedHwid)))) {
        http_response_code(403);
        echo json_encode([
            'allowed' => false,
            'status' => 'HWID_MISMATCH',
            'message' => 'این لایسنس برای شناسه سخت‌افزاری دیگری ثبت شده است.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $validation = LicenseValidator::validateAccess($wsId, $tkn);
    if (!empty($validation['allowed'])) {
        $validation['plan'] = $workspaceEntry['plan'] ?? 'TRIAL';
        $validation['max_customers'] = isset($workspaceEntry['max_customers']) ? (int)$workspaceEntry['max_customers'] : 30;
        $validation['max_documents'] = isset($workspaceEntry['max_documents']) ? (int)$workspaceEntry['max_documents'] : 100;
        $validation['features'] = is_array($workspaceEntry['features'] ?? null) ? $workspaceEntry['features'] : ['BASIC_MODULES'];
    }
    echo json_encode($validation, JSON_UNESCAPED_UNICODE);
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

switch ($action) {
    case 'list':
        // دریافت لیست کلیه کاربران و فضاهای کاری تعریف شده در سرور
        echo json_encode([
            'success' => true,
            'workspaces' => array_values($config['workspaces'] ?? []),
            'auto_register' => !empty($config['auto_register_new_tenants']),
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
