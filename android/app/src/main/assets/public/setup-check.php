<?php
/**
 * اسکریپت بررسی و راهاندازی محیط هاست
 * این فایل را در ریشه هاست اجرا کنید تا تنظیمات بررسی شود
 */

header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>بررسی محیط هاست</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: Tahoma, Arial, sans-serif;
            background: #f5f5f5;
            padding: 20px;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 10px;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2c3e50;
            margin-bottom: 30px;
            text-align: center;
        }
        .check-item {
            padding: 15px;
            margin: 10px 0;
            border-radius: 5px;
            display: flex;
            align-items: center;
            gap: 15px;
        }
        .check-item.success {
            background: #d4edda;
            border-right: 4px solid #28a745;
        }
        .check-item.error {
            background: #f8d7da;
            border-right: 4px solid #dc3545;
        }
        .check-item.warning {
            background: #fff3cd;
            border-right: 4px solid #ffc107;
        }
        .icon {
            font-size: 24px;
            min-width: 30px;
        }
        .details {
            flex: 1;
        }
        .details strong {
            display: block;
            margin-bottom: 5px;
        }
        .details small {
            color: #666;
        }
        .section {
            margin: 30px 0;
        }
        .section h2 {
            color: #34495e;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #3498db;
        }
        .info-box {
            background: #e3f2fd;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }
        .code {
            background: #f4f4f4;
            padding: 10px;
            border-radius: 3px;
            font-family: monospace;
            margin: 10px 0;
        }
        .btn {
            display: inline-block;
            padding: 10px 20px;
            background: #3498db;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 10px 5px;
        }
        .btn:hover {
            background: #2980b9;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 بررسی محیط هاست</h1>

        <?php
        $checks = [];
        $errors = [];
        $warnings = [];

        // بررسی نسخه PHP
        $phpVersion = phpversion();
        if (version_compare($phpVersion, '7.4.0', '>=')) {
            $checks[] = [
                'status' => 'success',
                'title' => 'نسخه PHP',
                'message' => "نسخه PHP: $phpVersion ✓"
            ];
        } else {
            $errors[] = [
                'status' => 'error',
                'title' => 'نسخه PHP',
                'message' => "نسخه PHP قدیمی است: $phpVersion (حداقل 7.4 نیاز است)"
            ];
        }

        // بررسی پوشهها
        $requiredDirs = [
            'backups' => 'پوشه بکاپ اصلی',
            'backups/checks' => 'بکاپ چکها',
            'backups/customers' => 'بکاپ مشتریان',
            'backups/invoices' => 'بکاپ فاکتورها',
            'backups/products' => 'بکاپ محصولات',
            'backups/transactions' => 'بکاپ تراکنشها',
            'backups/vouchers' => 'بکاپ سندها',
            'daily-backups' => 'بکاپ روزانه',
            'uploads' => 'پوشه آپلود',
            'uploads/checks' => 'آپلود چکها',
            'uploads/invoices' => 'آپلود فاکتورها',
            'uploads/signatures' => 'آپلود امضاها',
            'uploads/vouchers' => 'آپلود سندها'
        ];

        foreach ($requiredDirs as $dir => $label) {
            if (!file_exists($dir)) {
                @mkdir($dir, 0755, true);
                if (file_exists($dir)) {
                    $checks[] = [
                        'status' => 'success',
                        'title' => $label,
                        'message' => "پوشه $dir ایجاد شد ✓"
                    ];
                } else {
                    $errors[] = [
                        'status' => 'error',
                        'title' => $label,
                        'message' => "نمیتوان پوشه $dir را ایجاد کرد"
                    ];
                }
            } else {
                if (is_writable($dir)) {
                    $checks[] = [
                        'status' => 'success',
                        'title' => $label,
                        'message' => "پوشه $dir موجود و قابل نوشتن است ✓"
                    ];
                } else {
                    $warnings[] = [
                        'status' => 'warning',
                        'title' => $label,
                        'message' => "پوشه $dir موجود است اما قابل نوشتن نیست"
                    ];
                }
            }
        }

        // بررسی فایلهای PHP
        $requiredFiles = [
            'api.php' => 'API اصلی',
            'host-api.php' => 'Host API',
            'health.php' => 'Health Check',
            'storage.php' => 'Storage API'
        ];

        foreach ($requiredFiles as $file => $label) {
            if (file_exists($file)) {
                $checks[] = [
                    'status' => 'success',
                    'title' => $label,
                    'message' => "فایل $file موجود است ✓"
                ];
            } else {
                $errors[] = [
                    'status' => 'error',
                    'title' => $label,
                    'message' => "فایل $file یافت نشد"
                ];
            }
        }

        // بررسی .htaccess
        if (file_exists('.htaccess')) {
            $checks[] = [
                'status' => 'success',
                'title' => 'فایل .htaccess',
                'message' => 'فایل .htaccess موجود است ✓'
            ];
        } else {
            $warnings[] = [
                'status' => 'warning',
                'title' => 'فایل .htaccess',
                'message' => 'فایل .htaccess یافت نشد - URL Rewriting ممکن است کار نکند'
            ];
        }

        // بررسی SSL
        $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') 
                   || $_SERVER['SERVER_PORT'] == 443;
        
        if ($isHttps) {
            $checks[] = [
                'status' => 'success',
                'title' => 'SSL/HTTPS',
                'message' => 'SSL فعال است ✓'
            ];
        } else {
            $warnings[] = [
                'status' => 'warning',
                'title' => 'SSL/HTTPS',
                'message' => 'SSL فعال نیست - توصیه میشود HTTPS را فعال کنید'
            ];
        }

        // نمایش نتایج
        ?>

        <div class="section">
            <h2>✅ موارد موفق (<?php echo count($checks); ?>)</h2>
            <?php foreach ($checks as $check): ?>
                <div class="check-item <?php echo $check['status']; ?>">
                    <div class="icon">✓</div>
                    <div class="details">
                        <strong><?php echo $check['title']; ?></strong>
                        <small><?php echo $check['message']; ?></small>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>

        <?php if (!empty($warnings)): ?>
        <div class="section">
            <h2>⚠️ هشدارها (<?php echo count($warnings); ?>)</h2>
            <?php foreach ($warnings as $warning): ?>
                <div class="check-item <?php echo $warning['status']; ?>">
                    <div class="icon">⚠</div>
                    <div class="details">
                        <strong><?php echo $warning['title']; ?></strong>
                        <small><?php echo $warning['message']; ?></small>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
        <?php endif; ?>

        <?php if (!empty($errors)): ?>
        <div class="section">
            <h2>❌ خطاها (<?php echo count($errors); ?>)</h2>
            <?php foreach ($errors as $error): ?>
                <div class="check-item <?php echo $error['status']; ?>">
                    <div class="icon">✗</div>
                    <div class="details">
                        <strong><?php echo $error['title']; ?></strong>
                        <small><?php echo $error['message']; ?></small>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
        <?php endif; ?>

        <div class="info-box">
            <h3>📋 اطلاعات سرور</h3>
            <div class="code">
                <strong>PHP Version:</strong> <?php echo phpversion(); ?><br>
                <strong>Server Software:</strong> <?php echo $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown'; ?><br>
                <strong>Document Root:</strong> <?php echo $_SERVER['DOCUMENT_ROOT']; ?><br>
                <strong>Current Path:</strong> <?php echo __DIR__; ?><br>
                <strong>HTTPS:</strong> <?php echo $isHttps ? 'Yes' : 'No'; ?>
            </div>
        </div>

        <div class="info-box">
            <h3>🔗 لینکهای تست</h3>
            <a href="health.php" class="btn" target="_blank">تست Health Check</a>
            <a href="host-api.php?action=test" class="btn" target="_blank">تست Host API</a>
            <a href="test-host-connection.html" class="btn" target="_blank">تست اتصال کامل</a>
        </div>

        <?php if (empty($errors)): ?>
        <div class="info-box" style="background: #d4edda;">
            <h3>✅ محیط آماده است!</h3>
            <p>تمام تنظیمات اولیه انجام شده است. مراحل بعدی:</p>
            <ol>
                <li>در اپلیکیشن به Settings بروید</li>
                <li>Host API URL را تنظیم کنید</li>
                <li>یک دیتای تست ایجاد کنید</li>
                <li>Sync را فعال کنید</li>
            </ol>
        </div>
        <?php else: ?>
        <div class="info-box" style="background: #f8d7da;">
            <h3>❌ نیاز به رفع مشکلات</h3>
            <p>لطفاً خطاهای بالا را برطرف کنید و سپس این صفحه را رفرش کنید.</p>
        </div>
        <?php endif; ?>

    </div>
</body>
</html>
