<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$dataDir = __DIR__ . '/audit-logs';
if (!file_exists($dataDir)) {
    mkdir($dataDir, 0755, true);
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

try {
    switch ($method) {
        case 'POST':
            if ($action === 'log') {
                saveAuditLog();
            } elseif ($action === 'query') {
                queryAuditLogs();
            } else {
                throw new Exception('Invalid action');
            }
            break;
            
        case 'GET':
            if ($action === 'export') {
                exportAuditLogs();
            } elseif ($action === 'stats') {
                getAuditStats();
            } else {
                getAllAuditLogs();
            }
            break;
            
        case 'DELETE':
            if ($action === 'cleanup') {
                cleanupOldLogs();
            } else {
                throw new Exception('Invalid action');
            }
            break;
            
        default:
            throw new Exception('Method not allowed');
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

function saveAuditLog() {
    global $dataDir;
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input || !isset($input['id'])) {
        throw new Exception('Invalid log data');
    }
    
    // ذخیره در فایل روزانه
    $date = date('Y-m-d');
    $filename = "$dataDir/audit-$date.json";
    
    $logs = [];
    if (file_exists($filename)) {
        $logs = json_decode(file_get_contents($filename), true) ?: [];
    }
    
    $logs[] = $input;
    
    file_put_contents($filename, json_encode($logs, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    
    echo json_encode([
        'success' => true,
        'message' => 'Audit log saved'
    ]);
}

function queryAuditLogs() {
    global $dataDir;
    
    $input = json_decode(file_get_contents('php://input'), true);
    $filters = $input['filters'] ?? [];
    
    $allLogs = [];
    $files = glob("$dataDir/audit-*.json");
    
    foreach ($files as $file) {
        $logs = json_decode(file_get_contents($file), true) ?: [];
        $allLogs = array_merge($allLogs, $logs);
    }
    
    // اعمال فیلترها
    if (!empty($filters['userId'])) {
        $allLogs = array_filter($allLogs, function($log) use ($filters) {
            return $log['userId'] === $filters['userId'];
        });
    }
    
    if (!empty($filters['action'])) {
        $allLogs = array_filter($allLogs, function($log) use ($filters) {
            return $log['action'] === $filters['action'];
        });
    }
    
    if (!empty($filters['entity'])) {
        $allLogs = array_filter($allLogs, function($log) use ($filters) {
            return strpos($log['entity'], $filters['entity']) !== false;
        });
    }
    
    if (!empty($filters['startDate'])) {
        $allLogs = array_filter($allLogs, function($log) use ($filters) {
            return $log['timestamp'] >= $filters['startDate'];
        });
    }
    
    if (!empty($filters['endDate'])) {
        $allLogs = array_filter($allLogs, function($log) use ($filters) {
            return $log['timestamp'] <= $filters['endDate'];
        });
    }
    
    // مرتبسازی بر اساس زمان
    usort($allLogs, function($a, $b) {
        return strcmp($b['timestamp'], $a['timestamp']);
    });
    
    echo json_encode([
        'success' => true,
        'logs' => array_values($allLogs),
        'count' => count($allLogs)
    ]);
}

function getAllAuditLogs() {
    global $dataDir;
    
    $allLogs = [];
    $files = glob("$dataDir/audit-*.json");
    
    // فقط 30 روز اخیر
    $files = array_slice($files, -30);
    
    foreach ($files as $file) {
        $logs = json_decode(file_get_contents($file), true) ?: [];
        $allLogs = array_merge($allLogs, $logs);
    }
    
    usort($allLogs, function($a, $b) {
        return strcmp($b['timestamp'], $a['timestamp']);
    });
    
    echo json_encode([
        'success' => true,
        'logs' => $allLogs,
        'count' => count($allLogs)
    ]);
}

function exportAuditLogs() {
    global $dataDir;
    
    $startDate = $_GET['startDate'] ?? date('Y-m-d', strtotime('-30 days'));
    $endDate = $_GET['endDate'] ?? date('Y-m-d');
    
    $allLogs = [];
    $files = glob("$dataDir/audit-*.json");
    
    foreach ($files as $file) {
        $fileDate = basename($file, '.json');
        $fileDate = str_replace('audit-', '', $fileDate);
        
        if ($fileDate >= $startDate && $fileDate <= $endDate) {
            $logs = json_decode(file_get_contents($file), true) ?: [];
            $allLogs = array_merge($allLogs, $logs);
        }
    }
    
    // تولید CSV
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="audit-trail-' . date('Y-m-d') . '.csv"');
    
    $output = fopen('php://output', 'w');
    
    // هدرها
    fputcsv($output, ['زمان', 'کاربر', 'عملیات', 'موجودیت', 'IP', 'شدت']);
    
    // دادهها
    foreach ($allLogs as $log) {
        fputcsv($output, [
            $log['timestamp'],
            $log['userName'],
            $log['action'],
            $log['entity'],
            $log['ip'] ?? '-',
            $log['severity']
        ]);
    }
    
    fclose($output);
}

function getAuditStats() {
    global $dataDir;
    
    $allLogs = [];
    $files = glob("$dataDir/audit-*.json");
    $files = array_slice($files, -7); // 7 روز اخیر
    
    foreach ($files as $file) {
        $logs = json_decode(file_get_contents($file), true) ?: [];
        $allLogs = array_merge($allLogs, $logs);
    }
    
    $stats = [
        'total' => count($allLogs),
        'byAction' => [],
        'bySeverity' => [],
        'byUser' => [],
        'criticalCount' => 0
    ];
    
    foreach ($allLogs as $log) {
        // گروهبندی بر اساس عملیات
        $action = $log['action'];
        $stats['byAction'][$action] = ($stats['byAction'][$action] ?? 0) + 1;
        
        // گروهبندی بر اساس شدت
        $severity = $log['severity'];
        $stats['bySeverity'][$severity] = ($stats['bySeverity'][$severity] ?? 0) + 1;
        
        if ($severity === 'CRITICAL') {
            $stats['criticalCount']++;
        }
        
        // گروهبندی بر اساس کاربر
        $user = $log['userName'];
        $stats['byUser'][$user] = ($stats['byUser'][$user] ?? 0) + 1;
    }
    
    echo json_encode([
        'success' => true,
        'stats' => $stats
    ]);
}

function cleanupOldLogs() {
    global $dataDir;
    
    $days = $_GET['days'] ?? 90;
    $cutoffDate = date('Y-m-d', strtotime("-$days days"));
    
    $files = glob("$dataDir/audit-*.json");
    $deleted = 0;
    
    foreach ($files as $file) {
        $fileDate = basename($file, '.json');
        $fileDate = str_replace('audit-', '', $fileDate);
        
        if ($fileDate < $cutoffDate) {
            unlink($file);
            $deleted++;
        }
    }
    
    echo json_encode([
        'success' => true,
        'message' => "Deleted $deleted old log files"
    ]);
}
?>
