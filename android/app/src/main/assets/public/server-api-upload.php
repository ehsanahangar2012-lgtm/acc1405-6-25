<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://acc.ashkghalam.ir');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function validateToken($token) {
    $validToken = getenv('API_TOKEN') ?: 'secure_api_token_change_this';
    return hash_equals($validToken, $token);
}

$token = $_POST['token'] ?? '';
if (!validateToken($token)) {
    http_response_code(401);
    die(json_encode(['error' => 'Unauthorized']));
}

if (!isset($_FILES['image']) || !isset($_POST['folder'])) {
    http_response_code(400);
    die(json_encode(['error' => 'Missing required fields']));
}

$file = $_FILES['image'];
$folder = preg_replace('/[^a-z0-9_\-\/]/i', '', $_POST['folder']);
$uploadDir = __DIR__ . '/uploads/' . $folder . '/';

// Validate file type
$allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

if (!in_array($mimeType, $allowedTypes)) {
    http_response_code(400);
    die(json_encode(['error' => 'Invalid file type']));
}

// Validate file size (max 5MB)
if ($file['size'] > 5 * 1024 * 1024) {
    http_response_code(400);
    die(json_encode(['error' => 'File too large']));
}

// Create directory
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

// Generate unique filename
$extension = pathinfo($file['name'], PATHINFO_EXTENSION);
$filename = uniqid() . '_' . time() . '.' . $extension;
$filepath = $uploadDir . $filename;

if (move_uploaded_file($file['tmp_name'], $filepath)) {
    $url = 'https://acc.ashkghalam.ir/uploads/' . $folder . '/' . $filename;
    echo json_encode(['success' => true, 'url' => $url]);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Upload failed']);
}
?>
