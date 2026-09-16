<?php
/**
 * فایل نصب خودکار - فقط یکبار اجرا شود
 * آدرس: https://acc.ashkghalam.ir/install.php
 */

header('Content-Type: text/html; charset=utf-8');

$baseDir = __DIR__;
$folders = [
    'api',
    'backups',
    'uploads',
    'uploads/checks',
    'uploads/vouchers',
    'uploads/invoices',
    'uploads/signatures',
    'logs'
];

$results = [];

// ایجاد پوشهها
foreach ($folders as $folder) {
    $path = $baseDir . '/' . $folder;
    
    if (!is_dir($path)) {
        if (mkdir($path, 0755, true)) {
            $results[] = "✅ پوشه ایجاد شد: {$folder}";
        } else {
            $results[] = "❌ خطا در ایجاد: {$folder}";
        }
    } else {
        $results[] = "ℹ️ پوشه موجود است: {$folder}";
    }
}

// ایجاد .htaccess برای backups
$htaccessContent = "Order Deny,Allow\nDeny from all\nOptions -Indexes\n";
$htaccessPath = $baseDir . '/backups/.htaccess';

if (file_put_contents($htaccessPath, $htaccessContent)) {
    $results[] = "✅ فایل .htaccess ایجاد شد";
} else {
    $results[] = "❌ خطا در ایجاد .htaccess";
}

// ایجاد فایل index.php خالی برای امنیت
$securityDirs = ['backups', 'uploads', 'logs'];
foreach ($securityDirs as $dir) {
    $indexPath = $baseDir . '/' . $dir . '/index.php';
    if (!file_exists($indexPath)) {
        file_put_contents($indexPath, "<?php\nhttp_response_code(403);\nexit('Access Denied');\n");
        $results[] = "✅ فایل امنیتی ایجاد شد: {$dir}/index.php";
    }
}

// نمایش نتایج
?>
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>نصب خودکار - اشک قلم</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: Tahoma, Arial, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            max-width: 600px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 {
            color: #667eea;
            margin-bottom: 30px;
            text-align: center;
            font-size: 28px;
        }
        .result {
            padding: 12px 20px;
            margin: 10px 0;
            border-radius: 10px;
            font-size: 14px;
            line-height: 1.6;
        }
        .success { background: #d4edda; color: #155724; border-right: 4px solid #28a745; }
        .error { background: #f8d7da; color: #721c24; border-right: 4px solid #dc3545; }
        .info { background: #d1ecf1; color: #0c5460; border-right: 4px solid #17a2b8; }
        .warning {
            background: #fff3cd;
            color: #856404;
            padding: 20px;
            border-radius: 10px;
            margin-top: 30px;
            border-right: 4px solid #ffc107;
        }
        .btn {
            display: inline-block;
            background: #dc3545;
            color: white;
            padding: 12px 30px;
            border-radius: 10px;
            text-decoration: none;
            margin-top: 20px;
            font-weight: bold;
            transition: all 0.3s;
        }
        .btn:hover { background: #c82333; transform: translateY(-2px); }
        .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 نصب خودکار سیستم</h1>
        
        <?php foreach ($results as $result): ?>
            <?php
                $class = 'info';
                if (strpos($result, '✅') !== false) $class = 'success';
                if (strpos($result, '❌') !== false) $class = 'error';
            ?>
            <div class="result <?php echo $class; ?>">
                <?php echo $result; ?>
            </div>
        <?php endforeach; ?>
        
        <div class="warning">
            <strong>⚠️ هشدار امنیتی:</strong><br>
            لطفاً بعد از نصب، این فایل (install.php) را حذف کنید!
            <br><br>
            <a href="?delete=1" class="btn">حذف فایل نصب</a>
        </div>
        
        <div class="footer">
            اشک قلم - سیستم حسابداری هوشمند
        </div>
    </div>
</body>
</html>

<?php
// حذف خودکار فایل نصب
if (isset($_GET['delete']) && $_GET['delete'] == '1') {
    if (unlink(__FILE__)) {
        echo '<script>alert("✅ فایل نصب با موفقیت حذف شد!"); window.location.href="/";</script>';
    } else {
        echo '<script>alert("❌ لطفاً فایل install.php را به صورت دستی حذف کنید.");</script>';
    }
}
?>
