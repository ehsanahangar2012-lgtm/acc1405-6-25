<?php
/**
 * اسکریپت نصب و ایجاد خودکار پوشه‌های بکآپ
 * فقط یکبار اجرا کنید
 */

header('Content-Type: text/html; charset=utf-8');

echo "<!DOCTYPE html>
<html dir='rtl'>
<head>
    <meta charset='UTF-8'>
    <title>نصب سیستم بکآپ</title>
    <style>
        body { font-family: Tahoma; padding: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        .success { color: #27ae60; padding: 10px; background: #d5f4e6; border-radius: 5px; margin: 10px 0; }
        .error { color: #c0392b; padding: 10px; background: #fadbd8; border-radius: 5px; margin: 10px 0; }
        .info { color: #2980b9; padding: 10px; background: #d6eaf8; border-radius: 5px; margin: 10px 0; }
        ul { line-height: 2; }
        .btn { display: inline-block; padding: 10px 20px; background: #3498db; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
    </style>
</head>
<body>
<div class='container'>
<h1>🚀 نصب سیستم بکآپ</h1>";

$folders = [
    'backups' => ['invoices', 'vouchers', 'checks', 'customers', 'products', 'transactions'],
    'daily-backups' => ['invoices', 'vouchers', 'checks', 'customers', 'products', 'transactions'],
    'uploads' => ['invoices', 'vouchers', 'checks', 'signatures']
];

$created = [];
$errors = [];

foreach ($folders as $root => $subfolders) {
    $rootPath = __DIR__ . '/' . $root;
    
    if (!is_dir($rootPath)) {
        if (mkdir($rootPath, 0755, true)) {
            $created[] = $root;
        } else {
            $errors[] = "خطا در ایجاد: $root";
            continue;
        }
    }
    
    foreach ($subfolders as $subfolder) {
        $path = $rootPath . '/' . $subfolder;
        if (!is_dir($path)) {
            if (mkdir($path, 0755, true)) {
                $created[] = "$root/$subfolder";
            } else {
                $errors[] = "خطا در ایجاد: $root/$subfolder";
            }
        }
    }
}

// ایجاد فایل .htaccess برای امنیت
$htaccess = "Options -Indexes\nDeny from all";
foreach (['backups', 'daily-backups'] as $dir) {
    $htaccessPath = __DIR__ . '/' . $dir . '/.htaccess';
    if (!file_exists($htaccessPath)) {
        file_put_contents($htaccessPath, $htaccess);
        $created[] = "$dir/.htaccess (امنیت)";
    }
}

if (!empty($created)) {
    echo "<div class='success'><strong>✅ موفق!</strong> پوشه‌های زیر ایجاد شدند:<ul>";
    foreach ($created as $item) {
        echo "<li>$item</li>";
    }
    echo "</ul></div>";
}

if (!empty($errors)) {
    echo "<div class='error'><strong>❌ خطاها:</strong><ul>";
    foreach ($errors as $error) {
        echo "<li>$error</li>";
    }
    echo "</ul></div>";
}

// بررسی دسترسی نوشتن
$testFile = __DIR__ . '/backups/test.txt';
if (file_put_contents($testFile, 'test')) {
    unlink($testFile);
    echo "<div class='success'>✅ دسترسی نوشتن: فعال</div>";
} else {
    echo "<div class='error'>❌ دسترسی نوشتن: غیرفعال - لطفاً مجوزها را بررسی کنید</div>";
}

echo "<div class='info'>
<strong>📋 ساختار نهایی:</strong>
<pre>
├── backups/
│   ├── invoices/
│   ├── vouchers/
│   ├── checks/
│   ├── customers/
│   ├── products/
│   └── transactions/
├── daily-backups/
│   └── (همان ساختار بالا)
└── uploads/
    ├── invoices/
    ├── vouchers/
    ├── checks/
    └── signatures/
</pre>
</div>";

echo "<div class='info'>
<strong>🔒 امنیت:</strong> فایل .htaccess برای جلوگیری از دسترسی مستقیم ایجاد شد.
</div>";

echo "<a href='backup-system.php?action=get_backup_list&type=invoices' class='btn'>تست سیستم بکآپ</a>";

echo "</div></body></html>";
?>
