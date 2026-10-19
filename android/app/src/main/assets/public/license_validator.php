<?php
/**
 * Server-authoritative license validation. Unknown workspaces cannot self-register.
 */
class LicenseValidator {
    private static $configFile = __DIR__ . '/data/workspaces_auth.json';

    private static function denied($status, $message) {
        return ['allowed' => false, 'status' => $status, 'message' => $message];
    }

    public static function validateAccess($workspaceId, $token = '') {
        $workspaceId = trim((string)$workspaceId);
        $token = trim((string)$token);
        if (!is_file(self::$configFile)) {
            try { self::initDefaultConfig(); }
            catch (Throwable $e) { return self::denied('CONFIG_ERROR', 'ساخت پیکربندی لایسنس سرور ناموفق بود.'); }
        }
        $raw = @file_get_contents(self::$configFile);
        $config = is_string($raw) ? json_decode($raw, true) : null;
        if (!is_array($config)) return self::denied('CONFIG_INVALID', 'پیکربندی لایسنس سرور نامعتبر است.');

        // Upgrade older installations with a distinct server-only mother token.
        if (empty($config['mother_workspace_token']) || strlen((string)$config['mother_workspace_token']) < 32) {
            $config['mother_workspace_token'] = 'MOTHER_TOKEN_' . bin2hex(random_bytes(24));
            $json = json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            if ($json === false || @file_put_contents(self::$configFile, $json, LOCK_EX) === false) {
                return self::denied('CONFIG_WRITE_ERROR', 'ساخت توکن محرمانه فضای مادر ناموفق بود.');
            }
            @chmod(self::$configFile, 0600);
        }

        if ($workspaceId === '' || in_array($workspaceId, ['default', 'main'], true)) {
            $motherToken = (string)$config['mother_workspace_token'];
            if ($token === '' || !hash_equals($motherToken, $token)) {
                return self::denied('MOTHER_AUTH_REQUIRED', 'برای دسترسی به فضای مادر، توکن اختصاصی لازم است.');
            }
            return [
                'allowed' => true, 'status' => 'ACTIVE', 'role' => 'MOTHER_ADMIN',
                'workspace_id' => $workspaceId ?: 'main', 'title' => 'فضای کاری مادر',
                'plan' => 'MOTHER', 'expire_date' => '9999-12-31', 'is_unlimited' => true,
                'max_customers' => -1, 'max_documents' => -1, 'max_users' => 99,
                'features' => ['ALL_MODULES'], 'message' => 'دسترسی فضای مادر تأیید شد.'
            ];
        }

        if (!preg_match('/^[a-zA-Z0-9_-]{3,80}$/', $workspaceId)) {
            return self::denied('INVALID_WORKSPACE', 'شناسه فضای کاری معتبر نیست.');
        }
        $workspaces = $config['workspaces'] ?? [];
        if (!is_array($workspaces) || !isset($workspaces[$workspaceId]) || !is_array($workspaces[$workspaceId])) {
            return self::denied('NOT_FOUND', 'این فضای کاری در پرتال مادر ثبت نشده است.');
        }

        $ws = $workspaces[$workspaceId];
        $status = strtoupper((string)($ws['status'] ?? 'ACTIVE'));
        if ($status !== 'ACTIVE') {
            return self::denied($status === 'REVOKED' ? 'REVOKED' : 'SUSPENDED', 'لایسنس این فضا غیرفعال یا باطل شده است.');
        }
        $storedHash = (string)($ws['token_hash'] ?? '');
        $storedToken = (string)($ws['token'] ?? '');
        $tokenMatches = $storedHash !== ''
            ? ($token !== '' && hash_equals($storedHash, hash('sha256', $token)))
            : ($storedToken !== '' && $token !== '' && hash_equals($storedToken, $token));
        if (!$tokenMatches) return self::denied('INVALID_TOKEN', 'کلید لایسنس یا توکن فضای کاری معتبر نیست.');

        // Unlimited quotas do not imply a perpetual license.
        $expiry = (string)($ws['expire_date'] ?? '');
        if ($expiry !== '9999-12-31') {
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $expiry)) {
                return self::denied('INVALID_EXPIRY', 'تاریخ انقضا باید میلادی و با فرمت YYYY-MM-DD باشد.');
            }
            $parts = array_map('intval', explode('-', $expiry));
            if (count($parts) !== 3 || !checkdate($parts[1], $parts[2], $parts[0])) {
                return self::denied('INVALID_EXPIRY', 'تاریخ انقضای لایسنس نامعتبر است.');
            }
            if (date('Y-m-d') > $expiry) {
                return ['allowed' => false, 'status' => 'EXPIRED', 'expire_date' => $expiry, 'message' => 'اعتبار این لایسنس به پایان رسیده است.'];
            }
        }

        return [
            'allowed' => true, 'status' => 'ACTIVE', 'workspace_id' => $workspaceId,
            'title' => (string)($ws['title'] ?? ''),
            'plan' => (string)($ws['plan'] ?? 'TRIAL'),
            'expire_date' => $expiry,
            'is_unlimited' => !empty($ws['is_unlimited']),
            'max_customers' => isset($ws['max_customers']) ? (int)$ws['max_customers'] : 30,
            'max_documents' => isset($ws['max_documents']) ? (int)$ws['max_documents'] : 100,
            'max_users' => isset($ws['max_users']) ? (int)$ws['max_users'] : 1,
            'features' => is_array($ws['features'] ?? null) ? array_values($ws['features']) : ['BASIC_MODULES'],
            'message' => 'دسترسی مجاز و فعال است.'
        ];
    }

    private static function initDefaultConfig() {
        $dir = dirname(self::$configFile);
        if (!is_dir($dir) && !mkdir($dir, 0750, true) && !is_dir($dir)) {
            throw new RuntimeException('Unable to create license data directory.');
        }
        $defaultData = [
            'auto_register_new_tenants' => false,
            'admin_secret_key' => 'ADMIN_SECRET_' . bin2hex(random_bytes(24)),
            'mother_workspace_token' => 'MOTHER_TOKEN_' . bin2hex(random_bytes(24)),
            'workspaces' => []
        ];
        $json = json_encode($defaultData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        if ($json === false || file_put_contents(self::$configFile, $json, LOCK_EX) === false) {
            throw new RuntimeException('Unable to initialize license registry.');
        }
        @chmod(self::$configFile, 0600);
    }
}
