// آدرس ثابت هاست - همیشه به این آدرس متصل می‌شود
const HOST_BASE_URL = 'https://acc.ashkghalam.ir';

// تشخیص محیط اجرا
const isLocalhost = Boolean(
  typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
  )
);

export const isProduction = !isLocalhost;

// Base URL برای API - همیشه از هاست اصلی استفاده می‌کند
const getBaseUrl = () => {
  // اولویت اول: متغیر محیطی
  const envUrl = import.meta.env.VITE_APP_BASE_URL;
  if (envUrl) return envUrl;
  
  // اولویت دوم: آدرس ثابت هاست
  return HOST_BASE_URL;
};

// تنظیمات API
export const API_CONFIG = {
  BASE_URL: getBaseUrl(),
  
  // سیستم امضای دیجیتال
  SIGNATURE_API: `${getBaseUrl()}/signature-api-simple.php`,
  
  // سیستم ذخیره‌سازی
  STORAGE_API: `${getBaseUrl()}/host-storage-api.php`,
  
  // سیستم پشتیبان‌گیری
  BACKUP_API: `${getBaseUrl()}/server-api-backup.php`,
  
  // سیستم آپلود
  UPLOAD_API: `${getBaseUrl()}/server-api-upload.php`,
  
  // سیستم دیتابیس
  DATABASE_API: `${getBaseUrl()}/host-api.php`,
  
  // Health check
  HEALTH_API: `${getBaseUrl()}/health.php`,
  
  // Storage
  STORAGE_PHP: `${getBaseUrl()}/storage.php`,
};

// تنظیمات ویژگی‌ها
export const FEATURES = {
  // استفاده از API سرور - همیشه فعال
  USE_SERVER_API: true,
  
  // سینک کراس دیوایس - همیشه فعال
  ENABLE_CROSS_DEVICE_SYNC: true,
  
  // سینک خودکار با هاست - همیشه فعال
  ENABLE_AUTO_SYNC: true,
  
  // پشتیبان‌گیری خودکار
  ENABLE_AUTO_BACKUP: true,
  
  // ذخیره‌سازی لوکال
  USE_LOCAL_STORAGE: true, // همیشه فعال برای fallback
};

// اولویت ذخیره‌سازی
export const STORAGE_PRIORITY = {
  // اولویت اول: ذخیره مستقیم روی هاست
  PRIMARY: 'HOST',
  // اولویت دوم: کش موقت در صورت آفلاین
  FALLBACK: 'LOCAL',
  // حداکثر زمان انتظار برای هاست (ms)
  HOST_TIMEOUT: 5000,
  // تعداد تلاش مجدد
  MAX_RETRIES: 3,
};

// پیام‌های محیط
export const ENV_MESSAGES = {
  LOCAL: 'حالت توسعه - متصل به هاست اصلی',
  PRODUCTION: 'حالت تولید - متصل به سرور'
};

export const CURRENT_ENV = isProduction ? 'PRODUCTION' : 'LOCAL';
export const ENV_MESSAGE = isProduction ? ENV_MESSAGES.PRODUCTION : ENV_MESSAGES.LOCAL;

export { isLocalhost, HOST_BASE_URL };
