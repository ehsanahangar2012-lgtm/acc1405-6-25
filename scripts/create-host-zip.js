/**
 * Host Package ZIP Creator
 * دپارتمان IT اشک قلم - نسخه ۱۶.۴۶.۰
 * 
 * ساخت پکیج استقرار مستقیم روی هاست (cPanel / DirectAdmin / Apache)
 * ۱. پاکسازی صددرصدی پکیج‌های فشرده قبلی
 * ۲. فشرده‌سازی کلیه فایل‌های وب و PHP
 * ۳. استقرار در شاخه کدها، پوشه دانلود و پوشه توزیع
 */

import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

const rootDir = process.cwd();
const distDir = path.resolve(rootDir, 'dist');
const downloadsDir = path.resolve(rootDir, 'downloads');
const publicDownloadsDir = path.resolve(rootDir, 'public', 'downloads');
const distDownloadsDir = path.resolve(distDir, 'downloads');

const pkgPath = path.resolve(rootDir, 'package.json');
const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) : { version: '16.46.0' };
const APP_VERSION = pkg.version || '16.46.0';
const HOST_ZIP_NAME = `ashke-ghalam-host-v${APP_VERSION}.zip`;

console.log('====================================================');
console.log(`📦 در حال ساخت بسته فشرده ZIP هاستینگ اشک قلم v${APP_VERSION}...`);
console.log('====================================================\n');

// ۰. پاکسازی و حذف پکیج‌های فشرده قدیمی طبق قوانین پروژه
console.log('🧹 [1/3] در حال پاکسازی پکیج‌های فشرده قدیمی...');
const cleanDirs = [rootDir, downloadsDir, publicDownloadsDir, distDownloadsDir, distDir];

cleanDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
        try {
            const files = fs.readdirSync(dir);
            files.filter(f => f.toLowerCase().endsWith('.zip') && f.toLowerCase().startsWith('ashke-ghalam-host')).forEach(oldZip => {
                try {
                    fs.unlinkSync(path.join(dir, oldZip));
                    console.log(`   🗑️ فایل زیپ هاست قدیمی حذف شد: ${oldZip} از ${dir}`);
                } catch (_) {}
            });
        } catch (_) {}
    }
});

// اطمینان از وجود پوشه‌ها
[downloadsDir, publicDownloadsDir, distDownloadsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

if (!fs.existsSync(distDir)) {
    console.error('❌ پوشه dist یافت نشد! ابتدا بیلد پروژه را اجرا نمایید.');
    process.exit(1);
}

const zip = new JSZip();

function addDirectoryToZip(currentDir, relativePath = '') {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const zipPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
            if (entry.name !== 'downloads' && entry.name !== 'node_modules') {
                zip.folder(zipPath);
                addDirectoryToZip(fullPath, zipPath);
            }
        } else {
            const fileData = fs.readFileSync(fullPath);
            zip.file(zipPath, fileData);
        }
    }
}

console.log('📦 [2/3] در حال فشرده‌سازی کلیه فایل‌ها، اسکریپت‌های PHP و وب‌هوک‌ها...');
addDirectoryToZip(distDir);

// افزودن راهنمای استقرار
const quickDeployGuide = `
راهنمای استقرار فوری بسته اشک قلم بر روی هاست اشتراکی (cPanel / DirectAdmin):
---------------------------------------------------------------------------------
نسخه: ${APP_VERSION}
۱. محتویات این فایل زیپ را مستقیماً داخل پوشه public_html یا روت ساب‌دامین خود اکسترکت (Extract) کنید.
۲. مطمئن شوید فایل .htaccess به همراه کلیه فایل‌ها اکسترکت شده باشد.
۳. در صورت استفاده از دیتابیس MySQL، مشخصات اتصال را در فایل .env تنظیم نمایید.
۴. آدرس your-domain.com/health.php را در مرورگر باز کنید تا سلامت سرور تایید شود.
۵. تمامی امکانات شامل فاکتور، انتخاب شرکت/شعبه، صدور مهر و امضای دیجیتال، انبارداری و اتصال پیامک فعال هستند.
`;
zip.file('QUICK_START_HOST.txt', quickDeployGuide);

console.log('🚚 [3/3] در حال تولید و استقرار پکیج فشرده...');
try {
    const content = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 }
    });

    const targetPaths = [
        path.join(rootDir, HOST_ZIP_NAME),
        path.join(rootDir, 'ashke-ghalam-host-package.zip'),
        path.join(rootDir, 'dist.zip'),
        path.join(downloadsDir, HOST_ZIP_NAME),
        path.join(publicDownloadsDir, HOST_ZIP_NAME),
        path.join(distDownloadsDir, HOST_ZIP_NAME),
        path.join(distDir, HOST_ZIP_NAME),
        path.join(distDir, 'dist.zip')
    ];

    targetPaths.forEach(targetPath => {
        try {
            fs.writeFileSync(targetPath, content);
        } catch (_) {}
    });

    const sizeInMB = (content.length / (1024 * 1024)).toFixed(2);
    console.log(`\n✅ فایل‌های پکیج هاست با موفقیت با نام ورژن ایجاد گردیدند:`);
    console.log(`📁 پکیج نسخه‌دار ریشه: ${rootDir}/${HOST_ZIP_NAME}`);
    console.log(`📁 پکیج شاخه دانلود:   ${downloadsDir}/${HOST_ZIP_NAME}`);
    console.log(`📊 حجم بسته نهایی:     ${sizeInMB} مگابایت`);
    console.log('====================================================\n');
} catch (err) {
    console.error('❌ خطا در ساخت فایل ZIP:', err);
    process.exit(1);
}
