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
            if (!empty($configData['auto_register_new_tenants'])) {
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

        // ۲. بررسی تطابق توکن امنیتی (در صورت فعال بودن بررسی توکن)
        if (!empty($ws['token'])) {
            if (empty($token) || $ws['token'] !== $token) {
                return [
                    'allowed' => false,
                    'status' => 'INVALID_TOKEN',
                    'message' => 'توکن امنیتی (Workspace Token) اشتباه است یا دسترسی نامعتبر می‌باشد.'
                ];
            }
        }

        // ۳. بررسی تاریخ انقضا (Expiration Date)
        if (empty($ws['is_unlimited']) && !empty($ws['expire_date'])) {
            $today = date('Y-m-d');
            if ($today > $ws['expire_date']) {
                return [
                    'allowed' => false,
                    'status' => 'EXPIRED',
                    'expire_date' => $ws['expire_date'],
                    'message' => 'اشتراک و اعتبار این فضای کاری در تاریخ ' . $ws['expire_date'] . ' به پایان رسیده است.'
                ];
            }
        }

        return [
            'allowed' => true,
            'status' => 'ACTIVE',
            'title' => $ws['title'] ?? '',
            'expire_date' => $ws['expire_date'] ?? 'نامحدود',
            'is_unlimited' => !empty($ws['is_unlimited']),
            'message' => 'دسترسی مجاز و فعال است.'
        ];
    }

    /**
     * ایجاد فایل پیش‌فرض برای مدیر
     */
    private static function initDefaultConfig() {
        $dir = dirname(self::$configFile);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $defaultData = [
            'auto_register_new_tenants' => true, // در صورت نیاز می‌توان false کرد
            'admin_secret_key' => 'ADMIN_SECRET_' . substr(md5(uniqid(mt_rand(), true)), 0, 16),
            'workspaces' => [
                'sample_tenant' => [
                    'workspace_id' => 'sample_tenant',
                    'title' => 'مشتری نمونه آزمایشی',
                    'token' => 'TKN_SECURE_987654321',
                    'created_at' => date('Y-m-d H:i:s'),
                    'expire_date' => date('Y-m-d', strtotime('+1 year')),
                    'status' => 'ACTIVE',
                    'max_users' => 10,
                    'is_unlimited' => false,
                    'contact_person' => 'مدیر شعبه'
                ]
            ]
        ];

        file_put_contents(self::$configFile, json_encode($defaultData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
    }

    private static function generateSecureToken() {
        return 'TKN_' . strtoupper(bin2hex(random_bytes(8)));
    }
}
