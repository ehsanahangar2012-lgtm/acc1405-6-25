<?php
/**
 * سیستم اعتبارسنجی لایسنس، توکن و تاریخ انقضا فضاهای کاری و کاربران در سمت سرور
 * سازگار با سرورهای معمولی cPanel و PHP بدون نیاز به Node.js
 */

class LicenseValidator {
    private static $configFile = __DIR__ . '/data/workspaces_auth.json';

    /**
     * بررسی مجوز دسترسی فضای کاری و کاربر
     * @param string $workspaceId
     * @param string $token
     * @return array [allowed => bool, message => string, details => array]
     */
    public static function validateAccess($workspaceId, $token = '') {
        // فضای پیش‌فرض و مدیر اصلی همیشه مجاز است
        if (empty($workspaceId) || $workspaceId === 'default' || $workspaceId === 'main') {
            return [
                'allowed' => true,
                'status' => 'ACTIVE',
                'role' => 'SUPER_ADMIN',
                'message' => 'فضای کاری اصلی سیستم'
            ];
        }

        // اگر فایل تنظیمات وجود نداشت، پوشه و فایل ایجاد می‌شود
        if (!file_exists(self::$configFile)) {
            self::initDefaultConfig();
        }

        $configData = json_decode(file_get_contents(self::$configFile), true) ?: [];
        $workspaces = $configData['workspaces'] ?? [];

        // اگر سیستم روی حالت ثبت خودکار باشد و فضای کاری هنوز ثبت نشده باشد
        if (!isset($workspaces[$workspaceId])) {
            if (!empty($configData['auto_register_new_tenants']) && getenv('ASHK_ALLOW_AUTO_REGISTER_TENANTS') === '1') {
                // ثبت خودکار با مهلت تست ۳۰ روزه
                $workspaces[$workspaceId] = [
                    'workspace_id' => $workspaceId,
                    'title' => 'مشتری جدید (' . $workspaceId . ')',
                    'token' => !empty($token) ? $token : self::generateSecureToken(),
                    'created_at' => date('Y-m-d H:i:s'),
                    'expire_date' => date('Y-m-d', strtotime('+30 days')),
                    'status' => 'ACTIVE',
                    'max_users' => 5,
                    'is_unlimited' => false,
                    'contact_person' => 'مدیریت جدید'
                ];
                $configData['workspaces'] = $workspaces;
                file_put_contents(self::$configFile, json_encode($configData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
            } else {
                return [
                    'allowed' => false,
                    'status' => 'NOT_FOUND',
                    'message' => 'شناسه فضای کاری در سرور تعریف نشده یا معتبر نمی‌باشد.'
                ];
            }
        }

        $ws = $workspaces[$workspaceId];

        // ۱. بررسی وضعیت فعال بودن
        if (($ws['status'] ?? 'ACTIVE') !== 'ACTIVE') {
            return [
                'allowed' => false,
                'status' => 'SUSPENDED',
                'message' => 'این فضای کاری مسدود یا غیرفعال شده است. لطفاً با پشتیبانی تماس بگیرید.'
            ];
        }

        // ۲. Every tenant must have a non-empty server-issued token.
        $storedToken = (string)($ws['token'] ?? '');
        if ($storedToken === '' || (string)$token === '' || !hash_equals($storedToken, (string)$token)) {
            return [
                'allowed' => false,
                'status' => 'INVALID_TOKEN',
                'message' => 'توکن امنیتی (Workspace Token) اشتباه است یا دسترسی نامعتبر می‌باشد.'
            ];
        }

        // ۳. Non-unlimited licenses must have a valid Gregorian ISO date and must not be expired.
        if (empty($ws['is_unlimited'])) {
            $expireDate = (string)($ws['expire_date'] ?? '');
            if (!preg_match('/^\\d{4}-\\d{2}-\\d{2}$/', $expireDate)) {
                return [
                    'allowed' => false,
                    'status' => 'INVALID_EXPIRY',
                    'message' => 'تاریخ انقضای لایسنس در سرور معتبر نیست؛ تاریخ میلادی YYYY-MM-DD ثبت کنید.'
                ];
            }
            $dateParts = array_map('intval', explode('-', $expireDate));
            if (count($dateParts) !== 3 || !checkdate($dateParts[1], $dateParts[2], $dateParts[0])) {
                return [
                    'allowed' => false,
                    'status' => 'INVALID_EXPIRY',
                    'message' => 'تاریخ انقضای لایسنس در سرور نامعتبر است.'
                ];
            }
            if (date('Y-m-d') > $expireDate) {
                return [
                    'allowed' => false,
                    'status' => 'EXPIRED',
                    'expire_date' => $expireDate,
                    'message' => 'اشتراک و اعتبار این فضای کاری در تاریخ ' . $expireDate . ' به پایان رسیده است.'
                ];
            }
        }

        return [
            'allowed' => true,
            'status' => 'ACTIVE',
            'title' => $ws['title'] ?? '',
            'plan' => $ws['plan'] ?? 'TRIAL',
            'expire_date' => $ws['expire_date'] ?? 'نامحدود',
            'is_unlimited' => !empty($ws['is_unlimited']),
            'max_customers' => isset($ws['max_customers']) ? (int)$ws['max_customers'] : 30,
            'max_documents' => isset($ws['max_documents']) ? (int)$ws['max_documents'] : 100,
            'max_users' => isset($ws['max_users']) ? (int)$ws['max_users'] : 1,
            'features' => is_array($ws['features'] ?? null) ? $ws['features'] : ['BASIC_MODULES'],
            'message' => 'دسترسی مجاز و فعال است.'
        ];
    }

    /**
     * ایجاد فایل پیش‌فرض برای مدیر
     */
    private static function initDefaultConfig() {
        $dir = dirname(self::$configFile);
        if (!is_dir($dir) && !mkdir($dir, 0750, true) && !is_dir($dir)) {
            throw new RuntimeException('Unable to create license data directory.');
        }

        // Safe by default: no sample client and no automatic tenant enrollment.
        $defaultData = [
            'auto_register_new_tenants' => false,
            'admin_secret_key' => 'ADMIN_SECRET_' . bin2hex(random_bytes(24)),
            'workspaces' => []
        ];

        $encoded = json_encode($defaultData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        if ($encoded === false || file_put_contents(self::$configFile, $encoded, LOCK_EX) === false) {
            throw new RuntimeException('Unable to initialize license registry.');
        }
        @chmod(self::$configFile, 0600);
    }

    private static function generateSecureToken() {
        return 'TKN_' . strtoupper(bin2hex(random_bytes(8)));
    }
}
