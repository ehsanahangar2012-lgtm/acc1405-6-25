/**
 * Triple Redundant Auto Backup Service
 * پشتیبان‌گیری ۳ گانه هوشمند و ایزوله
 * ۱. هارد دیسک محلی ویندوز / کش دیتابیس محلی
 * ۲. حافظه داخلی اپلیکیشن اندروید
 * ۳. مخزن امن هاست و فضای ابری متمرکز
 */

import CryptoJS from 'crypto-js';
import { idbService } from './indexedDBService';
import { hostBackupService } from './hostBackupService';
import { hasNativeBackupStorage, getNativeBackupValue, setNativeBackupValue } from './nativeBackupStorage';
import { useFinancialStore } from '../store-financial';
import { getPersianDate } from '../utils';

export interface BackupTierStatus {
    tierId: 'windows_local' | 'device_file' | 'cloud_vault';
    name: string;
    description: string;
    lastBackupDate?: string;
    status: 'ACTIVE' | 'SYNCED' | 'WAITING' | 'ERROR';
    itemCount: number;
    sha256Hash?: string;
    sizeBytes: number;
}

export interface TripleBackupReport {
    timestamp: number;
    persianDate: string;
    tiers: BackupTierStatus[];
    overallSuccess: boolean;
    sha256: string;
}

const STORAGE_KEY_TRIPLE_REPORT = 'triple-backup:report';
const STORAGE_KEY_LOCAL_BACKUP = 'triple-backup:latest';

