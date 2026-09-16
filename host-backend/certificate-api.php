<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

class CertificateAPI {
    private $certificatesDir = 'certificates/';
    private $uploadsDir = 'uploads/certificates/';
    
    public function __construct() {
        $this->ensureDirectories();
    }
    
    private function ensureDirectories() {
        if (!is_dir($this->certificatesDir)) {
            mkdir($this->certificatesDir, 0755, true);
        }
        if (!is_dir($this->uploadsDir)) {
            mkdir($this->uploadsDir, 0755, true);
        }
    }
    
    public function handleRequest() {
        $method = $_SERVER['REQUEST_METHOD'];
        $path = $_GET['path'] ?? '';
        
        switch ($method) {
            case 'POST':
                if ($path === 'generate') {
                    return $this->generateCertificate();
                } elseif ($path === 'download') {
                    return $this->downloadCertificate();
                }
                break;
            case 'GET':
                if ($path === 'list') {
                    return $this->listCertificates();
                } elseif ($path === 'view') {
                    return $this->viewCertificate();
                } elseif ($path === 'verify') {
                    return $this->verifyCertificate();
                } elseif ($path === 'stats') {
                    return $this->getCertificateStats();
                }
                break;
            case 'DELETE':
                if ($path === 'delete') {
                    return $this->deleteCertificate();
                }
                break;
        }
        
        return $this->errorResponse('Invalid endpoint', 404);
    }
    
