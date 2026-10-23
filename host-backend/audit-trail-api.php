<?php
// Retired legacy API: it exposed global audit logs and allowed anonymous
// export/cleanup operations. The supported audit viewer currently uses
// device-local IndexedDB data; do not expose the old global file store.
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
    'message' => 'The legacy global audit endpoint has been retired.'
], JSON_UNESCAPED_UNICODE);
