<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// دریافت Base URL
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'get_base_url') {
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'];
    $scriptName = dirname($_SERVER['SCRIPT_NAME']);
    
    // حذف trailing slash
    $scriptName = rtrim($scriptName, '/');
    
    $baseUrl = $protocol . '://' . $host . $scriptName;
    
    echo json_encode([
        'success' => true,
        'baseUrl' => $baseUrl,
        'detectedAt' => date('Y-m-d H:i:s'),
        'protocol' => $protocol,
        'host' => $host,
        'path' => $scriptName
    ]);
    exit();
}

http_response_code(400);
echo json_encode(['success' => false, 'error' => 'Invalid request']);
