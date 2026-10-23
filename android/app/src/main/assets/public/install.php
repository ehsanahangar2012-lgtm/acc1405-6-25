<?php
// Retired legacy endpoint: install.php.
// Use the current authenticated, workspace-scoped application APIs.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}
http_response_code(410);
echo json_encode([
    'success' => false,
    'error' => 'ENDPOINT_RETIRED',
    'message' => 'This legacy endpoint has been retired.'
], JSON_UNESCAPED_UNICODE);
