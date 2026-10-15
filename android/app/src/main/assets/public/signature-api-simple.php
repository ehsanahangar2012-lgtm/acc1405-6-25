<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$DIR = __DIR__ . '/data/public_signatures/';
if (!is_dir($DIR)) {
    mkdir($DIR, 0755, true);
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?: [];

if ($action === 'createRequest' || ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($input['request']))) {
    $req = $input['request'] ?? $input;
    if ($req && isset($req['token'])) {
        $rawToken = explode('~', $req['token'])[0];
        $cleanToken = preg_replace('/[^a-zA-Z0-9_-]/', '', $rawToken);
        $filename = $cleanToken . '.json';
        
        $jsonContent = json_encode($req, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        file_put_contents($DIR . $filename, $jsonContent, LOCK_EX);
        file_put_contents(__DIR__ . '/data/' . $filename, $jsonContent, LOCK_EX);
        file_put_contents(__DIR__ . '/data/sig_' . $cleanToken . '.json', $jsonContent, LOCK_EX);
        
        echo json_encode(['success' => true, 'message' => 'درخواست امضا با موفقیت ذخیره شد']);
        exit;
    }
}

if ($action === 'getRequest' || isset($_GET['token'])) {
    $token = trim($_GET['token'] ?? $input['token'] ?? '');
    $rawToken = explode('~', $token)[0];
    $cleanToken = preg_replace('/[^a-zA-Z0-9_-]/', '', $rawToken);
    
    $file1 = $DIR . $cleanToken . '.json';
    $file2 = __DIR__ . '/data/' . $cleanToken . '.json';
    $file3 = __DIR__ . '/data/sig_' . $cleanToken . '.json';

    $data = null;
    if (file_exists($file1)) {
        $data = json_decode(file_get_contents($file1), true);
    } elseif (file_exists($file2)) {
        $data = json_decode(file_get_contents($file2), true);
    } elseif (file_exists($file3)) {
        $data = json_decode(file_get_contents($file3), true);
    } else {
        $tenantFiles = glob(__DIR__ . '/data/tenants/*/' . $cleanToken . '.json');
        if (empty($tenantFiles)) {
            $tenantFiles = glob(__DIR__ . '/data/tenants/*/sig_' . $cleanToken . '.json');
        }
        if (!empty($tenantFiles) && file_exists($tenantFiles[0])) {
            $data = json_decode(file_get_contents($tenantFiles[0]), true);
        }
    }

    if ($data) {
        echo json_encode(['success' => true, 'request' => $data]);
    } else {
        echo json_encode(['success' => false, 'error' => 'درخواست یافت نشد']);
    }
    exit;
}

echo json_encode(['success' => true, 'message' => 'سرویس عمومی امضای آنلاین فعال است']);