    private function generateCertificate() {
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            
            if (!$this->validateCertificateData($input)) {
                return $this->errorResponse('داده‌های ورودی نامعتبر است');
            }
            
            $certificateId = $this->generateCertificateId();
            $verificationCode = $this->generateVerificationCode();
            
            $certificate = [
                'certificateId' => $certificateId,
                'documentId' => $input['documentId'],
                'documentType' => $input['documentType'],
                'documentTitle' => $input['documentTitle'],
                'signerName' => $input['signerName'],
                'signerNationalId' => $input['signerNationalId'],
                'signerPhone' => $input['signerPhone'],
                'signerEmail' => $input['signerEmail'] ?? '',
                'signatureDate' => $input['signatureDate'],
                'signatureTime' => $input['signatureTime'],
                'ipAddress' => $input['ipAddress'],
                'signatureHash' => $input['signatureHash'],
                'verificationCode' => $verificationCode,
                'createdAt' => date('Y-m-d H:i:s'),
                'status' => 'active'
            ];
            
            $this->saveCertificate($certificate);
            
            // ثبت در لاگ
            $this->logCertificateAction('generate', $certificateId, $input['signerNationalId']);
            
            return $this->successResponse($certificate);
            
        } catch (Exception $e) {
            return $this->errorResponse('خطا در تولید گواهی: ' . $e->getMessage());
        }
    }
    
    private function downloadCertificate() {
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $certificateId = $input['certificateId'] ?? '';
            $format = $input['format'] ?? 'pdf'; // pdf or jpg
            
            if (empty($certificateId)) {
                return $this->errorResponse('شناسه گواهی الزامی است');
            }
            
            $certificate = $this->getCertificateById($certificateId);
            if (!$certificate) {
                return $this->errorResponse('گواهی یافت نشد');
            }
            
            if ($format === 'pdf') {
                return $this->generatePDFCertificate($certificate);
            } elseif ($format === 'jpg') {
                return $this->generateJPGCertificate($certificate);
            }
            
            return $this->errorResponse('فرمت نامعتبر');
            
        } catch (Exception $e) {
            return $this->errorResponse('خطا در دانلود گواهی: ' . $e->getMessage());
        }
    }
    
    private function listCertificates() {
        try {
            $page = intval($_GET['page'] ?? 1);
            $limit = intval($_GET['limit'] ?? 20);
            $search = $_GET['search'] ?? '';
            $dateFrom = $_GET['dateFrom'] ?? '';
            $dateTo = $_GET['dateTo'] ?? '';
            
            $certificates = $this->getAllCertificates();
            
            // فیلتر کردن
            if (!empty($search)) {
                $certificates = array_filter($certificates, function($cert) use ($search) {
                    return strpos($cert['signerName'], $search) !== false ||
                           strpos($cert['signerNationalId'], $search) !== false ||
                           strpos($cert['documentId'], $search) !== false ||
                           strpos($cert['certificateId'], $search) !== false;
                });
            }
            
            if (!empty($dateFrom)) {
                $certificates = array_filter($certificates, function($cert) use ($dateFrom) {
                    return $cert['signatureDate'] >= $dateFrom;
                });
            }
            
            if (!empty($dateTo)) {
                $certificates = array_filter($certificates, function($cert) use ($dateTo) {
                    return $cert['signatureDate'] <= $dateTo;
                });
            }
            
            // صفحه‌بندی
            $total = count($certificates);
            $offset = ($page - 1) * $limit;
            $certificates = array_slice($certificates, $offset, $limit);
            
            return $this->successResponse([
                'certificates' => array_values($certificates),
                'pagination' => [
                    'page' => $page,
                    'limit' => $limit,
                    'total' => $total,
                    'pages' => ceil($total / $limit)
                ]
            ]);
            
        } catch (Exception $e) {
            return $this->errorResponse('خطا در دریافت لیست گواهیها: ' . $e->getMessage());
        }
    }
    
    private function viewCertificate() {
        try {
            $certificateId = $_GET['id'] ?? '';
            
            if (empty($certificateId)) {
                return $this->errorResponse('شناسه گواهی الزامی است');
            }
            
            $certificate = $this->getCertificateById($certificateId);
            if (!$certificate) {
                return $this->errorResponse('گواهی یافت نشد');
            }
            
            return $this->successResponse($certificate);
            
        } catch (Exception $e) {
            return $this->errorResponse('خطا در نمایش گواهی: ' . $e->getMessage());
        }
    }
    
    private function verifyCertificate() {
        try {
            $certificateId = $_GET['id'] ?? '';
            $verificationCode = $_GET['code'] ?? '';
            
            if (empty($certificateId) || empty($verificationCode)) {
                return $this->errorResponse('شناسه گواهی و کد تأیید الزامی است');
            }
            
            $certificate = $this->getCertificateById($certificateId);
            if (!$certificate) {
                return $this->errorResponse('گواهی یافت نشد');
            }
            
            $isValid = $certificate['verificationCode'] === $verificationCode;
            
            // ثبت در لاگ
            $this->logCertificateAction('verify', $certificateId, '', $isValid ? 'success' : 'failed');
            
            return $this->successResponse([
                'valid' => $isValid,
                'certificate' => $isValid ? $certificate : null
            ]);
            
        } catch (Exception $e) {
            return $this->errorResponse('خطا در تأیید گواهی: ' . $e->getMessage());
        }
    }
    
    private function getCertificateStats() {
        try {
            $certificates = $this->getAllCertificates();
            $now = new DateTime();
            $today = $now->format('Y-m-d');
            $thisWeekStart = $now->modify('-7 days')->format('Y-m-d');
            $thisMonthStart = $now->modify('first day of this month')->format('Y-m-d');
            
            $stats = [
                'total' => count($certificates),
                'today' => 0,
                'thisWeek' => 0,
                'thisMonth' => 0
            ];
            
            foreach ($certificates as $cert) {
                if ($cert['signatureDate'] === $today) {
                    $stats['today']++;
                }
                if ($cert['signatureDate'] >= $thisWeekStart) {
                    $stats['thisWeek']++;
                }
                if ($cert['signatureDate'] >= $thisMonthStart) {
                    $stats['thisMonth']++;
                }
            }
            
            return $this->successResponse($stats);
            
        } catch (Exception $e) {
            return $this->errorResponse('خطا در دریافت آمار: ' . $e->getMessage());
        }
    }
    
    private function deleteCertificate() {
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $certificateId = $input['certificateId'] ?? '';
            
            if (empty($certificateId)) {
                return $this->errorResponse('شناسه گواهی الزامی است');
            }
            
            $certificate = $this->getCertificateById($certificateId);
            if (!$certificate) {
                return $this->errorResponse('گواهی یافت نشد');
            }
            
            // حذف فایل گواهی
            $filePath = $this->certificatesDir . $certificateId . '.json';
            if (file_exists($filePath)) {
                unlink($filePath);
            }
            
            // ثبت در لاگ
            $this->logCertificateAction('delete', $certificateId, $certificate['signerNationalId']);
            
            return $this->successResponse(['message' => 'گواهی با موفقیت حذف شد']);
            
        } catch (Exception $e) {
            return $this->errorResponse('خطا در حذف گواهی: ' . $e->getMessage());
        }
    }
    
    private function validateCertificateData($data) {
        $required = ['documentId', 'documentType', 'signerName', 'signerNationalId', 'signatureDate', 'signatureTime', 'ipAddress'];
        
        foreach ($required as $field) {
            if (empty($data[$field])) {
                return false;
            }
        }
        
        return true;
    }
    
    private function generateCertificateId() {
        return 'CERT-' . date('Ymd') . '-' . strtoupper(substr(uniqid(), -8));
    }
    
    private function generateVerificationCode() {
        return strtoupper(substr(hash('sha256', uniqid() . time()), 0, 16));
    }
    
    private function saveCertificate($certificate) {
        $filePath = $this->certificatesDir . $certificate['certificateId'] . '.json';
        file_put_contents($filePath, json_encode($certificate, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    }
    
    private function getCertificateById($certificateId) {
        $filePath = $this->certificatesDir . $certificateId . '.json';
        if (file_exists($filePath)) {
            return json_decode(file_get_contents($filePath), true);
        }
        return null;
    }
    
    private function getAllCertificates() {
        $certificates = [];
        $files = glob($this->certificatesDir . '*.json');
        
        foreach ($files as $file) {
            $certificate = json_decode(file_get_contents($file), true);
            if ($certificate) {
                $certificates[] = $certificate;
            }
        }
        
        // مرتب‌سازی بر اساس تاریخ ایجاد
        usort($certificates, function($a, $b) {
            return strtotime($b['createdAt']) - strtotime($a['createdAt']);
        });
        
        return $certificates;
    }
    
    private function generatePDFCertificate($certificate) {
        // در اینجا می‌توانید از کتابخانه‌هایی مثل TCPDF استفاده کنید
        // برای سادگی، فقط اطلاعات گواهی را برمی‌گردانیم
        return $this->successResponse([
            'type' => 'pdf',
            'filename' => 'certificate-' . $certificate['certificateId'] . '.pdf',
            'data' => $certificate
        ]);
    }
    
    private function generateJPGCertificate($certificate) {
        // در اینجا می‌توانید تصویر گواهی را تولید کنید
        return $this->successResponse([
            'type' => 'jpg',
            'filename' => 'certificate-' . $certificate['certificateId'] . '.jpg',
            'data' => $certificate
        ]);
    }
    
    private function logCertificateAction($action, $certificateId, $userId = '', $result = 'success') {
        $logEntry = [
            'timestamp' => date('Y-m-d H:i:s'),
            'action' => $action,
            'certificateId' => $certificateId,
            'userId' => $userId,
            'result' => $result,
            'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
        ];
        
        $logFile = 'logs/certificate-actions.log';
        if (!is_dir('logs')) {
            mkdir('logs', 0755, true);
        }
        
        file_put_contents($logFile, json_encode($logEntry) . "\n", FILE_APPEND | LOCK_EX);
    }
    
    private function successResponse($data) {
        return json_encode([
            'success' => true,
            'data' => $data
        ], JSON_UNESCAPED_UNICODE);
    }
    
    private function errorResponse($message, $code = 400) {
        http_response_code($code);
        return json_encode([
            'success' => false,
            'error' => $message
        ], JSON_UNESCAPED_UNICODE);
    }
}

// اجرای API
$api = new CertificateAPI();
echo $api->handleRequest();
?>