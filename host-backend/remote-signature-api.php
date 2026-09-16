<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// مسیرهای ذخیرهسازی
define('SIGNATURE_DIR', __DIR__ . '/signatures/');
define('SIGNATURE_REQUESTS_FILE', SIGNATURE_DIR . 'requests.json');
define('SIGNATURES_FILE', SIGNATURE_DIR . 'signatures.json');
define('AUTH_LOGS_FILE', SIGNATURE_DIR . 'auth_logs.json');
define('OTP_CODES_FILE', SIGNATURE_DIR . 'otp_codes.json');

// ایجاد پوشهها
if (!file_exists(SIGNATURE_DIR)) {
    mkdir(SIGNATURE_DIR, 0755, true);
}

// توابع کمکی
function loadJSON($file) {
    if (!file_exists($file)) {
        return [];
    }
    $content = file_get_contents($file);
    return json_decode($content, true) ?: [];
}

function saveJSON($file, $data) {
    file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function generateOTP() {
    return str_pad(rand(0, 999999), 6, '0', STR_PAD_LEFT);
}

function sendSMS($phone, $message, $otpCode = null) {
    require_once __DIR__ . '/sms-helper.php';
    return SMSHelper::sendSMS($phone, $message, $otpCode);
}

function sendEmail($email, $subject, $message) {
    // ارسال ایمیل
    return mail($email, $subject, $message);
}

function getClientIP() {
    if (!empty($_SERVER['HTTP_CLIENT_IP'])) {
        return $_SERVER['HTTP_CLIENT_IP'];
    } elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        return $_SERVER['HTTP_X_FORWARDED_FOR'];
    } else {
        return $_SERVER['REMOTE_ADDR'];
    }
}

// دریافت درخواست
$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? $_GET['action'] ?? '';

