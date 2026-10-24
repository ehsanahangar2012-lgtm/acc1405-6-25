<?php
/**
 * API امضای دیجیتال
 * مدیریت کامل فرآیند امضای اسناد
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'digital-signature-config.php';
require_once 'digital-signature-db.php';

class DigitalSignatureAPI {
    private $db;
    private $config;

    public function __construct() {
        $this->db = new DigitalSignatureDB();
        $this->config = DigitalSignatureConfig::getInstance();
    }

    public function handleRequest() {
        $method = $_SERVER['REQUEST_METHOD'];
        $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
        $segments = explode('/', trim($path, '/'));

        // پیدا کردن پویای موقعیت سگمنت api برای سازگاری کامل با اجرای پروژه در زیرپوشه‌ها
        $apiPos = array_search('api', $segments);
        if ($apiPos !== false) {
            $segments = array_slice($segments, $apiPos);
        }

        // احراز هویت
        if (!$this->authenticate()) {
            $this->sendError('Unauthorized', 401);
            return;
        }

        // مسیریابی
        if (isset($segments[0]) && $segments[0] === 'api' && isset($segments[1]) && $segments[1] === 'digital-signature') {
            $resource = $segments[2] ?? '';

            switch ($resource) {
                case 'documents':
                    $this->handleDocuments($method, $segments);
                    break;
                case 'requests':
                    $this->handleRequests($method, $segments);
                    break;
                case 'validate':
                    $this->handleValidate($method, $segments);
                    break;
                case 'otp':
                    $this->handleOTP($method, $segments);
                    break;
                case 'sign':
                    $this->handleSign($method);
                    break;
                case 'reject':
                    $this->handleReject($method);
                    break;
                default:
                    $this->sendError('Not Found', 404);
            }
        } else {
            $this->sendError('Not Found', 404);
        }
    }

    private function getBearerToken() {
        $headers = getallheaders();
        $authHeader = '';
        if (is_array($headers)) {
            foreach ($headers as $name => $value) {
                if (strcasecmp($name, 'Authorization') === 0) {
                    $authHeader = $value;
                    break;
                }
            }
        }
        if (empty($authHeader) && isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
        }
        if (empty($authHeader) && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        }
        if (!empty($authHeader)) {
            if (preg_match('/Bearer\s(\S+)/i', $authHeader, $matches)) {
                return $matches[1];
            }
            return str_replace('Bearer ', '', $authHeader);
        }
        return null;
    }

    private function authenticate() {
        $token = $this->getBearerToken();
        if (empty($token)) {
            return false;
        }
        return $this->config->validateToken($token);
    }

    private function handleDocuments($method, $segments) {
        switch ($method) {
            case 'POST':
                $this->createDocument();
                break;
            case 'GET':
                if (isset($segments[3])) {
                    $subAction = $segments[4] ?? '';
                    if ($subAction === 'status') {
                        $this->getDocumentStatus($segments[3]);
                    } elseif ($subAction === 'download') {
                        $this->downloadDocument($segments[3]);
                    } else {
                        $this->getDocument($segments[3]);
                    }
                } else {
                    $this->getDocuments();
                }
                break;
            default:
                $this->sendError('Method Not Allowed', 405);
        }
    }

    private function createDocument() {
        try {
            $title = $_POST['title'] ?? '';
            $type = $_POST['type'] ?? '';
            $metadata = json_decode($_POST['metadata'] ?? '{}', true);

            if (empty($title) || empty($type)) {
                $this->sendError('عنوان و نوع سند الزامی است', 400);
                return;
            }

            // پردازش فایل
            if (isset($_FILES['file'])) {
                $file = $_FILES['file'];
                
                // بررسی نوع فایل
                if ($file['type'] !== 'application/pdf') {
                    $this->sendError('فقط فایل PDF مجاز است', 400);
                    return;
                }

                // بررسی اندازه
                if ($file['size'] > $this->config->get('maxDocumentSize')) {
                    $this->sendError('حجم فایل بیش از حد مجاز است', 400);
                    return;
                }

                $content = base64_encode(file_get_contents($file['tmp_name']));
                $metadata['originalFileName'] = $file['name'];
                $metadata['fileSize'] = $file['size'];
            } elseif (isset($_POST['content'])) {
                $content = $_POST['content'];
            } else {
                $this->sendError('محتوای سند الزامی است', 400);
                return;
            }

            // محاسبه checksum
            $metadata['checksum'] = hash('sha256', $content);
            $metadata['iranianDate'] = $this->toJalali(time());

            // ذخیره در دیتابیس
            $documentId = $this->db->createDocument([
                'title' => $title,
                'type' => $type,
                'content' => $content,
                'status' => 'pending',
                'metadata' => json_encode($metadata)
            ]);

            // ثبت لاگ
            $this->db->createAuditLog([
                'action' => 'document_created',
                'entityType' => 'document',
                'entityId' => $documentId,
                'ipAddress' => $_SERVER['REMOTE_ADDR'],
                'userAgent' => $_SERVER['HTTP_USER_AGENT']
            ]);

            $document = $this->db->getDocument($documentId);
            $this->sendSuccess($document);

        } catch (Exception $e) {
            $this->sendError('خطا در ایجاد سند: ' . $e->getMessage(), 500);
        }
    }

    private function getDocuments() {
        try {
            $filters = [];
            if (isset($_GET['status'])) {
                $filters['status'] = $_GET['status'];
            }
            if (isset($_GET['type'])) {
                $filters['type'] = $_GET['type'];
            }
            $documents = $this->db->getDocuments($filters);
            $this->sendSuccess($documents);
        } catch (Exception $e) {
            $this->sendError('خطا در دریافت سند‌ها: ' . $e->getMessage(), 500);
        }
    }

    private function getDocument($id) {
        try {
            $document = $this->db->getDocument($id);
            if (!$document) {
                $this->sendError('سند یافت نشد', 404);
                return;
            }
            $this->sendSuccess($document);
        } catch (Exception $e) {
            $this->sendError('خطا در دریافت سند: ' . $e->getMessage(), 500);
        }
    }

    private function getDocumentStatus($id) {
        try {
            $document = $this->db->getDocument($id);
            if (!$document) {
                $this->sendError('سند یافت نشد', 404);
                return;
            }
            $this->sendSuccess(['status' => $document['status']]);
        } catch (Exception $e) {
            $this->sendError('خطا در دریافت وضعیت سند: ' . $e->getMessage(), 500);
        }
    }

    private function downloadDocument($id) {
        try {
            $document = $this->db->getDocument($id);
            if (!$document) {
                $this->sendError('سند یافت نشد', 404);
                return;
            }
            
            $content = base64_decode($document['content']);
            $metadata = json_decode($document['metadata'], true);
            $fileName = $metadata['originalFileName'] ?? ('document_' . $id . '.pdf');
            
            header('Content-Type: application/pdf');
            header('Content-Disposition: attachment; filename="' . $fileName . '"');
            header('Content-Length: ' . strlen($content));
            echo $content;
            exit();
        } catch (Exception $e) {
            $this->sendError('خطا در دانلود سند: ' . $e->getMessage(), 500);
        }
    }

    private function handleRequests($method, $segments) {
        if ($method === 'POST') {
            $this->createSignatureRequest();
        } else {
            $this->sendError('Method Not Allowed', 405);
        }
    }

    private function createSignatureRequest() {
        try {
            $data = json_decode(file_get_contents('php://input'), true);

            $documentId = $data['documentId'] ?? '';
            $signerName = $data['name'] ?? '';
            $signerEmail = $data['email'] ?? '';
            $signerPhone = $data['phone'] ?? '';
            $signerNationalId = $data['nationalId'] ?? '';

            if (empty($documentId) || empty($signerName) || empty($signerEmail)) {
                $this->sendError('اطلاعات ناقص است', 400);
                return;
            }

            // بررسی وجود سند
            $document = $this->db->getDocument($documentId);
            if (!$document) {
                $this->sendError('سند یافت نشد', 404);
                return;
            }

            // تولید توکن یکتا
            $token = bin2hex(random_bytes(32));
            $signatureLink = $this->config->get('baseUrl') . '/sign/' . $token;

            // محاسبه زمان انقضا (48 ساعت)
            $expiresAt = date('Y-m-d H:i:s', strtotime('+48 hours'));

            // ذخیره درخواست
            $requestId = $this->db->createSignatureRequest([
                'documentId' => $documentId,
                'signerName' => $signerName,
                'signerEmail' => $signerEmail,
                'signerPhone' => $signerPhone,
                'signerNationalId' => $signerNationalId,
                'signatureLink' => $signatureLink,
                'token' => $token,
                'expiresAt' => $expiresAt,
                'status' => 'sent'
            ]);

            // ارسال ایمیل/پیامک
            $this->sendNotification($signerEmail, $signerPhone, $signatureLink, $document['title']);

            // ثبت لاگ
            $this->db->createAuditLog([
                'action' => 'signature_request_sent',
                'entityType' => 'request',
                'entityId' => $requestId,
                'ipAddress' => $_SERVER['REMOTE_ADDR'],
                'userAgent' => $_SERVER['HTTP_USER_AGENT']
            ]);

            $request = $this->db->getSignatureRequest($requestId);
            $this->sendSuccess($request);

        } catch (Exception $e) {
            $this->sendError('خطا در ایجاد درخواست: ' . $e->getMessage(), 500);
        }
    }

    private function handleValidate($method, $segments) {
        if ($method !== 'GET') {
            $this->sendError('Method Not Allowed', 405);
            return;
        }

        $token = $segments[3] ?? '';
        if (empty($token)) {
            $this->sendError('توکن الزامی است', 400);
            return;
        }

        $request = $this->db->getSignatureRequestByToken($token);
        
        if (!$request) {
            $this->sendSuccess(['valid' => false]);
            return;
        }

        // بررسی انقضا
        if (strtotime($request['expiresAt']) < time()) {
            $this->db->updateSignatureRequest($request['id'], ['status' => 'expired']);
            $this->sendSuccess(['valid' => false]);
            return;
        }

        $document = $this->db->getDocument($request['documentId']);

        $this->sendSuccess([
            'valid' => true,
            'request' => $request,
            'document' => $document
        ]);
    }

    private function handleOTP($method, $segments) {
        if ($method === 'POST') {
            if (isset($segments[3]) && $segments[3] === 'verify') {
                $this->verifyOTP();
            } else {
                $this->sendOTP();
            }
        } else {
            $this->sendError('Method Not Allowed', 405);
        }
    }

    private function sendOTP() {
        $data = json_decode(file_get_contents('php://input'), true);
        $requestId = $data['requestId'] ?? '';
        $method = $data['method'] ?? 'email';

        $request = $this->db->getSignatureRequest($requestId);
        if (!$request) {
            $this->sendError('درخواست یافت نشد', 404);
            return;
        }

        // تولید کد OTP
        $otpCode = sprintf('%06d', mt_rand(0, 999999));
        $expiresAt = date('Y-m-d H:i:s', strtotime('+10 minutes'));

        // ذخیره OTP
        $this->db->updateSignatureRequest($requestId, [
            'otpCode' => password_hash($otpCode, PASSWORD_DEFAULT),
            'otpExpiresAt' => $expiresAt
        ]);

        // ارسال OTP
        if ($method === 'email') {
            $this->sendOTPEmail($request['signerEmail'], $otpCode);
        } else {
            $this->sendOTPSMS($request['signerPhone'], $otpCode);
        }

        $this->sendSuccess(['sent' => true]);
    }

    private function verifyOTP() {
        $data = json_decode(file_get_contents('php://input'), true);
        $requestId = $data['requestId'] ?? '';
        $otpCode = $data['otpCode'] ?? '';

        $request = $this->db->getSignatureRequest($requestId);
        if (!$request) {
            $this->sendError('درخواست یافت نشد', 404);
            return;
        }

        // بررسی انقضا OTP
        if (strtotime($request['otpExpiresAt']) < time()) {
            $this->sendSuccess(['valid' => false]);
            return;
        }

        // بررسی صحت OTP
        if (!password_verify($otpCode, $request['otpCode'])) {
            $this->sendSuccess(['valid' => false]);
            return;
        }

        // تولید توکن جلسه
        $sessionToken = bin2hex(random_bytes(32));
        $sessionExpiresAt = date('Y-m-d H:i:s', strtotime('+1 hour'));

        $this->db->createSignatureSession([
            'requestId' => $requestId,
            'token' => $sessionToken,
            'expiresAt' => $sessionExpiresAt
        ]);

        $this->sendSuccess([
            'valid' => true,
            'sessionToken' => $sessionToken
        ]);
    }

    private function handleSign($method) {
        if ($method !== 'POST') {
            $this->sendError('Method Not Allowed', 405);
            return;
        }

        $data = json_decode(file_get_contents('php://input'), true);
        $requestId = $data['requestId'] ?? '';
        $signatureData = $data['signatureData'] ?? '';

        // بررسی توکن جلسه
        $sessionToken = $this->getBearerToken();

        $session = $this->db->getSignatureSession($sessionToken);
        if (!$session || $session['requestId'] != $requestId) {
            $this->sendError('جلسه نامعتبر است', 401);
            return;
        }

        $request = $this->db->getSignatureRequest($requestId);
        $document = $this->db->getDocument($request['documentId']);

        // ایجاد امضای دیجیتال
        $signatureId = $this->db->createSignature([
            'documentId' => $request['documentId'],
            'requestId' => $requestId,
            'signatureData' => $signatureData,
            'ipAddress' => $_SERVER['REMOTE_ADDR'],
            'userAgent' => $_SERVER['HTTP_USER_AGENT'],
            'iranianTimestamp' => $this->toJalali(time())
        ]);

        // بروزرسانی وضعیت
        $this->db->updateDocument($request['documentId'], ['status' => 'signed']);
        $this->db->updateSignatureRequest($requestId, ['status' => 'signed']);

        // ثبت لاگ
        $this->db->createAuditLog([
            'action' => 'signature_completed',
            'entityType' => 'signature',
            'entityId' => $signatureId,
            'ipAddress' => $_SERVER['REMOTE_ADDR'],
            'userAgent' => $_SERVER['HTTP_USER_AGENT']
        ]);

        $signature = $this->db->getSignature($signatureId);
        $this->sendSuccess($signature);
    }

    private function handleReject($method) {
        if ($method !== 'POST') {
            $this->sendError('Method Not Allowed', 405);
            return;
        }

        $data = json_decode(file_get_contents('php://input'), true);
        $requestId = $data['requestId'] ?? '';
        $reason = $data['reason'] ?? '';

        $this->db->updateSignatureRequest($requestId, [
            'status' => 'rejected',
            'rejectionReason' => $reason
        ]);

        $request = $this->db->getSignatureRequest($requestId);
        $this->db->updateDocument($request['documentId'], ['status' => 'rejected']);

        $this->sendSuccess(['rejected' => true]);
    }

    private function toJalali($timestamp) {
        if (class_exists('IntlDateFormatter')) {
            $formatter = new IntlDateFormatter(
                'fa_IR@calendar=persian',
                IntlDateFormatter::FULL,
                IntlDateFormatter::FULL,
                'Asia/Tehran',
                IntlDateFormatter::TRADITIONAL,
                'yyyy/MM/dd HH:mm:ss'
            );
            return $formatter->format($timestamp);
        }
        // Fallback to Gregorian if intl is not installed
        return date('Y-m-d H:i:s', $timestamp);
    }

    private function sendNotification($email, $phone, $link, $title) {
        if (!empty($phone)) {
            require_once __DIR__ . '/sms-helper.php';
            $message = "درخواست امضای سند: \"$title\"\nجهت مشاهده و امضا روی لینک زیر کلیک کنید:\n$link";
            SMSHelper::sendSMS($phone, $message);
        }
        if (!empty($email)) {
            $subject = "درخواست امضای دیجیتال سند \"$title\"";
            $message = "با سلام،\nسند \"$title\" برای امضا آماده است. جهت مشاهده و امضا روی لینک زیر کلیک کنید:\n$link";
            $headers = "From: noreply@accounting-system.ir\r\n" .
                       "Reply-To: noreply@accounting-system.ir\r\n" .
                       "X-Mailer: PHP/" . phpversion();
            @mail($email, $subject, $message, $headers);
        }
    }

    private function sendOTPEmail($email, $code) {
        $subject = "کد تأیید امضای دیجیتال";
        $message = "کد تأیید شما برای امضای سند: $code\nاین کد تا 10 دقیقه اعتبار دارد.";
        $headers = "From: noreply@accounting-system.ir\r\n" .
                   "Reply-To: noreply@accounting-system.ir\r\n" .
                   "X-Mailer: PHP/" . phpversion();
        @mail($email, $subject, $message, $headers);
    }

    private function sendOTPSMS($phone, $code) {
        require_once __DIR__ . '/sms-helper.php';
        $message = "کد تأیید امضای دیجیتال: $code\nاعتبار: 10 دقیقه";
        return SMSHelper::sendSMS($phone, $message, $code);
    }

    private function sendSuccess($data) {
        echo json_encode(['success' => true, 'data' => $data], JSON_UNESCAPED_UNICODE);
    }

    private function sendError($message, $code = 400) {
        http_response_code($code);
        echo json_encode(['success' => false, 'error' => $message], JSON_UNESCAPED_UNICODE);
    }
}

$api = new DigitalSignatureAPI();
$api->handleRequest();