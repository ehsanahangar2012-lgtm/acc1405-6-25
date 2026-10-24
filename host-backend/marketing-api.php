<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$dataDir = __DIR__ . '/host-data';
if (!is_dir($dataDir)) mkdir($dataDir, 0755, true);

$action = $_GET['action'] ?? '';

// Safe JSON reading function
function readJSONFile($filepath) {
    if (!file_exists($filepath)) return [];
    $fp = fopen($filepath, 'r');
    if (!$fp) return [];
    $content = '';
    if (flock($fp, LOCK_SH)) {
        $size = filesize($filepath);
        if ($size > 0) {
            $content = fread($fp, $size);
        }
        flock($fp, LOCK_UN);
    }
    fclose($fp);
    $data = json_decode($content, true);
    return is_array($data) ? $data : [];
}

// Dynamic XML Sitemap Generator
if ($action === 'sitemap') {
    header('Content-Type: application/xml; charset=utf-8');
    
    $entriesFile = "$dataDir/marketing_entries.json";
    $entries = readJSONFile($entriesFile);
    
    $siteUrl = isset($_GET['site_url']) ? rtrim($_GET['site_url'], '/') : 'https://ashkghalam.ir';
    
    echo '<?xml version="1.0" encoding="UTF-8"?>' . PHP_EOL;
    echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . PHP_EOL;
    
    // Add home
    echo '  <url>' . PHP_EOL;
    echo '    <loc>' . htmlspecialchars($siteUrl) . '/</loc>' . PHP_EOL;
    echo '    <changefreq>daily</changefreq>' . PHP_EOL;
    echo '    <priority>1.0</priority>' . PHP_EOL;
    echo '  </url>' . PHP_EOL;
    
    foreach ($entries as $entry) {
        if (isset($entry['status']) && $entry['status'] === 'PUBLISHED') {
            $slug = htmlspecialchars($entry['slug'] ?? $entry['id']);
            $updatedAt = date('Y-m-d', strtotime($entry['updatedAt'] ?? 'now'));
            echo '  <url>' . PHP_EOL;
            echo '    <loc>' . htmlspecialchars($siteUrl) . '/post/' . $slug . '</loc>' . PHP_EOL;
            echo '    <lastmod>' . $updatedAt . '</lastmod>' . PHP_EOL;
            echo '    <changefreq>weekly</changefreq>' . PHP_EOL;
            echo '    <priority>0.8</priority>' . PHP_EOL;
            echo '  </url>' . PHP_EOL;
        }
    }
    
    echo '</urlset>' . PHP_EOL;
    exit();
}

// Headless CMS Public Access API (for SEO indexing & external websites)
if ($action === 'public_posts') {
    header('Content-Type: application/json; charset=utf-8');
    
    $entriesFile = "$dataDir/marketing_entries.json";
    $entries = readJSONFile($entriesFile);
    
    // Filter out draft posts
    $publicPosts = array_filter($entries, function($e) {
        return isset($e['status']) && $e['status'] === 'PUBLISHED';
    });
    
    echo json_encode([
        'success' => true,
        'count' => count($publicPosts),
        'data' => array_values($publicPosts)
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

// Public CRM Lead Submit Form API (allows website users to submit printing pricing requests)
if ($action === 'submit_lead') {
    header('Content-Type: application/json; charset=utf-8');
    
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || empty($input['name']) || empty($input['phone'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'نام و شماره همراه الزامی است']);
        exit();
    }
    
    $leadsFile = "$dataDir/marketing_leads.json";
    
    // Open/Create and lock file
    $fp = fopen($leadsFile, 'c+');
    if (!$fp) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'خطا در ثبت درخواست']);
        exit();
    }
    
    if (flock($fp, LOCK_EX)) {
        $size = filesize($leadsFile);
        $content = '';
        if ($size > 0) {
            $content = fread($fp, $size);
        }
        $leads = json_decode($content, true);
        if (!is_array($leads)) $leads = [];
        
        $newLead = [
            'id' => 'lead_' . bin2hex(random_bytes(8)),
            'name' => htmlspecialchars($input['name']),
            'company' => htmlspecialchars($input['company'] ?? ''),
            'phone' => htmlspecialchars($input['phone']),
            'email' => htmlspecialchars($input['email'] ?? ''),
            'notes' => htmlspecialchars($input['notes'] ?? 'ثبت شده از وب‌سایت عمومی'),
            'calculatorConfig' => $input['calculatorConfig'] ?? null,
            'status' => 'INQUIRY',
            'dealValue' => floatval($input['dealValue'] ?? 0),
            'createdAt' => date('Y-m-d H:i:s'),
            'updatedAt' => date('Y-m-d H:i:s')
        ];
        
        $leads[] = $newLead;
        
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($leads, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        flock($fp, LOCK_UN);
        fclose($fp);
        
        echo json_encode(['success' => true, 'lead_id' => $newLead['id'], 'message' => 'درخواست با موفقیت ثبت گردید']);
    } else {
        fclose($fp);
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'خطای قفل پایگاه داده']);
    }
    exit();
}

http_response_code(400);
echo json_encode(['success' => false, 'error' => 'درخواست نامعتبر']);
?>