try {
    switch ($action) {
        case 'create_request':
            $requests = loadJSON(SIGNATURE_REQUESTS_FILE);
            $request = $input['data'];
            $request['ipAddress'] = getClientIP();
            $requests[] = $request;
            saveJSON(SIGNATURE_REQUESTS_FILE, $requests);
            
            echo json_encode(['success' => true, 'data' => $request]);
            break;

        case 'send_otp':
            $requestId = $input['requestId'];
            $method = $input['method'];
            
            $requests = loadJSON(SIGNATURE_REQUESTS_FILE);
            $request = null;
            foreach ($requests as $r) {
                if ($r['id'] === $requestId) {
                    $request = $r;
                    break;
                }
            }
            
            if (!$request) {
                throw new Exception('درخواست یافت نشد');
            }
            
            $otpCode = generateOTP();
            $otpData = [
                'requestId' => $requestId,
                'code' => $otpCode,
                'expiresAt' => date('Y-m-d H:i:s', strtotime('+10 minutes')),
                'attempts' => 0
            ];
            
            $otpCodes = loadJSON(OTP_CODES_FILE);
            $otpCodes[$requestId] = $otpData;
            saveJSON(OTP_CODES_FILE, $otpCodes);
            
            if ($method === 'sms') {
                $message = "کد تأیید امضای دیجیتال: $otpCode\nاعتبار: 10 دقیقه";
                sendSMS($request['signerPhone'], $message, $otpCode);
            } else {
                $message = "کد تأیید امضای دیجیتال شما: $otpCode\nاین کد تا 10 دقیقه اعتبار دارد.";
                sendEmail($request['signerEmail'], 'کد تأیید امضای دیجیتال', $message);
            }
            
            echo json_encode(['success' => true, 'message' => 'کد تأیید ارسال شد', 'expiresIn' => 600]);
            break;

        case 'verify_otp':
            $requestId = $input['requestId'];
            $otpCode = $input['otpCode'];
            
            $otpCodes = loadJSON(OTP_CODES_FILE);
            
            if (!isset($otpCodes[$requestId])) {
                throw new Exception('کد تأیید یافت نشد');
            }
            
            $otpData = $otpCodes[$requestId];
            
            if (strtotime($otpData['expiresAt']) < time()) {
                unset($otpCodes[$requestId]);
                saveJSON(OTP_CODES_FILE, $otpCodes);
                throw new Exception('کد تأیید منقضی شده است');
            }
            
            if ($otpData['attempts'] >= 3) {
                throw new Exception('تعداد تلاش بیش از حد مجاز');
            }
            
            if ($otpData['code'] !== $otpCode) {
                $otpCodes[$requestId]['attempts']++;
                saveJSON(OTP_CODES_FILE, $otpCodes);
                throw new Exception('کد تأیید نادرست است');
            }
            
            unset($otpCodes[$requestId]);
            saveJSON(OTP_CODES_FILE, $otpCodes);
            
            echo json_encode(['success' => true, 'message' => 'احراز هویت موفق']);
            break;

        case 'get_by_token':
            $token = $_GET['token'];
            $requests = loadJSON(SIGNATURE_REQUESTS_FILE);
            
            foreach ($requests as $request) {
                if ($request['signatureToken'] === $token) {
                    echo json_encode($request);
                    exit;
                }
            }
            
            http_response_code(404);
            echo json_encode(['error' => 'درخواست یافت نشد']);
            break;

        case 'sign_document':
            $signature = $input['data'];
            $signatures = loadJSON(SIGNATURES_FILE);
            $signatures[] = $signature;
            saveJSON(SIGNATURES_FILE, $signatures);
            
            // بهروزرسانی وضعیت درخواست
            $requests = loadJSON(SIGNATURE_REQUESTS_FILE);
            foreach ($requests as &$request) {
                if ($request['id'] === $signature['requestId']) {
                    $request['status'] = 'signed';
                    $request['signedAt'] = $signature['signedAt'];
                    break;
                }
            }
            saveJSON(SIGNATURE_REQUESTS_FILE, $requests);
            
            echo json_encode(['success' => true, 'data' => $signature]);
            break;

        case 'reject_signature':
            $requestId = $input['requestId'];
            $reason = $input['reason'];
            
            $requests = loadJSON(SIGNATURE_REQUESTS_FILE);
            foreach ($requests as &$request) {
                if ($request['id'] === $requestId) {
                    $request['status'] = 'rejected';
                    $request['rejectedAt'] = date('Y-m-d H:i:s');
                    $request['rejectionReason'] = $reason;
                    break;
                }
            }
            saveJSON(SIGNATURE_REQUESTS_FILE, $requests);
            
            echo json_encode(['success' => true]);
            break;

        case 'get_request':
            $id = $_GET['id'];
            $requests = loadJSON(SIGNATURE_REQUESTS_FILE);
            
            foreach ($requests as $request) {
                if ($request['id'] === $id) {
                    echo json_encode($request);
                    exit;
                }
            }
            
            http_response_code(404);
            echo json_encode(['error' => 'درخواست یافت نشد']);
            break;

        case 'list_requests':
            $requests = loadJSON(SIGNATURE_REQUESTS_FILE);
            
            // فیلتر کردن
            if (isset($_GET['status'])) {
                $requests = array_filter($requests, function($r) {
                    return $r['status'] === $_GET['status'];
                });
            }
            
            if (isset($_GET['documentType'])) {
                $requests = array_filter($requests, function($r) {
                    return $r['documentType'] === $_GET['documentType'];
                });
            }
            
            echo json_encode(array_values($requests));
            break;

        case 'verify_signature':
            $id = $_GET['id'];
            $signatures = loadJSON(SIGNATURES_FILE);
            
            foreach ($signatures as $signature) {
                if ($signature['id'] === $id) {
                    $verification = [
                        'isValid' => true,
                        'signedAt' => $signature['signedAt'],
                        'signerName' => $signature['signerName'],
                        'signerNationalId' => $signature['signerNationalId'],
                        'documentHash' => $signature['documentHash'],
                        'certificateHash' => $signature['certificateHash'],
                        'verifiedAt' => date('Y-m-d H:i:s')
                    ];
                    echo json_encode($verification);
                    exit;
                }
            }
            
            http_response_code(404);
            echo json_encode(['error' => 'امضا یافت نشد']);
            break;

        case 'get_report':
            $requests = loadJSON(SIGNATURE_REQUESTS_FILE);
            
            $report = [
                'totalRequests' => count($requests),
                'pendingRequests' => count(array_filter($requests, fn($r) => $r['status'] === 'pending')),
                'signedRequests' => count(array_filter($requests, fn($r) => $r['status'] === 'signed')),
                'rejectedRequests' => count(array_filter($requests, fn($r) => $r['status'] === 'rejected')),
                'expiredRequests' => count(array_filter($requests, fn($r) => $r['status'] === 'expired')),
                'requestsByType' => [],
                'recentActivity' => array_slice(array_reverse($requests), 0, 10)
            ];
            
            foreach ($requests as $request) {
                $type = $request['documentType'];
                $report['requestsByType'][$type] = ($report['requestsByType'][$type] ?? 0) + 1;
            }
            
            echo json_encode($report);
            break;

        case 'log_auth':
            $log = $input['data'];
            $logs = loadJSON(AUTH_LOGS_FILE);
            $logs[] = $log;
            saveJSON(AUTH_LOGS_FILE, $logs);
            
            echo json_encode(['success' => true]);
            break;

        default:
            http_response_code(400);
            echo json_encode(['error' => 'عملیات نامعتبر']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
