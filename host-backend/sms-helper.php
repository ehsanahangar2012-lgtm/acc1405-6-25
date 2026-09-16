<?php
/**
 * سیستم مدیریت پیامک اشک قلم
 * پشتیبانی از پنل‌های: کاوه‌نگار، فراز اس‌ام‌اس (IPPanel)، ملی پیامک
 */

class SMSHelper {
    
    /**
     * ارسال پیامک عمومی یا رمز یکبار مصرف (OTP)
     * 
     * @param string $phone شماره گیرنده
     * @param string $message متن پیامک (برای ارسال ساده)
     * @param string|null $otpCode کد تأیید (در صورت نیاز به ارسال از طریق الگو/پترن)
     * @return bool وضعیت ارسال
     */
    public static function sendSMS($phone, $message, $otpCode = null) {
        $provider = self::getEnvVar('VITE_SMS_PROVIDER', 'kavenegar');
        $apiKey = self::getEnvVar('VITE_SMS_API_KEY', '');
        $sender = self::getEnvVar('VITE_SMS_SENDER', '');
        
        $maskedKey = empty($apiKey) ? 'Empty' : (substr($apiKey, 0, 4) . '...' . substr($apiKey, -4));
        error_log("[SMS] Request - Provider: $provider, Target: $phone, API Key: $maskedKey, Mode: " . ($otpCode ? "OTP/Pattern" : "Simple"));
        
        if (empty($apiKey)) {
            error_log("[SMS] Error: SMS API key is not configured in .env.local");
            return false;
        }

        $formattedPhone = self::formatPhoneNumber($phone);
        if (!$formattedPhone) {
            error_log("[SMS] Error: Invalid phone number format: $phone");
            return false;
        }

        switch (strtolower($provider)) {
            case 'kavenegar':
                return self::sendKavenegar($formattedPhone, $message, $otpCode, $apiKey, $sender);
            case 'farazsms':
            case 'ippanel':
                return self::sendIPPanel($formattedPhone, $message, $otpCode, $apiKey, $sender);
            case 'melipayamak':
                return self::sendMeliPayamak($formattedPhone, $message, $otpCode, $apiKey, $sender);
            default:
                error_log("[SMS] Error: Unknown SMS provider '$provider'");
                return false;
        }
    }

    /**
     * استانداردسازی شماره تلفن همراه ایران
     */
    private static function formatPhoneNumber($phone) {
        $phone = preg_replace('/\D/', '', $phone);
        
        if (substr($phone, 0, 2) === '98') {
            $phone = '0' . substr($phone, 2);
        } elseif (substr($phone, 0, 4) === '0098') {
            $phone = '0' . substr($phone, 4);
        }
        
        if (substr($phone, 0, 1) === '9' && strlen($phone) === 10) {
            $phone = '0' . $phone;
        }
        
        if (preg_match('/^09[0-9]{9}$/', $phone)) {
            return $phone;
        }
        
        return null;
    }

    /**
     * ارسال از طریق پنل کاوه‌نگار
     */
    private static function sendKavenegar($phone, $message, $otpCode, $apiKey, $sender) {
        if ($otpCode) {
            $template = self::getEnvVar('VITE_SMS_TEMPLATE', 'otp');
            $url = "https://api.kavenegar.com/v1/{$apiKey}/verify/lookup.json";
            $params = [
                'receptor' => $phone,
                'token' => $otpCode,
                'template' => $template
            ];
            error_log("[SMS] Sending Kavenegar OTP with template '$template'");
        } else {
            $url = "https://api.kavenegar.com/v1/{$apiKey}/sms/send.json";
            $params = [
                'receptor' => $phone,
                'message' => $message
            ];
            if (!empty($sender)) {
                $params['sender'] = $sender;
            }
            error_log("[SMS] Sending Kavenegar Standard SMS");
        }

        return self::makeRequest($url, $params);
    }

