/**
 * سامانه عیب‌یابی و صحت‌سنجی دارایی‌های اندروید APK - اشک قلم v16.54.0
 * دپارتمان IT اشک قلم
 * 
 * وظایف این اسکریپت:
 * ۱. بررسی وجود پوشه dist و فایل حیاتی index.html فرانت‌اند
 * ۲. بررسی و همگام‌سازی پوشه android/app/src/main/assets/public/
 * ۳. جلوگیری از خطای معروف "Missing index.html" در پکیج‌بندی Capacitor/APK
 * ۴. گزارش جامع عیب‌یابی به زبان فارسی و کاملاً آفلاین
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const rootDir = process.cwd();
const distDir = path.resolve(rootDir, 'dist');
const androidAssetsPublicDir = path.resolve(rootDir, 'android', 'app', 'src', 'main', 'assets', 'public');
const pkgPath = path.resolve(rootDir, 'package.json');

const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) : { version: '16.54.0' };
const APP_VERSION = pkg.version || '16.54.0';

console.log('================================================================');
console.log(`  🔍 سامانه عیب‌یابی و صحت‌سنجی اندروید APK اشک قلم v${APP_VERSION}`);
console.log('  🏢 نرم‌افزار حسابداری و اتوماسیون مالی اشک قلم (AshkeGhalam)');
console.log('================================================================\n');

let hasError = false;

// مرحله ۱: بررسی ساختار dist
console.log('[1/4] بررسی وجود پوشه ساخت (dist) و index.html...');
if (!fs.existsSync(distDir) || !fs.existsSync(path.join(distDir, 'index.html'))) {
    console.log('   ⚠️ پوشه dist یا index.html یافت نشد. در حال اجرای بیلد خودکار Vite...');
    try {
        execSync('npx vite build', { stdio: 'inherit' });
        console.log('   ✅ بیلد Vite با موفقیت انجام شد.');
    } catch (e) {
        console.error('   ❌ خطا در اجرای بیلد Vite:', e.message);
        hasError = true;
    }
} else {
    console.log('   ✅ پوشه dist و فایل index.html موجود و معتبر است.');
}

// مرحله ۲: بررسی و همگام‌سازی پوشه assets/public اندروید
console.log('\n[2/4] بررسی پوشه assets/public پروژه اندروید...');
if (!fs.existsSync(androidAssetsPublicDir)) {
    console.log('   ⚠️ پوشه android/app/src/main/assets/public وجود ندارد. در حال ایجاد...');
    try {
        fs.mkdirSync(androidAssetsPublicDir, { recursive: true });
        console.log('   ✅ پوشه assets/public ایجاد شد.');
    } catch (e) {
        console.error('   ❌ خطا در ایجاد پوشه assets/public:', e.message);
        hasError = true;
    }
} else {
    console.log('   ✅ پوشه assets/public موجود است.');
}

// مرحله ۳: کپی و همگام‌سازی محتوای dist به android/app/src/main/assets/public
console.log('\n[3/4] همگام‌سازی فایل‌های وب به داخل پوشه assets اندروید...');
function copyRecursive(src, dest) {
    if (!fs.existsSync(src)) return;
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

try {
    if (fs.existsSync(distDir)) {
        copyRecursive(distDir, androidAssetsPublicDir);
        console.log('   ✅ فایل‌های پوشه dist با موفقیت به assets/public منتقل شدند.');
    } else {
        // ایجاد index.html اضطراری در صورت عدم دسترسی به dist
        const fallbackHtml = '<html dir="rtl"><head><meta charset="utf-8"><title>AshkeGhalam v' + APP_VERSION + '</title></head><body><h1>اشک قلم - سیستم آفلاین</h1></body></html>';
        fs.writeFileSync(path.join(androidAssetsPublicDir, 'index.html'), fallbackHtml);
        console.log('   ⚠️ فایل index.html اضطراری در assets/public درج شد.');
    }
} catch (e) {
    console.error('   ❌ خطا در کپی فایل‌ها:', e.message);
    hasError = true;
}

// مرحله ۴: اعتبارسنجی نهایی وجود index.html در assets
console.log('\n[4/4] اعتبارسنجی نهایی فایل ورود (index.html) در پکیج اندروید...');
const targetIndexHtml = path.join(androidAssetsPublicDir, 'index.html');
if (fs.existsSync(targetIndexHtml)) {
    const stats = fs.statSync(targetIndexHtml);
    console.log(`   ✅ تایید نهایی: فایل index.html با موفقیت در پوشه assets اندروید مستقر است. (حجم: ${stats.size} بایت)`);
} else {
    console.error('   ❌ خطای بحران: فایل index.html همچنان در پوشه assets وجود ندارد!');
    hasError = true;
}

console.log('\n================================================================');
if (!hasError) {
    console.log('  🎉 عیب‌یابی و صحت‌سنجی دارایی‌های اندروید با موفقیت کامل پایان یافت!');
    console.log('  📱 پکیج اندروید آماده ساخت بدون هیچ‌گونه خطای تجزیه است.');
} else {
    console.log('  ⚠️ عیب‌یابی با هشدار یا خطاهایی مواجه شد. لطفاً گزارش بالا را بررسی کنید.');
}
console.log('================================================================\n');
