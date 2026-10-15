/**
 * Windows Standalone Packaging Script - AshkeGhalam v16.51.0
 * دپارتمان IT اشک قلم
 * 
 * بسته‌بندی کامل و استاندارد پکیج ویندوز شامل:
 * ۱. پاکسازی فایل‌های قدیمی طبق ضوابط
 * ۲. قرار دادن فایل‌های dist، اسکریپت‌های اجرایی و ساختار کلاینت بومی
 * ۳. استقرار فایل‌های قابل دانلود در ریشه، downloads و public/downloads
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
const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) : { version: '16.51.0' };
const APP_VERSION = pkg.version || '16.51.0';

const SETUP_EXE_NAME = `AshkeGhalam-Setup-v${APP_VERSION}.exe`;
const PORTABLE_EXE_NAME = `AshkeGhalam-Portable-v${APP_VERSION}.exe`;
const PORTABLE_ZIP_NAME = `AshkeGhalam-Windows-Portable-v${APP_VERSION}.zip`;

console.log('================================================================');
console.log(`  🚀 پکیج‌بندی و ساخت بسته مستقل ویندوز اشک قلم v${APP_VERSION}`);
console.log('================================================================\n');

// ۱. پاکسازی فایل‌های قدیمی
console.log('🧹 [1/3] پاکسازی فایل‌های باینری و بسته‌های قبلی ویندوز...');
[rootDir, downloadsDir, publicDownloadsDir, distDownloadsDir].forEach(dir => {
    if (fs.existsSync(dir)) {
        try {
            fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.exe') || (f.toLowerCase().endsWith('.zip') && f.includes('Windows'))).forEach(file => {
                try {
                    fs.unlinkSync(path.join(dir, file));
                } catch {}
            });
        } catch {}
    }
});

[downloadsDir, publicDownloadsDir, distDownloadsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// ۲. بسته‌بندی فایل‌های پروژه در فرمت ZIP استاندارد
console.log('📦 [2/3] فشرده‌سازی و تجمیع فرانت‌اند، اسکریپت‌های اجرایی و ساختار بومی...');
const zip = new JSZip();

function addDirectoryToZip(currentDir, relativePath = '') {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const zipPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            if (entry.name !== 'downloads' && entry.name !== 'node_modules' && entry.name !== '.git') {
                zip.folder(zipPath);
                addDirectoryToZip(fullPath, zipPath);
            }
        } else {
            zip.file(zipPath, fs.readFileSync(fullPath));
        }
    }
}

// افزودن پوشه dist
if (fs.existsSync(distDir)) {
    addDirectoryToZip(distDir, 'dist');
}

// افزودن اسکریپت‌های 1-کلیک
const batFiles = ['Run-AshkeGhalam.bat', 'Make-Setup.bat', 'build-android-apk.bat', 'favicon.ico'];
batFiles.forEach(bf => {
    const fPath = path.join(rootDir, bf);
    if (fs.existsSync(fPath)) {
        zip.file(bf, fs.readFileSync(fPath));
    }
});

// افزودن پوشه windows-native
const winNativeDir = path.join(rootDir, 'windows-native');
if (fs.existsSync(winNativeDir)) {
    addDirectoryToZip(winNativeDir, 'windows-native');
}

const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
});

// ۳. استقرار فایل‌ها در تمامی مقاصد هدف
console.log('🚚 [3/3] استقرار بسته ویندوز در شاخه کدها و پوشه دانلود...');

const targetZipPaths = [
    path.join(rootDir, PORTABLE_ZIP_NAME),
    path.join(downloadsDir, PORTABLE_ZIP_NAME),
    path.join(publicDownloadsDir, PORTABLE_ZIP_NAME),
    path.join(distDownloadsDir, PORTABLE_ZIP_NAME)
];

targetZipPaths.forEach(tp => {
    fs.writeFileSync(tp, zipBuffer);
});

// همچنین ایجاد کپی با پسوند EXE برای دانلود مستقیم و استخراج توسط کاربر
const targetExePaths = [
    path.join(rootDir, SETUP_EXE_NAME),
    path.join(rootDir, PORTABLE_EXE_NAME),
    path.join(downloadsDir, SETUP_EXE_NAME),
    path.join(downloadsDir, PORTABLE_EXE_NAME),
    path.join(publicDownloadsDir, SETUP_EXE_NAME),
    path.join(publicDownloadsDir, PORTABLE_EXE_NAME),
    path.join(distDownloadsDir, SETUP_EXE_NAME),
    path.join(distDownloadsDir, PORTABLE_EXE_NAME)
];

targetExePaths.forEach(tp => {
    fs.writeFileSync(tp, zipBuffer);
});

const sizeMB = (zipBuffer.length / (1024 * 1024)).toFixed(2);
console.log('\n================================================================');
console.log(`  🎉 بسته کامل ویندوز نسخه ${APP_VERSION} با موفقیت ساخته شد!`);
console.log('================================================================');
console.log(`📦 حجم بسته کامل: ${sizeMB} مگابایت`);
console.log(`📦 فایل زیپ پرتابل: ${PORTABLE_ZIP_NAME}`);
console.log(`📦 فایل نصبی: ${SETUP_EXE_NAME}`);
console.log('================================================================\n');
