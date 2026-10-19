<?php
/**
 * پیکربندی سیستم امضای دیجیتال
 */

class DigitalSignatureConfig {
    private static $instance = null;
    private $config;

    public static function getEnvVar($key, $default = '') {
        $envFile = __DIR__ . '/.env.local';
        if (file_exists($envFile)) {
            $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                if (strpos(trim($line), '#') === 0) continue;
                $parts = explode('=', $line, 2);
                if (count($parts) === 2 && trim($parts[0]) === $key) {
                    return trim($parts[1]);
                }
            }
        }
        return getenv($key) ?: $default;
    }

    private function __construct() {
        $this->config = [
            'baseUrl' => $this->getBaseUrl(),
            'apiKey' => self::getEnvVar('ASHK_DIGITAL_SIGNATURE_API_TOKEN'),
            'maxDocumentSize' => 10 * 1024 * 1024, // 10MB
            'linkExpirationHours' => 48,
            'otpExpirationMinutes' => 10,
            'allowedFileTypes' => ['application/pdf'],
            'encryptionAlgorithm' => 'AES-256-CBC',
            'hashAlgorithm' => 'sha256',
            'storageDir' => __DIR__ . '/digital-signature-storage',
            'backupDir' => __DIR__ . '/digital-signature-backups',
            'smsProvider' => [
                'enabled' => self::getEnvVar('VITE_SMS_PROVIDER') ? true : false,
                'provider' => self::getEnvVar('VITE_SMS_PROVIDER', 'kavenegar'),
                'apiKey' => self::getEnvVar('VITE_SMS_API_KEY') ?: self::getEnvVar('SMS_API_KEY') ?: '',
                'sender' => self::getEnvVar('VITE_SMS_SENDER') ?: '',
                'apiUrl' => self::getEnvVar('VITE_SMS_API_URL') ?: self::getEnvVar('SMS_API_URL') ?: ''
            ],
            'emailProvider' => [
                'enabled' => self::getEnvVar('VITE_EMAIL_PROVIDER') ? true : false,
                'from' => self::getEnvVar('VITE_EMAIL_USER') ?: 'noreply@accounting-system.ir',
                'smtpHost' => self::getEnvVar('VITE_EMAIL_HOST', 'localhost'),
                'smtpPort' => self::getEnvVar('VITE_EMAIL_PORT', 587),
                'smtpUser' => self::getEnvVar('VITE_EMAIL_USER', ''),
                'smtpPass' => self::getEnvVar('VITE_EMAIL_PASSWORD', '')
            ]
        ];

        $this->ensureDirectories();
    }


    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function get($key) {
        return $this->config[$key] ?? null;
    }

    public function validateToken($token) {
        $expected = (string)($this->config['apiKey'] ?? '');
        $provided = is_string($token) ? $token : '';
        return $expected !== '' && $provided !== '' && hash_equals($expected, $provided);
    }

    private function getBaseUrl() {
        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        return $protocol . '://' . $host;
    }

    private function ensureDirectories() {
        $dirs = [$this->config['storageDir'], $this->config['backupDir']];
        foreach ($dirs as $dir) {
            if (!is_dir($dir)) {
                mkdir($dir, 0755, true);
            }
        }
    }
}