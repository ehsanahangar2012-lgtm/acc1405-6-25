<?php
/**
 * API ارسال ایمیل بازیابی رمز عبور - اشک قلم
 */

// فعال‌سازی لاگ ارور برای دریافت خطای دقیق mail
error_reporting(E_ALL);
ini_set('display_errors', 0);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$input = file_get_contents('php://input');
$data = json_decode($input, true);

$email = $data['email'] ?? '';
$otpCode = $data['otpCode'] ?? '';
$username = $data['username'] ?? '';
$fullName = $data['fullName'] ?? $username;

if (empty($email) || empty($otpCode)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'ایمیل یا کد اعتبارسنجی نامعتبر است.']);
    exit;
}

// ساخت نام دامنه معتبر برای جلوگیری از بلاک شدن ایمیل به عنوان اسپم
$host = $_SERVER['HTTP_HOST'] ?? 'ashke-ghalam.ir';
$host = preg_replace('/:[0-9]+$/', '', $host); // حذف پورت
if ($host === 'localhost' || $host === '127.0.0.1') {
    $host = 'ashke-ghalam.local';
}

$fromEmail = "admin@" . $host; // برخی هاست‌ها noreply را مسدود می‌کنند

$subject = "کد اعتبارسنجی بازیابی رمز عبور اشک قلم - " . $otpCode;
$message = "کاربر گرامی $fullName,\n\n";
$message .= "درخواست بازیابی رمز عبور برای حساب کاربری شما ($username) در سامانه اشک قلم ثبت شده است.\n\n";
$message .= "کد اعتبارسنجی امن ۶ رقمی شما:\n";
$message .= ">>>  $otpCode  <<<\n\n";
$message .= "این کد معتبر می‌باشد. در صورتی که شما این درخواست را صادر نکرده‌اید، لطفاً این پیام را نادیده بگیرید.\n\n";
$message .= "با تشکر،\nسیستم یکپارچه مالی اشک قلم";

$headers = "From: =?UTF-8?B?" . base64_encode('اشک قلم') . "?= <" . $fromEmail . ">\r\n" .
           "Reply-To: " . $fromEmail . "\r\n" .
           "Content-Type: text/plain; charset=UTF-8\r\n" .
           "X-Mailer: PHP/" . phpversion();

// تلاش برای ارسال ایمیل و دریافت خطای دقیق در صورت شکست
$errorMsg = null;
set_error_handler(function($errno, $errstr) use (&$errorMsg) {
    $errorMsg = $errstr;
    return true; // جلوگیری از چاپ خطای پیش‌فرض
});

$sent = mail($email, $subject, $message, $headers);

restore_error_handler();

if ($sent) {
    echo json_encode(['success' => true, 'message' => 'ایمیل با موفقیت از طریق هاست ارسال شد.']);
} else {
    http_response_code(500);
    echo json_encode([
        'success' => false, 
        'error' => 'ارسال ایمیل توسط سرور هاست با خطا مواجه شد.',
        'details' => $errorMsg ?: 'تابع mail در این سرور غیرفعال یا مسدود است.'
    ]);
}

