<?php
// Retired legacy endpoint. It accepted a public hard-coded token and exposed
// caller-selected database tables. Use authenticated workspace storage APIs.
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
    'message' => 'Use authenticated workspace storage APIs.'
], JSON_UNESCAPED_UNICODE);
