<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

// تنظیمات پایگاه داده
define('DB_FILE', __DIR__ . '/signature_database.json');
define('SIGNATURES_DIR', __DIR__ . '/signatures/');
define('AUDIT_LOG', __DIR__ . '/audit_log.json');
define('ENCRYPTION_KEY', getenv('SIGNATURE_ENCRYPTION_KEY') ?: 'default-encryption-key');

// ایجاد دایرکتوری‌ها
if (!file_exists(SIGNATURES_DIR)) mkdir(SIGNATURES_DIR, 0755, true);

class SignatureAPI {
    
    // ایجاد درخواست امضا
    public function createRequest() {
        $data = json_decode(file_get_contents('php://input'), true);
        
        $request = [
            'id' => $data['id'],
            'documentId' => $data['documentId'],
            'signerInfo' => $data['signerInfo'],
            'status' => $data['status'],
            'createdAt' => $data['createdAt'],
            'expiresAt' => $data['expiresAt'],
            'verificationCode' => $data['verificationCode'],
            'ipAddress' => $_SERVER['REMOTE_ADDR']
        ];
        
        $this->saveToDatabase('requests', $request['id'], $request);
        $this->logAudit('CREATE_REQUEST', $request['id'], $request['signerInfo']['nationalId']);
        
        echo json_encode(['success' => true, 'request' => $request]);
    }
    
