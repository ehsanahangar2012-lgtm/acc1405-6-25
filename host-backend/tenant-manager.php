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
    LicenseValidator::validateAccess('sample_tenant'); // ایجاد خودکار فایل پیش‌فرض
}

$config = json_decode(file_get_contents($authFile), true) ?: [
    'admin_secret_key' => 'ASHK_MASTER_ADMIN_2026',
    'workspaces' => []
];

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$action = $input['action'] ?? $_GET['action'] ?? 'list';
$adminSecret = $_SERVER['HTTP_X_ADMIN_SECRET'] ?? $input['admin_secret'] ?? $_GET['admin_secret'] ?? '';

// اگر اکشن عمومی برای بررسی وضعیت باشد
if ($action === 'verify_license') {
    $wsId = trim($input['workspace_id'] ?? $_GET['workspace_id'] ?? '');
    $tkn = trim($input['token'] ?? $_GET['token'] ?? '');
    $validation = LicenseValidator::validateAccess($wsId, $tkn);
    echo json_encode($validation, JSON_UNESCAPED_UNICODE);
    exit;
}

// برای عملیات مدیریتی، بررسی کلید مدیریت سرور (اختیاری یا اجباری بر اساس تنظیمات)
if (!empty($config['admin_secret_key']) && $config['admin_secret_key'] !== 'DISABLED') {
    if ($adminSecret !== $config['admin_secret_key']) {
        // برای راحتی در استفاده اول، اگر کلید پیش‌فرض بود راهنمایی ارسال می‌شود
        echo json_encode([
            'success' => false,
            'message' => 'کلید امنیتی مدیریت سرور (Admin Secret) نامعتبر است.',
            'tip' => 'کلید مدیریت در فایل /data/workspaces_auth.json تعریف شده است.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
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
        if (empty($wsId)) {
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
