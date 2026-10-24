/**
 * سرویس جامع ثبت و رصد بلادرنگ رویدادها، خطاهای برنامه و سینک (AppLogService)
 * دپارتمان IT اشک قلم - نسخه ۱۶.۴۴.۰
 * 
 * ویژگی‌ها:
 * ۱. رصد زنده خطاهای Runtime جاوااسکریپت و Promise‌های رد شده
 * ۲. ثبت وقایع همگام‌سازی (Pull, Push, Queue, Conflict, Offline)
 * ۳. پشتیبانی از اشتراک بلادرنگ (Pub/Sub) جهت نمایش زنده در DebugCenter بدون افت فریم
 * ۴. خروجی استاندارد گزارش تشخیصی جهت عیب‌یابی از راه دور (Remote Troubleshooting) در شرایط قطعی اینترنت
 * ۵. سازگار با تاریخ شمسی و ذخیره‌سازی آفلاین در IndexedDB
 */

import { getPersianDate, getPersianTime, toPersianDigits, generateId } from '../utils';
import { idbService } from './indexedDBService';

export type LogLevel = 'error' | 'warn' | 'info' | 'sync';
export type LogCategory = 'ERROR' | 'SYNC' | 'STORAGE' | 'SECURITY' | 'NETWORK' | 'SYSTEM';

export interface AppLogEntry {
    id: string;
    timestamp: number;
    shamsiDate: string;
    shamsiTime: string;
    level: LogLevel;
    category: LogCategory;
    message: string;
    source?: string;
    details?: any;
    resolved?: boolean;
}

type LogListener = (entry: AppLogEntry, allLogs: AppLogEntry[]) => void;

class AppLogService {
    private logs: AppLogEntry[] = [];
    private readonly MAX_LOGS = 500;
    private listeners: Set<LogListener> = new Set();
    private isInitialized = false;

    constructor() {
        if (typeof window !== 'undefined') {
            this.initGlobalCapture();
        }
    }

