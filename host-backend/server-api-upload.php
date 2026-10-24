<?php
// Retired legacy endpoint; it used a shared fallback token and caller-controlled paths.
// Use the authenticated host-storage API upload_image action instead.
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
    'message' => 'Use authenticated workspace image upload.'
], JSON_UNESCAPED_UNICODE);