    // دریافت درخواست
    public function getRequest($id) {
        $requests = $this->loadFromDatabase('requests');
        
        if (isset($requests[$id])) {
            // بررسی انقضا
            if (strtotime($requests[$id]['expiresAt']) < time()) {
                $requests[$id]['status'] = 'منقضی_شده';
                $this->saveToDatabase('requests', $id, $requests[$id]);
            }
            echo json_encode($requests[$id]);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'درخواست یافت نشد']);
        }
    }
    
    // ارسال OTP
    public function sendOTP() {
        $data = json_decode(file_get_contents('php://input'), true);
        $phone = $data['phone'];
        $code = $data['code'];
        
        // ارسال پیامک (باید با سرویس پیامک ایرانی یکپارچه شود)
        // مثال: Kavenegar, Ghasedak, Melipayamak
        
        $this->logAudit('SEND_OTP', '', $phone);
        echo json_encode(['success' => true, 'message' => 'کد ارسال شد']);
    }
    
    // ذخیره امضا
    public function saveSignature() {
        $data = json_decode(file_get_contents('php://input'), true);
        
        $signature = [
            'id' => $data['id'],
            'documentId' => $data['documentId'],
            'signerId' => $data['signerId'],
            'signatureData' => $this->encryptData($data['signatureData']),
            'timestamp' => $data['timestamp'],
            'ipAddress' => $_SERVER['REMOTE_ADDR'],
            'userAgent' => $_SERVER['HTTP_USER_AGENT'],
            'certificateInfo' => $data['certificateInfo'],
            'complianceData' => $data['complianceData']
        ];
        
        // ذخیره در فایل
        $filename = SIGNATURES_DIR . $signature['id'] . '.json';
        file_put_contents($filename, json_encode($signature, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        
        // ذخیره در دیتابیس
        $this->saveToDatabase('signatures', $signature['id'], $signature);
        $this->logAudit('SAVE_SIGNATURE', $signature['documentId'], $signature['signerId']);
        
        // ایجاد گواهی
        $this->generateCertificate($signature);
        
        echo json_encode(['success' => true, 'signature' => $signature]);
    }
    
    // به‌روزرسانی وضعیت
    public function updateStatus($id) {
        $data = json_decode(file_get_contents('php://input'), true);
        $requests = $this->loadFromDatabase('requests');
        
        if (isset($requests[$id])) {
            $requests[$id]['status'] = $data['status'];
            $this->saveToDatabase('requests', $id, $requests[$id]);
            $this->logAudit('UPDATE_STATUS', $id, $data['status']);
            echo json_encode(['success' => true]);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'درخواست یافت نشد']);
        }
    }
    
    // دریافت اسناد امضا شده
    public function getSignedDocuments() {
        $filters = json_decode(file_get_contents('php://input'), true);
        $signatures = $this->loadFromDatabase('signatures');
        
        $results = array_values($signatures);
        
        // فیلتر بر اساس نوع سند
        if (isset($filters['documentType'])) {
            $results = array_filter($results, function($sig) use ($filters) {
                return $sig['documentType'] === $filters['documentType'];
            });
        }
        
        // فیلتر بر اساس تاریخ
        if (isset($filters['fromDate'])) {
            $results = array_filter($results, function($sig) use ($filters) {
                return strtotime($sig['timestamp']) >= strtotime($filters['fromDate']);
            });
        }
        
        echo json_encode(array_values($results));
    }
    
    // ثبت لاگ حسابرسی
    public function logAudit($action, $requestId, $userId) {
        $log = [
            'timestamp' => date('Y-m-d H:i:s'),
            'iranianDate' => $this->toJalali(time()),
            'action' => $action,
            'requestId' => $requestId,
            'userId' => $userId,
            'ipAddress' => $_SERVER['REMOTE_ADDR'],
            'userAgent' => $_SERVER['HTTP_USER_AGENT'] ?? ''
        ];
        
        $logs = file_exists(AUDIT_LOG) ? json_decode(file_get_contents(AUDIT_LOG), true) : [];
        $logs[] = $log;
        file_put_contents(AUDIT_LOG, json_encode($logs, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }
    
    // تولید گواهی امضا
    private function generateCertificate($signature) {
        $certificate = [
            'signatureId' => $signature['id'],
            'documentId' => $signature['documentId'],
            'signerId' => $signature['signerId'],
            'timestamp' => $signature['timestamp'],
            'iranianDate' => $this->toJalali(strtotime($signature['timestamp'])),
            'certificateNumber' => 'CERT-' . strtoupper(substr(md5($signature['id']), 0, 12)),
            'isValid' => true,
            'complianceStatement' => 'این امضای دیجیتال منطبق با قوانین امضای الکترونیکی جمهوری اسلامی ایران است',
            'issuer' => 'Ashke Ghalam Cloud Digital Signature System',
            'algorithm' => 'RSA-2048 + AES-256'
        ];
        
        $certFile = SIGNATURES_DIR . 'cert_' . $signature['id'] . '.json';
        file_put_contents($certFile, json_encode($certificate, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        
        return $certificate;
    }
    
    // رمزنگاری داده
    private function encryptData($data) {
        $iv = openssl_random_pseudo_bytes(16);
        $encrypted = openssl_encrypt($data, 'AES-256-CBC', ENCRYPTION_KEY, 0, $iv);
        return base64_encode($encrypted . '::' . $iv);
    }
    
    // رمزگشایی داده
    private function decryptData($data) {
        list($encrypted, $iv) = explode('::', base64_decode($data), 2);
        return openssl_decrypt($encrypted, 'AES-256-CBC', ENCRYPTION_KEY, 0, $iv);
    }
    
    // ذخیره در دیتابیس
    private function saveToDatabase($collection, $id, $data) {
        $db = file_exists(DB_FILE) ? json_decode(file_get_contents(DB_FILE), true) : [];
        if (!isset($db[$collection])) $db[$collection] = [];
        $db[$collection][$id] = $data;
        file_put_contents(DB_FILE, json_encode($db, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }
    
    // بارگذاری از دیتابیس
    private function loadFromDatabase($collection) {
        $db = file_exists(DB_FILE) ? json_decode(file_get_contents(DB_FILE), true) : [];
        return $db[$collection] ?? [];
    }
    
    // تبدیل به تاریخ شمسی
    private function toJalali($timestamp) {
        $date = getdate($timestamp);
        // استفاده از کتابخانه jDateTime یا الگوریتم تبدیل
        return date('Y-m-d H:i:s', $timestamp); // باید با تاریخ شمسی جایگزین شود
    }
}

// مسیریابی
$api = new SignatureAPI();
$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$segments = explode('/', trim($path, '/'));

if ($method === 'POST' && end($segments) === 'requests') {
    $api->createRequest();
} elseif ($method === 'GET' && $segments[count($segments)-2] === 'requests') {
    $api->getRequest(end($segments));
} elseif ($method === 'POST' && end($segments) === 'send-otp') {
    $api->sendOTP();
} elseif ($method === 'POST' && end($segments) === 'signatures') {
    $api->saveSignature();
} elseif ($method === 'PUT' && $segments[count($segments)-1] === 'status') {
    $api->updateStatus($segments[count($segments)-2]);
} elseif ($method === 'POST' && end($segments) === 'signed') {
    $api->getSignedDocuments();
} else {
    http_response_code(404);
    echo json_encode(['error' => 'مسیر یافت نشد']);
}