    /**
     * فعال‌سازی دریافت خودکار خطاهای سیستمی جاوااسکریپت
     */
    private initGlobalCapture() {
        if (this.isInitialized) return;
        this.isInitialized = true;

        // دریافت خطاهای ذخیره شده قبلی از لوکال استوریج
        this.loadStoredLogs();

        // شنود خطاهای مدیریت‌نشده ویندوز/مرورگر
        window.addEventListener('error', (event: ErrorEvent) => {
            this.addLog({
                level: 'error',
                category: 'ERROR',
                message: event.message || 'خطای ناشناخته در زمان اجرا (Runtime Error)',
                source: event.filename ? `${event.filename.split('/').pop()}:${event.lineno}` : 'Window',
                details: {
                    line: event.lineno,
                    col: event.colno,
                    stack: event.error?.stack || null
                }
            });
        });

        // شنود خطاهای Promise رد شده
        window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
            const reason = event.reason;
            const message = typeof reason === 'string' ? reason : reason?.message || 'خطای پرامیس رد شده (Unhandled Rejection)';
            this.addLog({
                level: 'error',
                category: 'ERROR',
                message,
                source: 'PromiseRejection',
                details: {
                    reason: reason?.stack || reason || 'No details'
                }
            });
        });

        // شنود وضعیت اتصال اینترنت
        window.addEventListener('online', () => {
            this.addLog({
                level: 'info',
                category: 'NETWORK',
                message: 'ارتباط اینترنتی برقرار شد (Online).',
                source: 'NetworkMonitor'
            });
        });

        window.addEventListener('offline', () => {
            this.addLog({
                level: 'warn',
                category: 'NETWORK',
                message: 'ارتباط اینترنتی قطع شد. سیستم در حالت کارکرد آفلاین مستقل قرار گرفت.',
                source: 'NetworkMonitor'
            });
        });

        // رصد ایمن console.error بدون ایجاد حلقه تکرار
        const originalConsoleError = console.error;
        console.error = (...args: any[]) => {
            try {
                const message = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
                if (!message.includes('__skip_log__') && !message.includes('Download rejected')) {
                    this.addLog({
                        level: 'error',
                        category: 'ERROR',
                        message: message.slice(0, 300),
                        source: 'console.error',
                        details: args.length === 1 && typeof args[0] === 'object' ? args[0] : args
                    }, false);
                }
            } catch {}
            originalConsoleError.apply(console, args);
        };
    }

    private loadStoredLogs() {
        try {
            const raw = localStorage.getItem('ashk_recent_system_logs');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    this.logs = parsed.slice(-100);
                }
            }
        } catch {}
    }

    private persistRecentLogs() {
        try {
            const trimmed = this.logs.slice(-100);
            localStorage.setItem('ashk_recent_system_logs', JSON.stringify(trimmed));
        } catch {}
    }

    /**
     * افزودن لاگ جدید به صورت بلادرنگ
     */
    public addLog(entry: {
        level: LogLevel;
        category: LogCategory;
        message: string;
        source?: string;
        details?: any;
    }, persistToIDB = true): AppLogEntry {
        const fullEntry: AppLogEntry = {
            id: generateId(),
            timestamp: Date.now(),
            shamsiDate: getPersianDate(),
            shamsiTime: getPersianTime(),
            level: entry.level,
            category: entry.category,
            message: entry.message,
            source: entry.source || 'AppCore',
            details: entry.details,
            resolved: false
        };

        this.logs.unshift(fullEntry);
        if (this.logs.length > this.MAX_LOGS) {
            this.logs.pop();
        }

        // اطلاع‌رسانی به تمامی شنوندگان فعال
        this.notifyListeners(fullEntry);
        this.persistRecentLogs();

        // ذخیره خطاهای بحرانی در indexedDB جهت عیب‌یابی آتی
        if (persistToIDB && (entry.level === 'error' || entry.category === 'SYNC')) {
            try {
                idbService.save('error_logs', {
                    id: `log_${fullEntry.id}`,
                    timestamp: fullEntry.timestamp,
                    date: fullEntry.shamsiDate,
                    time: fullEntry.shamsiTime,
                    message: fullEntry.message,
                    level: fullEntry.level,
                    category: fullEntry.category,
                    source: fullEntry.source,
                    details: fullEntry.details
                }).catch(() => {});
            } catch {}
        }

        return fullEntry;
    }

    /**
     * ثبت اختصاصی رویداد همگام‌سازی (Synchronization Event)
     */
    public logSync(
        action: 'pull_start' | 'pull_success' | 'pull_error' | 'push_start' | 'push_success' | 'push_error' | 'queue_enqueue' | 'queue_process' | 'queue_empty' | 'conflict_resolved',
        message: string,
        details?: any
    ) {
        let level: LogLevel = 'sync';
        if (action.endsWith('_error')) level = 'error';
        else if (action === 'conflict_resolved') level = 'warn';

        return this.addLog({
            level,
            category: 'SYNC',
            message: `[همگام‌سازی] ${message}`,
            source: 'SyncCoordinator',
            details: { action, ...details }
        });
    }

    /**
     * ثبت اختصاصی عملیات پایگاه‌داده و ذخیره‌سازی
     */
    public logStorage(operation: string, storeName: string, details?: any, isError = false) {
        return this.addLog({
            level: isError ? 'error' : 'info',
            category: 'STORAGE',
            message: `[دیتابیس] عملیات ${operation} روی مخزن ${storeName}`,
            source: 'IndexedDBService',
            details
        });
    }

    /**
     * ثبت اختصاصی خطا
     */
    public logError(message: string, error?: any, source?: string) {
        return this.addLog({
            level: 'error',
            category: 'ERROR',
            message,
            source: source || 'ErrorHandler',
            details: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error
        });
    }

    /**
     * دریافت لیست تمامی لاگ‌های ثبت شده
     */
    public getLogs(): AppLogEntry[] {
        return [...this.logs];
    }

    /**
     * اشتراک جهت دریافت بلادرنگ لاگ‌ها
     */
    public subscribe(listener: LogListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private notifyListeners(entry: AppLogEntry) {
        this.listeners.forEach(listener => {
            try {
                listener(entry, this.getLogs());
            } catch (err) {
                console.warn('Log listener error:', err);
            }
        });
    }

    /**
     * پاکسازی لاگ‌ها
     */
    public clearLogs() {
        this.logs = [];
        try {
            localStorage.removeItem('ashk_recent_system_logs');
        } catch {}
        this.notifyListeners({
            id: generateId(),
            timestamp: Date.now(),
            shamsiDate: getPersianDate(),
            shamsiTime: getPersianTime(),
            level: 'info',
            category: 'SYSTEM',
            message: 'فهرست لاگ‌های محلی پاکسازی شد.',
            source: 'AppLogService'
        });
    }

    /**
     * تولید لاگ تستی جهت تست مانیتورینگ زنده توسط کاربر
     */
    public triggerTestLog(type: 'error' | 'sync' | 'warn' | 'info') {
        const shamsiNow = `${getPersianDate()} ${getPersianTime()}`;
        if (type === 'error') {
            this.addLog({
                level: 'error',
                category: 'ERROR',
                message: `تست خطای سیستمی در تاریخ ${toPersianDigits(shamsiNow)} (ایجاد شده توسط کاربر)`,
                source: 'ManualDebugTrigger',
                details: { test: true, simulation: 'شبیه‌سازی خطای اتصال به دیتابیس یا کرش داخلی' }
            });
        } else if (type === 'sync') {
            this.logSync('push_success', `ارسال موفقیت‌آمیز ۲۴ سند حسابداری به سرور در ${toPersianDigits(shamsiNow)}`, {
                invoicesCount: 14,
                vouchersCount: 10,
                durationMs: 340,
                status: 'OK'
            });
        } else if (type === 'warn') {
            this.addLog({
                level: 'warn',
                category: 'SECURITY',
                message: `هشدار عدم تطابق اسکوپ دیتابیس در ${toPersianDigits(shamsiNow)} (تست شده)`,
                source: 'SecurityInspector',
                details: { warningType: 'SCOPE_CHECK_SIMULATION' }
            });
        } else {
            this.addLog({
                level: 'info',
                category: 'SYSTEM',
                message: `بررسی وضعیت سلامت پلتفرم اشک قلم در ${toPersianDigits(shamsiNow)} - همه سرویس‌ها فعالند.`,
                source: 'HealthCheck'
            });
        }
    }

    /**
     * استخراج گزارش جامع عیب‌یابی به صورت متن فارسی
     */
    public generateTroubleshootingReport(): string {
        const shamsiNow = `${getPersianDate()} - ${getPersianTime()}`;
        const totalLogs = this.logs.length;
        const errorCount = this.logs.filter(l => l.level === 'error').length;
        const syncCount = this.logs.filter(l => l.category === 'SYNC').length;

        const navInfo = typeof navigator !== 'undefined' ? {
            userAgent: navigator.userAgent,
            onLine: navigator.onLine,
            language: navigator.language,
            platform: navigator.platform
        } : {};

        let report = `====================================================\n`;
        report += `گزارش عیب‌یابی فنی و لاگ‌های سیستم حسابداری اشک قلم\n`;
        report += `نسخه: ۱۶.۴۴.۰ | تاریخ شمسی: ${shamsiNow}\n`;
        report += `تعداد کل لاگ‌ها: ${totalLogs} | خطاها: ${errorCount} | رویدادهای همگام‌سازی: ${syncCount}\n`;
        report += `وضعیت اتصال: ${navInfo.onLine ? 'آنلاین' : 'آفلاین'}\n`;
        report += `محیط اجرا: ${navInfo.userAgent || 'نامشخص'}\n`;
        report += `====================================================\n\n`;

        this.logs.forEach((log, index) => {
            report += `[#${index + 1}] [${log.shamsiDate} ${log.shamsiTime}] [${log.level.toUpperCase()}] [${log.category}]\n`;
            report += `منبع: ${log.source || 'سیستم'}\n`;
            report += `پیام: ${log.message}\n`;
            if (log.details) {
                try {
                    report += `جزئیات: ${JSON.stringify(log.details, null, 2)}\n`;
                } catch {
                    report += `جزئیات: ${String(log.details)}\n`;
                }
            }
            report += `----------------------------------------------------\n`;
        });

        return report;
    }
}

export const appLogService = new AppLogService();