    /**
     * ارسال از طریق پنل IPPanel / FarazSMS
     */
    private static function sendIPPanel($phone, $message, $otpCode, $apiKey, $sender) {
        if ($otpCode) {
            $patternCode = self::getEnvVar('VITE_SMS_TEMPLATE', '');
            if (empty($patternCode)) {
                error_log("[SMS] Error: VITE_SMS_TEMPLATE is not set for IPPanel pattern send");
                return false;
            }
            $url = "https://api2.ippanel.com/api/v1/sms/pattern/normal/send";
            $headers = [
                "Authorization: AccessKey {$apiKey}",
                "Content-Type: application/json"
            ];
            $body = json_encode([
                'code' => $patternCode,
                'sender' => $sender ?: '+983000505',
                'recipient' => $phone,
                'values' => [
                    'code' => $otpCode
                ]
            ], JSON_UNESCAPED_UNICODE);
            
            error_log("[SMS] Sending IPPanel OTP with pattern '$patternCode'");
            return self::makeRequest($url, null, $headers, $body);
        } else {
            $url = "https://api2.ippanel.com/api/v1/sms/send/bulk";
            $headers = [
                "Authorization: AccessKey {$apiKey}",
                "Content-Type: application/json"
            ];
            $body = json_encode([
                'sender' => $sender ?: '+983000505',
                'recipients' => [$phone],
                'message' => $message
            ], JSON_UNESCAPED_UNICODE);
            
            error_log("[SMS] Sending IPPanel Standard SMS");
            return self::makeRequest($url, null, $headers, $body);
        }
    }

    /**
     * ارسال از طریق پنل ملی پیامک
     */
    private static function sendMeliPayamak($phone, $message, $otpCode, $apiKey, $sender) {
        $parts = explode(':', $apiKey);
        $username = $parts[0] ?? '';
        $password = $parts[1] ?? '';
        
        if (empty($username) || empty($password)) {
            error_log("[SMS] Error: Melipayamak requires username:password format in VITE_SMS_API_KEY");
            return false;
        }

        if ($otpCode) {
            $bodyId = self::getEnvVar('VITE_SMS_TEMPLATE', '');
            if (empty($bodyId)) {
                error_log("[SMS] Error: VITE_SMS_TEMPLATE is not set for Melipayamak template send");
                return false;
            }
            $url = "https://rest.payamak.ir/v1/Messages/SendByTemplate";
            $params = [
                'username' => $username,
                'password' => $password,
                'text' => $otpCode,
                'to' => $phone,
                'bodyId' => (int)$bodyId
            ];
            error_log("[SMS] Sending Melipayamak OTP with bodyId '$bodyId'");
        } else {
            $url = "https://rest.payamak.ir/v1/Messages/SendSimple";
            $params = [
                'username' => $username,
                'password' => $password,
                'to' => $phone,
                'from' => $sender,
                'text' => $message
            ];
            error_log("[SMS] Sending Melipayamak Standard SMS");
        }

        return self::makeRequest($url, $params);
    }

    /**
     * ارسال درخواست HTTP به درگاه پیامک
     */
    private static function makeRequest($url, $params = null, $headers = [], $postBody = null) {
        $ch = curl_init();
        
        if ($postBody !== null) {
            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $postBody);
        } elseif ($params !== null) {
            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($params));
        } else {
            curl_setopt($ch, CURLOPT_URL, $url);
        }
        
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // برای سازگاری کامل با لوکال‌هاست
        
        if (!empty($headers)) {
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        }
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        
        if (curl_errno($ch)) {
            $error = curl_error($ch);
            error_log("[SMS] HTTP Curl Error: " . $error);
            curl_close($ch);
            return false;
        }
        
        curl_close($ch);
        
        if ($httpCode >= 200 && $httpCode < 300) {
            error_log("[SMS] Success - HTTP Code: $httpCode, Response: " . substr($response, 0, 200));
            return true;
        } else {
            error_log("[SMS] Failure - HTTP Code: $httpCode, Response: " . substr($response, 0, 200));
            return false;
        }
    }

    /**
     * دریافت متغیر محیطی از فایل .env.local یا سیستم
     */
    private static function getEnvVar($key, $default = '') {
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
}