export class TripleBackupService {
    /**
     * اجرای پشتیبان‌گیری ۳ گانه همزمان
     */
    static async executeTripleBackup(accountingData: any): Promise<TripleBackupReport> {
        const completeData = {
            ...accountingData,
            financialData: useFinancialStore.getState()
        };
        const payloadString = JSON.stringify(completeData);
        const hash = CryptoJS.SHA256(payloadString).toString();
        const sizeBytes = new Blob([payloadString]).size;
        const nowPersian = getPersianDate() + ' ' + new Date().toLocaleTimeString('fa-IR');

        // Tier 1 uses OS/Keystore-backed encryption on native apps. Only browser/PWA
        // falls back to IndexedDB, which must never be described as hardware-backed encryption.
        const nativeProtectedStore = hasNativeBackupStorage();
        let tier1Status: BackupTierStatus['status'] = 'SYNCED';
        try {
            if (nativeProtectedStore) {
                await setNativeBackupValue(STORAGE_KEY_LOCAL_BACKUP, JSON.stringify({
                    data: payloadString,
                    hash,
                    date: nowPersian,
                    updatedAt: Date.now()
                }));
            } else {
                await idbService.save('backups', {
                    id: STORAGE_KEY_LOCAL_BACKUP,
                    data: payloadString,
                    hash,
                    date: nowPersian,
                    updatedAt: Date.now()
                });
            }
        } catch {
            tier1Status = 'ERROR';
        }

        // This tier means an additional actual file, not merely an internal database copy.
        // Android portable file export is user-initiated from the Commercial Hub, so this
        // tier stays WAITING until a native file has actually been written by this flow.
        let tier2Status: BackupTierStatus['status'] = 'WAITING';
        let tier3Status: BackupTierStatus['status'] = 'WAITING';
        try {
            const result = await hostBackupService.createBackup(accountingData, 'manual', 'پشتیبان چندمسیره');
            tier2Status = result.localFileStatus || 'WAITING';
            tier3Status = result.remoteStatus || (result.remoteSaved ? 'SYNCED' : 'WAITING');
        } catch {
            tier2Status = 'ERROR';
            tier3Status = 'ERROR';
        }

        const count = Object.keys(completeData || {}).reduce((acc, key) => {
            return acc + (Array.isArray(completeData[key]) ? completeData[key].length : 1);
        }, 0);

        const report: TripleBackupReport = {
            timestamp: Date.now(),
            persianDate: nowPersian,
            sha256: hash,
            overallSuccess: tier1Status === 'SYNCED' && tier2Status === 'SYNCED' && tier3Status === 'SYNCED',
            tiers: [
                {
                    tierId: 'windows_local',
                    name: nativeProtectedStore ? 'نسخه محلی رمزگذاری‌شده روی دستگاه' : 'نسخه محلی مرورگر (IndexedDB)',
                    description: nativeProtectedStore
                        ? 'در نسخه نصب‌شدهٔ ویندوز/اندروید با قابلیت رمزگذاری سیستم‌عامل یا Android Keystore نگهداری می‌شود؛ بازگردانی فایل به دستگاه دیگر از مسیر رمز عبور فایل قابل‌حمل انجام می‌شود.'
                        : 'در مخزن محلی مرورگر نگهداری می‌شود؛ ممکن است با پاک‌سازی داده‌های مرورگر یا پروفایل از دست برود و رمزگذاری سخت‌افزاری ندارد.',
                    lastBackupDate: tier1Status === 'SYNCED' ? nowPersian : undefined,
                    status: tier1Status,
                    itemCount: tier1Status === 'SYNCED' ? count : 0,
                    sha256Hash: tier1Status === 'SYNCED' ? hash.substring(0, 16) + '...' : undefined,
                    sizeBytes: tier1Status === 'SYNCED' ? sizeBytes : 0
                },
                {
                    tierId: 'device_file',
                    name: 'نسخه مستقل روی دیسک ویندوز',
                    description: 'تنها پس از نوشتن یک فایل واقعی و مستقل ثبت می‌شود. در ویندوز مسیر انتخابی سیستم‌عامل استفاده می‌شود؛ در اندروید از مرکز تجاری همراه، ذخیرهٔ رمزگذاری‌شده با انتخاب مسیر انجام می‌شود و این مورد تا تأیید فایل همچنان در انتظار می‌ماند.',
                    lastBackupDate: tier2Status === 'SYNCED' ? nowPersian : undefined,
                    status: tier2Status,
                    itemCount: tier2Status === 'SYNCED' ? count : 0,
                    sha256Hash: tier2Status === 'SYNCED' ? undefined : undefined,
                    sizeBytes: tier2Status === 'SYNCED' ? sizeBytes : 0
                },
                {
                    tierId: 'cloud_vault',
                    name: 'نسخه پشتیبان سرور مرکزی',
                    description: 'فقط پس از تأیید موفق API پشتیبان‌گیری سرور ثبت می‌شود؛ رمزگذاری در حالت سکون هنوز نیازمند تنظیم و پیاده‌سازی است',
                    lastBackupDate: tier3Status === 'SYNCED' ? nowPersian : undefined,
                    status: tier3Status,
                    itemCount: tier3Status === 'SYNCED' ? count : 0,
                    sha256Hash: tier3Status === 'SYNCED' ? hash.substring(0, 16) + '...' : undefined,
                    sizeBytes: tier3Status === 'SYNCED' ? sizeBytes : 0
                }
            ]
        };

        try {
            if (nativeProtectedStore) {
                await setNativeBackupValue(STORAGE_KEY_TRIPLE_REPORT, JSON.stringify(report));
            } else {
                await idbService.save('backups', { id: STORAGE_KEY_TRIPLE_REPORT, report });
            }
        } catch (error) {
            console.warn('Unable to save backup status report locally:', error);
        }
        return report;
    }

    /**
     * دریافت آخرین وضعیت گزارش پشتیبان‌گیری ۳ گانه
     */
    static async getLastReport(): Promise<TripleBackupReport | null> {
        try {
            if (hasNativeBackupStorage()) {
                const raw = await getNativeBackupValue(STORAGE_KEY_TRIPLE_REPORT);
                if (raw === null) return null;
                const report = JSON.parse(raw);
                return report && Array.isArray(report.tiers) ? report as TripleBackupReport : null;
            }
            const saved = await idbService.get('backups', STORAGE_KEY_TRIPLE_REPORT);
            const report = saved?.report;
            if (report && Array.isArray(report.tiers)) return report as TripleBackupReport;
        } catch {}
        return null;
    }
}
