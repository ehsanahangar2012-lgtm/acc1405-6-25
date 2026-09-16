// Windows Standalone Executable Packaging & Installer Script
import fs from 'fs';
import path from 'path';
import { spawn, execSync } from 'child_process';

const rootDir = process.cwd();
const distDir = path.resolve(rootDir, 'dist');
const electronDir = path.resolve(rootDir, 'electron');
const outputDir = path.resolve(rootDir, 'dist_electron');

console.log('================================================================');
console.log('  🚀 آغاز فرآیند ساخت فایل نصبی ویندوز (Windows NSIS Setup)');
console.log('  🏢 نرم‌افزار حسابداری و اتوماسیون مالی اشک قلم (AshkeGhalam)');
console.log('================================================================\n');

// 1. بررسی و ساخت بیلد فرانت‌اند
const indexHtmlPath = path.join(distDir, 'index.html');
if (!fs.existsSync(indexHtmlPath)) {
    console.log('⚡ پوشه dist یافت نشد. در حال اجرای بیلد برنامه با Vite...');
    try {
        execSync('npm run build', { stdio: 'inherit' });
        console.log('✅ بیلد فرانت‌اند با موفقیت انجام شد.\n');
    } catch (err) {
        console.error('❌ خطا در کامپایل و بیلد فرانت‌اند:', err.message);
        process.exit(1);
    }
} else {
    console.log('✅ پوشه خروجی dist موجود و آماده پکیج‌بندی است.');
}

// 2. بررسی فایل‌های حیاتی الکترون
if (!fs.existsSync(path.join(electronDir, 'main.cjs'))) {
    console.error('❌ فایل اصلی الکترون (electron/main.cjs) یافت نشد!');
    process.exit(1);
}

// 3. خواندن اطلاعات نسخه و نام بسته
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
const appVersion = packageJson.version || '16.11.0';
const productName = packageJson.build?.productName || 'AshkeGhalam';

console.log(`📌 نام محصول: ${productName}`);
console.log(`📌 نسخه: ${appVersion}`);
console.log(`📌 شناسه برنامه (AppID): ${packageJson.build?.appId || 'ir.ashkghalam.acc'}`);

// 4. تعیین تارگت بیلد بر اساس پارامترهای ورودی
const args = process.argv.slice(2);
let builderArgs = ['electron-builder', '--win'];

if (args.includes('--portable')) {
    console.log('🎯 حالت انتخاب‌شده: Portable Executable');
    builderArgs.push('portable');
} else if (args.includes('--all')) {
    console.log('🎯 حالت انتخاب‌شده: هر دو خروجی NSIS Installer + Portable');
    builderArgs.push('nsis', 'portable');
} else {
    console.log('🎯 حالت انتخاب‌شده: استاندارد نصبی ویندوز (NSIS Installer Setup)');
    builderArgs.push('nsis');
}

console.log('\n📦 در حال اجرای electron-builder...');

// 5. اجرای مستقیم electron-builder
const isWindows = process.platform === 'win32';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

const builderProcess = spawn(npxCmd, builderArgs, {
    stdio: 'inherit',
    shell: true,
    cwd: rootDir
});

builderProcess.on('close', (code) => {
    if (code === 0) {
        console.log('\n================================================================');
        console.log('  🎉 ساخت فایل نصبی ویندوز با موفقیت انجام شد!');
        console.log('================================================================');
        console.log(`📁 پوشه خروجی: ${outputDir}`);
        console.log(`📦 فایل نصبی تولید شده: ${productName}-Setup-${appVersion}.exe`);
        console.log('✨ ویژگی‌های این فایل نصبی:');
        console.log('   - قابلیت انتخاب مسیر نصب دلخواه توسط کاربر');
        console.log('   - تفکیک کامل فایل‌های نصبی از دیتابیس حسابداری (%APPDATA%\\AshkeGhalam)');
        console.log('   - حفظ ۱۰۰٪ امن دیتابیس و داده‌های مالی هنگام آپدیت و حذف نصب');
        console.log('   - ایجاد Shortcut در Desktop و منوی Start ویندوز');
        console.log('   - فایل Uninstaller واقعی و استاندارد ویندوز');
        console.log('================================================================\n');
    } else {
        console.error(`\n❌ ساخت پکیج ویندوز با کد خطای ${code} متوقف شد.`);
        console.log('💡 راهنمای رفع مشکل خطا در استخراج یا ساخت سمبلیک لینک (Symbolic Link / winCodeSign):');
        console.log('   این خطا به دلیل محدودیت امنیتی ویندوز در ساخت سمبلیک لینک برای مک (Darwin) رخ می‌دهد.');
        console.log('   برای حل سریع این مشکل، یکی از دو راهکار ساده زیر را انجام دهید:');
        console.log('\n   راهکار ۱ (ساده‌ترین): خط فرمان (CMD یا PowerShell) خود را به صورت Run as Administrator باز کنید و دوباره دستور را اجرا کنید.');
        console.log('\n   راهکار ۲ (دائمی): ویژگی Developer Mode را در ویندوز خود فعال کنید:');
        console.log('   - وارد Settings ویندوز شوید.');
        console.log('   - به بخش Privacy & security -> For developers بروید.');
        console.log('   - گزینه Developer Mode را روشن (On) کنید.');
        console.log('\n   پس از انجام یکی از دو مورد فوق، مجدداً دستور زیر را اجرا کنید:');
        console.log('   npm run build:installer');
        console.log('================================================================\n');
        process.exit(code || 1);
    }
});
