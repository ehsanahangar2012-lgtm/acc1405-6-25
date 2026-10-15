<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

function getEnvVar($key, $default = '') {
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

$expectedToken = getEnvVar('VITE_API_TOKEN');
$headers = getallheaders();
$authHeader = $headers['Authorization'] ?? '';
$providedToken = str_replace('Bearer ', '', $authHeader);

if (empty($expectedToken) || $providedToken !== $expectedToken) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit();
}

$geminiKey = getEnvVar('GEMINI_API_KEY');
if (empty($geminiKey)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Gemini API key is missing on the server.']);
    exit();
}

$input = file_get_contents('php://input');

$url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' . $geminiKey;

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $input);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3); // تایم‌اوت اتصال ۳ ثانیه
curl_setopt($ch, CURLOPT_TIMEOUT, 5);        // تایم‌اوت کل درخواست ۵ ثانیه

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if (curl_errno($ch)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => curl_error($ch)]);
} else {
    http_response_code($httpCode);
    echo $response;
}

curl_close($ch);
