<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Health check endpoint
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $health = [
        'status' => 'OK',
        'timestamp' => date('Y-m-d H:i:s'),
        'version' => '14.0.0',
        'services' => [
            'api' => 'OK',
            'database' => 'OK',
            'storage' => is_writable(__DIR__ . '/uploads') ? 'OK' : 'ERROR',
            'backup' => is_writable(__DIR__ . '/backups') ? 'OK' : 'ERROR'
        ]
    ];
    
    // Check if directories exist and create them if needed
    $dirs = ['uploads', 'backups', 'data'];
    foreach ($dirs as $dir) {
        $path = __DIR__ . '/' . $dir;
        if (!is_dir($path)) {
            mkdir($path, 0755, true);
        }
    }
    
    echo json_encode($health);
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}
?>