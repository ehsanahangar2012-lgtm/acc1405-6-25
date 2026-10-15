<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Workspace-ID, X-Workspace-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// خواندن شناسه فضای کاری
$headers = function_exists('getallheaders') ? getallheaders() : [];
$workspaceHeader = '';
foreach ($headers as $k => $v) {
    if (strcasecmp($k, 'X-Workspace-ID') === 0) {
        $workspaceHeader = $v;
        break;
    }
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$workspace = trim($workspaceHeader ?: ($input['workspace_id'] ?? $_GET['workspace_id'] ?? ''));
$workspace = preg_replace('/[^a-zA-Z0-9_-]/', '', $workspace);

// مسیر ذخیره‌سازی
if (!empty($workspace) && $workspace !== 'default' && $workspace !== 'main') {
    $dbDir = __DIR__ . '/db/tenants/' . $workspace;
} else {
    $dbDir = __DIR__ . '/db';
}

if (!file_exists($dbDir)) {
    mkdir($dbDir, 0755, true);
}

define('DELETED_RECORDS_FILE', $dbDir . '/deleted_records.json');

// توابع کمکی
function loadDeletedRecords() {
    if (!file_exists(DELETED_RECORDS_FILE)) {
        return [];
    }
    $content = file_get_contents(DELETED_RECORDS_FILE);
    return json_decode($content, true) ?: [];
}

function saveDeletedRecords($records) {
    file_put_contents(DELETED_RECORDS_FILE, json_encode($records, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

// دریافت درخواست
$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? $_GET['action'] ?? '';

try {
    switch ($action) {
        case 'register':
            // ثبت رکوردهای حذف شده
            $newRecords = $input['records'] ?? [];
            $allRecords = loadDeletedRecords();
            
            foreach ($newRecords as $record) {
                // اضافه کردن timestamp سرور
                $record['serverReceivedAt'] = date('Y-m-d H:i:s');
                $allRecords[$record['id']] = $record;
            }
            
            saveDeletedRecords($allRecords);
            
            echo json_encode([
                'success' => true,
                'registered' => count($newRecords),
                'total' => count($allRecords)
            ]);
            break;

        case 'list':
            // دریافت لیست تمام حذفیات
            $allRecords = loadDeletedRecords();
            $since = $_GET['since'] ?? null;
            
            if ($since) {
                // فیلتر بر اساس تاریخ
                $sinceTimestamp = strtotime($since);
                $allRecords = array_filter($allRecords, function($record) use ($sinceTimestamp) {
                    $recordTime = strtotime($record['serverReceivedAt'] ?? 0);
                    return $recordTime >= $sinceTimestamp;
                });
            }
            
            echo json_encode(array_values($allRecords));
            break;

        case 'check':
            // بررسی اینکه آیا ID خاصی حذف شده است
            $id = $_GET['id'] ?? '';
            $allRecords = loadDeletedRecords();
            
            $isDeleted = isset($allRecords[$id]);
            $record = $isDeleted ? $allRecords[$id] : null;
            
            echo json_encode([
                'isDeleted' => $isDeleted,
                'record' => $record
            ]);
            break;

        case 'cleanup':
            // پاکسازی رکوردهای قدیمی (بیش از 90 روز)
            $allRecords = loadDeletedRecords();
            $ninetyDaysAgo = strtotime('-90 days');
            $cleaned = 0;
            
            foreach ($allRecords as $id => $record) {
                $recordTime = strtotime($record['serverReceivedAt'] ?? 0);
                if ($recordTime < $ninetyDaysAgo) {
                    unset($allRecords[$id]);
                    $cleaned++;
                }
            }
            
            saveDeletedRecords($allRecords);
            
            echo json_encode([
                'success' => true,
                'cleaned' => $cleaned,
                'remaining' => count($allRecords)
            ]);
            break;

        case 'stats':
            // آمار حذفیات
            $allRecords = loadDeletedRecords();
            $stats = [
                'total' => count($allRecords),
                'byType' => [],
                'last24h' => 0,
                'last7d' => 0,
            ];
            
            $now = time();
            $day = 24 * 60 * 60;
            
            foreach ($allRecords as $record) {
                $type = $record['type'] ?? 'unknown';
                $stats['byType'][$type] = ($stats['byType'][$type] ?? 0) + 1;
                
                $recordTime = strtotime($record['serverReceivedAt'] ?? 0);
                if ($now - $recordTime < $day) {
                    $stats['last24h']++;
                }
                if ($now - $recordTime < 7 * $day) {
                    $stats['last7d']++;
                }
            }
            
            echo json_encode($stats);
            break;

        default:
            http_response_code(400);
            echo json_encode(['error' => 'عملیات نامعتبر']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
