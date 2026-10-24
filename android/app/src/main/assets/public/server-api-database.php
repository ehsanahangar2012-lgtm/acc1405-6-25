<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Authentication
$token = $_SERVER['HTTP_AUTHORIZATION'] ?? $_GET['token'] ?? $_POST['token'] ?? '';
$validToken = 'secure_api_token_change_this';

if ($token !== $validToken) {
    http_response_code(401);
    die(json_encode(['error' => 'Unauthorized']));
}

// Get table name from GET or POST
$table = $_GET['table'] ?? null;
$input = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST' || $_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $table = $table ?? $input['table'] ?? null;
}

if (!$table || !preg_match('/^[a-z_]+$/', $table)) {
    http_response_code(400);
    die(json_encode(['error' => 'Invalid table name']));
}

// Database Connection
try {
    $dbPath = __DIR__ . '/database.sqlite';
    $pdo = new PDO('sqlite:' . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Performance optimizations
    $pdo->exec('PRAGMA journal_mode=WAL');
    $pdo->exec('PRAGMA synchronous=NORMAL');
    
    // Create table
    $pdo->exec("CREATE TABLE IF NOT EXISTS {$table} (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        version INTEGER DEFAULT 1,
        updated_at INTEGER DEFAULT (strftime('%s', 'now')),
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )");
    
    switch ($_SERVER['REQUEST_METHOD']) {
        case 'POST':
            if (!isset($input['data']['id'])) {
                http_response_code(400);
                die(json_encode(['error' => 'Missing data.id']));
            }
            
            $stmt = $pdo->prepare("
                INSERT INTO {$table} (id, data, version, updated_at) 
                VALUES (?, ?, 1, strftime('%s', 'now'))
                ON CONFLICT(id) DO UPDATE SET 
                    data = excluded.data,
                    version = version + 1,
                    updated_at = strftime('%s', 'now')
            ");
            $stmt->execute([$input['data']['id'], json_encode($input['data'])]);
            echo json_encode(['success' => true, 'version' => 1]);
            break;
            
        case 'GET':
            $id = $_GET['id'] ?? null;
            $since = $_GET['since'] ?? null;
            
            if ($id) {
                $stmt = $pdo->prepare("SELECT data, version, updated_at FROM {$table} WHERE id = ?");
                $stmt->execute([$id]);
                $result = $stmt->fetch(PDO::FETCH_ASSOC);
                echo json_encode([
                    'success' => true, 
                    'data' => $result ? json_decode($result['data']) : null
                ]);
            } else {
                $query = "SELECT data, version, updated_at FROM {$table}";
                if ($since) {
                    $query .= " WHERE updated_at > ?";
                    $stmt = $pdo->prepare($query);
                    $stmt->execute([$since]);
                } else {
                    $stmt = $pdo->query($query);
                }
                
                $results = array_map(function($r) {
                    return [
                        'data' => json_decode($r['data']),
                        'version' => $r['version'],
                        'updated_at' => $r['updated_at']
                    ];
                }, $stmt->fetchAll(PDO::FETCH_ASSOC));
                
                echo json_encode([
                    'success' => true, 
                    'data' => $results,
                    'count' => count($results),
                    'timestamp' => time()
                ]);
            }
            break;
            
        case 'DELETE':
            if (!isset($input['id'])) {
                http_response_code(400);
                die(json_encode(['error' => 'Missing id']));
            }
            
            $stmt = $pdo->prepare("DELETE FROM {$table} WHERE id = ?");
            $stmt->execute([$input['id']]);
            echo json_encode(['success' => true]);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
} catch (Exception $e) {
    error_log('Database error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>
