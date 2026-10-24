/**
 * اسکریپت پاکسازی کامل فایل‌های بیلد و کامپایل شده - اشک قلم v16.55.0
 * دپارتمان IT اشک قلم
 * 
 * وظایف این اسکریپت:
 * ۱. حذف تمامی پوشه‌های dist و dist_electron (خروجی‌های بیلد)
 * ۲. حذف فایل‌های نصبی تولید شده (exe, apk, zip)
 * ۳. بازگرداندن محیط به حالت اولیه برای یک بیلد تمیز
 */

import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();

const itemsToCleanup = [
    path.resolve(rootDir, 'dist'),
    path.resolve(rootDir, 'dist_electron'),
    path.resolve(rootDir, 'downloads'),
];

console.log('================================================================');
console.log('  🧹 سامانه پاکسازی فایل‌های بیلد و کامپایل شده - اشک قلم v16.55.0');
console.log('================================================================\n');

// ۱. حذف پوشه‌ها
itemsToCleanup.forEach(item => {
    if (fs.existsSync(item)) {
        console.log(`   🗑️ حذف پوشه: ${item}`);
        try {
            fs.rmSync(item, { recursive: true, force: true });
        } catch (e) {
            console.error(`   ❌ خطا در حذف پوشه ${item}:`, e.message);
        }
    }
});

// ۲. حذف فایل‌های باینری و نصبی (exe, apk, zip)
const filesToCleanup = fs.readdirSync(rootDir).filter(file => {
    const lower = file.toLowerCase();
    return (lower.endsWith('.exe') || lower.endsWith('.apk') || lower.endsWith('.zip')) && lower.includes('ashkeghalam');
});

filesToCleanup.forEach(file => {
    const filePath = path.resolve(rootDir, file);
    console.log(`   🗑️ حذف فایل نصبی: ${file}`);
    try {
        fs.unlinkSync(filePath);
    } catch (e) {
        console.error(`   ❌ خطا در حذف فایل ${file}:`, e.message);
    }
});

console.log('\n================================================================');
console.log('  🎉 پاکسازی با موفقیت انجام شد. محیط بیلد اکنون کاملاً تمیز است.');
console.log('================================================================\n');
