import fs from 'fs';
import path from 'path';

console.log('========================================');
console.log('آماده‌سازی خودکار پکیج توزیع (dist) اشک قلم');
console.log('========================================\n');

// ۱. حفظ خروجی Vite در dist؛ حذف آن باعث از دست رفتن index.html و شکست بسته‌بندی می‌شد.
if (fs.existsSync('dist')) {
    console.log('حفظ خروجی موجود Vite در پوشه dist...');
} else {
    console.log('ایجاد پوشه اصلی dist...');
    fs.mkdirSync('dist', { recursive: true });
}

// ۳. کپی فایل‌های build شده از dist-build
const copyDir = (src, dest) => {
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
};

if (fs.existsSync('dist-build')) {
    console.log('کپی فایل‌های کامپایل شده فرانت‌اند از dist-build...');
    copyDir('dist-build', 'dist');
}

if (!fs.existsSync(path.join('dist', 'index.html'))) {
    throw new Error('dist/index.html یافت نشد؛ ابتدا npm run build:web را اجرا کنید.');
}

// ۴. کپی فایل‌های PHP از host-backend و روت
console.log('کپی کلیه APIها و اسکریپت‌های PHP...');
if (fs.existsSync('host-backend')) {
    fs.readdirSync('host-backend').forEach(f => {
        const srcPath = path.join('host-backend', f);
        const destPath = path.join('dist', f);
        if (fs.statSync(srcPath).isFile()) {
            fs.copyFileSync(srcPath, destPath);
        } else if (fs.statSync(srcPath).isDirectory()) {
            copyDir(srcPath, destPath);
        }
    });
}

// ۵. کپی فایل‌های PHP موجود در روت
fs.readdirSync('.').filter(f => f.endsWith('.php')).forEach(f => {
    fs.copyFileSync(f, path.join('dist', f));
});

// ۶. کپی فایل‌های پیکربندی و سرور (.htaccess, .env.example, manifest, robots, etc.)
console.log('کپی فایل‌های پیکربندی و امنیتی...');
['.htaccess', 'backups.htaccess', '.env.example', 'manifest.json', 'sw.js', 'robots.txt'].forEach(f => {
    const srcPathBackend = path.join('host-backend', f);
    if (fs.existsSync(srcPathBackend)) {
        fs.copyFileSync(srcPathBackend, path.join('dist', f));
    } else if (fs.existsSync(f)) {
        fs.copyFileSync(f, path.join('dist', f));
    }
});

// ۷. کپی پوشه فونت‌ها و منابع آفلاین
if (fs.existsSync('fonts')) {
    console.log('کپی فونت‌های آفلاین...');
    copyDir('fonts', 'dist/fonts');
}

// ۸. کپی اسکریپت‌های Bash
if (fs.existsSync('host-backend')) {
    fs.readdirSync('host-backend').filter(f => f.endsWith('.sh')).forEach(f => {
        fs.copyFileSync(path.join('host-backend', f), path.join('dist', f));
    });
}

// ۹. ایجاد کلیه پوشه‌های داده، پشتیبان‌گیری، ذخیره فاکتورها، رسیدها و امضاها
console.log('ایجاد و پیکربندی ساختار فولدرهای ذخیره‌سازی، پشتیبان‌گیری و اسناد...');
const folders = [
    'dist/db',
    'dist/host-data',
    'dist/signatures',
    'dist/signatures/invoices',
    'dist/signatures/vouchers',
    'dist/signatures/contracts',
    'dist/signatures/financial-documents',
    'dist/signatures/reports',
    'dist/signatures/tax-declarations',
    'dist/uploads',
    'dist/invoices',
    'dist/vouchers',
    'dist/contracts',
    'dist/backups',
    'dist/daily-backups',
    'dist/api'
];

folders.forEach(f => {
    fs.mkdirSync(f, { recursive: true });
    // ایجاد فایل محافظ امنیتی جهت جلوگیری از مرور مستقیم فایل‌ها
    const guardFile = path.join(f, 'index.html');
    if (!fs.existsSync(guardFile)) {
        fs.writeFileSync(guardFile, '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Access Restricted</title></head><body style="font-family:sans-serif;text-align:center;padding:50px;"><h2>دسترسی مستقیم به این شاخه مسدود است</h2></body></html>', 'utf8');
    }
});

// ۱۰. اعمال محافظت htaccess برای پوشه‌های حساس پشتیبان
const backupHtaccess = `Order Deny,Allow
Deny from all
<FilesMatch "\\.(php|php5|phtml)$">
    Deny from all
</FilesMatch>`;

fs.writeFileSync('dist/backups/.htaccess', backupHtaccess, 'utf8');
fs.writeFileSync('dist/daily-backups/.htaccess', backupHtaccess, 'utf8');
fs.writeFileSync('dist/db/.htaccess', backupHtaccess, 'utf8');

// ۱۱. ایجاد راهنمای جامع استقرار در dist/README.txt
const readme = `# سامانه یکپارچه ابری و آفلاین اشک قلم - نسخه ۱۵.۸.۰
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

این بسته توزیع (dist) شامل تمامی کدهای کامپایل شده فرانت‌اند، موتورهای آفلاین، APIهای PHP،
پایگاه داده، سیستم امضای دیجیتال از راه دور و پوشه‌های پشتیبان‌گیری و ذخیره اسناد است.

راهنمای استقرار روی هاست:
۱. تمام فایل‌ها و پوشه‌های این شاخه را مستقیماً داخل روت هاست (public_html یا www) آپلود نمایید.
۲. فایل .env.example را بررسی و در صورت نیاز مقادیر دیتابیس را در فایل .env تنظیم نمایید.
۳. دسترسی (Permission) پوشه‌های زیر را روی 755 یا 777 قرار دهید:
   - db / host-data / signatures / uploads / backups / daily-backups / invoices / vouchers / contracts
۴. برای بررسی سلامت اولیه سیستم، آدرس yourdomain.com/health.php را در مرورگر باز کنید.
۵. قابلیت‌های آفلاین، تولید بارکد Code128 و QR Code استاندارد، اسکنر بارکد و دریافت امضای راه دور فعال و آماده به کار هستند.
`;
fs.writeFileSync('dist/README.txt', readme, 'utf8');

// شمارش فایل‌های نهایی
const countFiles = (dir) => {
    let count = 0;
    if (!fs.existsSync(dir)) return 0;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (let entry of entries) {
        if (entry.isDirectory()) {
            count += countFiles(path.join(dir, entry.name));
        } else {
            count++;
        }
    }
    return count;
};

console.log('\n========================================');
console.log('✅ بیلد و پکیج‌بندی کامل با موفقیت پایان یافت!');
console.log(`📊 مجموع فایل‌های آماده آپلود در dist: ${countFiles('dist')} فایل`);
console.log('========================================\n');
