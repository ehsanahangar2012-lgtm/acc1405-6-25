// Android Native APK Build & Packaging Script with Capacitor
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const rootDir = process.cwd();
const distDir = path.resolve(rootDir, 'dist');
const capacitorConfigPath = path.resolve(rootDir, 'capacitor.config.json');

const pkgPath = path.resolve(rootDir, 'package.json');
const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) : { version: '16.27.0' };
const APP_VERSION = pkg.version || '16.27.0';

console.log('================================================================');
console.log(`  📱 سامانه بیلد خودکار پکیج APK اندروید اشک قلم v${APP_VERSION}`);
console.log('  🏢 نرم‌افزار حسابداری و اتوماسیون مالی اشک قلم (AshkeGhalam)');
console.log('================================================================\n');

// ۰. پاکسازی و حذف فایل‌های بیلد قدیمی طبق قوانین پروژه
console.log('🧹 در حال پاکسازی فایل‌های APK و بیلد‌های قدیمی...');
try {
    const rootFiles = fs.readdirSync(rootDir);
    rootFiles.filter(f => f.startsWith('AshkeGhalam-') && f.endsWith('.apk')).forEach(oldFile => {
        try {
            fs.unlinkSync(path.join(rootDir, oldFile));
            console.log(`🗑️ فایل APK قدیمی حذف شد: ${oldFile}`);
        } catch {}
    });
} catch {}

// ۱. بررسی یا ایجاد پوشه خروجی dist
if (!fs.existsSync(distDir) || !fs.existsSync(path.join(distDir, 'index.html'))) {
    console.log('⚡ پوشه dist موجود نیست یا نیاز به بیلد دارد. در حال اجرای Vite build...');
    try {
        execSync('npm run build', { stdio: 'inherit' });
        console.log('✅ بیلد وب با موفقیت در پوشه dist ایجاد شد.\n');
    } catch (err) {
        console.error('❌ خطا در ساخت خروجی وب:', err.message);
        process.exit(1);
    }
} else {
    console.log('✅ پوشه dist آماده است.');
}

// ۲. بررسی فایل تنظیمات Capacitor
const APP_NAME_PERSIAN = "حسابداری اشک قلم";
if (!fs.existsSync(capacitorConfigPath)) {
    const defaultConfig = {
        appId: "ir.ashkghalam.acc",
        appName: APP_NAME_PERSIAN,
        webDir: "dist",
        bundledWebRuntime: false
    };
    fs.writeFileSync(capacitorConfigPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
    console.log('✅ فایل capacitor.config.json ایجاد شد.');
}

const capacitorConfig = JSON.parse(fs.readFileSync(capacitorConfigPath, 'utf-8'));
if (capacitorConfig.appName !== APP_NAME_PERSIAN) {
    capacitorConfig.appName = APP_NAME_PERSIAN;
    fs.writeFileSync(capacitorConfigPath, JSON.stringify(capacitorConfig, null, 2), 'utf-8');
}
console.log(`📌 شناسه برنامه (AppID): ${capacitorConfig.appId}`);
console.log(`📌 نام برنامه: ${capacitorConfig.appName}`);

const androidDir = path.resolve(rootDir, 'android');

// ۳. ایجاد پلتفرم اندروید در صورت عدم وجود
if (!fs.existsSync(androidDir)) {
    console.log('\n📦 در حال افزودن پلتفرم نیتیو اندروید (npx cap add android)...');
    try {
        execSync('npx cap add android', { stdio: 'inherit' });
        console.log('✅ پوشه پلتفرم اندروید با موفقیت ایجاد شد.');
    } catch (err) {
        console.warn('⚠️ افزودن اندروید با هشدار مواجه شد:', err.message);
    }
}

// تنظیم نام برنامه در منابع محلی اندروید (strings.xml) و مجوزهای دوربین (AndroidManifest.xml)
const stringsXmlPath = path.join(androidDir, 'app', 'src', 'main', 'res', 'values', 'strings.xml');
if (fs.existsSync(stringsXmlPath)) {
    try {
        let stringsContent = fs.readFileSync(stringsXmlPath, 'utf-8');
        stringsContent = stringsContent.replace(/<string name="app_name">.*?<\/string>/g, `<string name="app_name">${APP_NAME_PERSIAN}</string>`);
        stringsContent = stringsContent.replace(/<string name="title_activity_main">.*?<\/string>/g, `<string name="title_activity_main">${APP_NAME_PERSIAN}</string>`);
        fs.writeFileSync(stringsXmlPath, stringsContent, 'utf-8');
        console.log('✅ نام برنامه در strings.xml به «حسابداری اشک قلم» تنظیم گردید.');
    } catch (e) {
        console.warn('⚠️ خطا در ویرایش strings.xml:', e.message);
    }
}

const manifestPath = path.join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml');
if (fs.existsSync(manifestPath)) {
    try {
        let manifestContent = fs.readFileSync(manifestPath, 'utf-8');
        const requiredPermissions = [
            '<uses-permission android:name="android.permission.CAMERA" />',
            '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />',
            '<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29" />',
            '<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />',
            '<uses-feature android:name="android.hardware.camera" android:required="false" />',
            '<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />'
        ];
        let permissionsToAdd = [];
        for (const perm of requiredPermissions) {
            const permMatch = perm.match(/name="([^"]+)"/);
            if (permMatch && !manifestContent.includes(`name="${permMatch[1]}"`)) {
                permissionsToAdd.push(`    ${perm}`);
            }
        }
        if (permissionsToAdd.length > 0) {
            manifestContent = manifestContent.replace(
                '</manifest>',
                `${permissionsToAdd.join('\n')}\n</manifest>`
            );
            fs.writeFileSync(manifestPath, manifestContent, 'utf-8');
            console.log('✅ مجوزهای دوربین و گالری در AndroidManifest.xml ثبت شدند.');
        }
    } catch (e) {
        console.warn('⚠️ خطا در ویرایش AndroidManifest.xml:', e.message);
    }
}

