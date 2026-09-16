import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

console.log('====================================================');
console.log('📦 در حال ساخت بسته فشرده ZIP جهت بارگذاری مستقیم روی هاست...');
console.log('====================================================\n');

const distDir = path.resolve('dist');

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
            // ساخت شاخه در فایل زیپ
            zip.folder(zipPath);
            addDirectoryToZip(fullPath, zipPath);
        } else {
            // خواندن فایل و افزودن به زیپ
            const fileData = fs.readFileSync(fullPath);
            zip.file(zipPath, fileData);
        }
    }
}

console.log('در حال فشرده‌سازی کلیه فایل‌ها، اسکریپت‌های PHP، وب‌هوک‌ها، ساختار دیتابیس و فرانت‌اند...');
addDirectoryToZip(distDir);

// افزودن فایل‌های کمکی استقرار به ریشه زیپ
const quickDeployGuide = `
راهنمای استقرار فوری بسته اشک قلم بر روی هاست اشتراکی (cPanel / DirectAdmin):
---------------------------------------------------------------------------------
۱. محتویات این فایل زیپ را مستقیماً داخل پوشه public_html یا روت ساب‌دامین خود اکسترکت (Extract) کنید.
۲. مطمئن شوید فایل .htaccess به همراه کلیه فایل‌ها اکسترکت شده باشد.
۳. در صورت استفاده از دیتابیس MySQL، مشخصات اتصال را در فایل .env تنظیم نمایید.
۴. آدرس your-domain.com/health.php را در مرورگر باز کنید تا سلامت سرور تایید شود.
۵. تمامی امکانات شامل فاکتور، انتخاب شرکت/شعبه، صدور مهر و امضای دیجیتال، انبارداری و اتصال پیامک فعال هستند.
`;

zip.file('QUICK_START_HOST.txt', quickDeployGuide);

const targetZipPath = path.resolve('ashke-ghalam-host-package.zip');

try {
    const content = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 }
    });

    fs.writeFileSync(targetZipPath, content);
    fs.writeFileSync(path.resolve('dist.zip'), content);

    if (fs.existsSync(distDir)) {
        fs.writeFileSync(path.join(distDir, 'ashke-ghalam-host-package.zip'), content);
        fs.writeFileSync(path.join(distDir, 'dist.zip'), content);
    }
    
    const sizeInMB = (content.length / (1024 * 1024)).toFixed(2);
    console.log(`\n✅ فایل زیپ با موفقیت در بدنه پروژه ایجاد گردید:`);
    console.log(`📁 مسیر: ${targetZipPath}`);
    console.log(`📁 فایل جایگزین: ${path.resolve('dist.zip')}`);
    console.log(`📊 حجم بسته نهایی: ${sizeInMB} مگابایت`);
    console.log('====================================================\n');
} catch (err) {
    console.error('❌ خطا در ساخت فایل ZIP:', err);
    process.exit(1);
}