// ۴. همگام‌سازی کدهای وب با پوشه نیتیو اندروید
console.log('\n🔄 در حال همگام‌سازی دارایی‌های وب با پروژه اندروید (Capacitor Sync)...');
try {
    execSync('npx cap sync android', { stdio: 'inherit' });
    console.log('✅ همگام‌سازی با موفقیت انجام شد.');
} catch (err) {
    console.warn('⚠️ خطای همگام‌سازی Capacitor:', err.message);
}

// ۵. کامپایل خودکار به فایل نصبی APK با Gradle
console.log('\n🔨 در حال کامپایل پروژه و تولید فایل APK با موتور Gradle...');
const isWindows = process.platform === 'win32';
const gradlewCmd = isWindows ? 'gradlew.bat assembleDebug' : './gradlew assembleDebug';
const gradlewPath = path.join(androidDir, isWindows ? 'gradlew.bat' : 'gradlew');

let apkBuilt = false;
if (fs.existsSync(gradlewPath)) {
    try {
        console.log(`⚙️ در حال اجرای ${gradlewCmd}...`);
        execSync(gradlewCmd, { cwd: androidDir, stdio: 'inherit' });
        apkBuilt = true;
    } catch (err) {
        console.log('\n⚠️ کامپایل مستقیم با Gradle به دلیل عدم تنظیم Java JDK یا Android SDK در ویندوز کامل نشد.');
        console.log('💡 راهکارهای جایگزین فوری:');
        console.log('   ۱. استفاده از سایت‌های آنلاین بدون نیاز به نصب هیچ ابزار (PWABuilder یا WebIntoApp)');
        console.log('   ۲. باز کردن پروژه در Android Studio با دستور: npx cap open android');
        console.log('   ۳. استفاده از سرویس خودکار GitHub Actions');
    }
}

const apkDebugPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

if (fs.existsSync(apkDebugPath)) {
    const stats = fs.statSync(apkDebugPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log('\n================================================================');
    console.log('  🎉 فایل نصبی APK اندروید با موفقیت تولید شد!');
    console.log(`  📂 مسیر فایل: ${apkDebugPath}`);
    console.log(`  📦 حجم فایل نصبی: ${sizeMB} مگابایت`);
    console.log('================================================================\n');

    // کپی به ریشه پروژه یا dist برای دسترسی آسان
    try {
        const rootApkPath = path.join(rootDir, 'AshkeGhalam-Debug.apk');
        fs.copyFileSync(apkDebugPath, rootApkPath);
        console.log(`✅ یک نسخه در ریشه پروژه قرار گرفت: ${rootApkPath}`);
    } catch {}
} else if (!apkBuilt) {
    console.log('\n📌 پروژه اندروید در پوشه android/ آماده است.');
    console.log('برای خروجی گرفتن می‌توانید:');
    console.log('۱) در اندروید استودیو باز کنید: npx cap open android');
    console.log('۲) از ابزارهای آنلاین فوری (مانند pwabuilder.com) استفاده نمایید.');
}
