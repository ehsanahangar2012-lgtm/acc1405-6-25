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
import { workspaceService } from './workspaceService';
import { useFinancialStore } from '../store-financial';
import { getPersianDate } from '../utils';

export interface BackupTierStatus {
    tierId: 'windows_local' | 'android_storage' | 'cloud_vault';
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

const STORAGE_KEY_TRIPLE_REPORT = 'triple_backup_report';
const STORAGE_KEY_LOCAL_BACKUP = 'ashk_triple_backup_local';

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

        // Tier 1 is a local IndexedDB snapshot on this device only.
        let tier1Status: BackupTierStatus['status'] = 'SYNCED';
        try {
            await idbService.save('backups', {
                id: STORAGE_KEY_LOCAL_BACKUP,
                data: payloadString,
                hash,
                date: nowPersian,
                updatedAt: Date.now()
            });
        } catch {
            tier1Status = 'ERROR';
        }

        // A genuinely separate OS-file backup is not implemented yet. Never claim
        // that another key in the same IndexedDB database is an independent copy.
        const tier2Status: BackupTierStatus['status'] = 'WAITING';

        // Tier 3 is successful only after a configured, authenticated host backup confirms success.
        let tier3Status: BackupTierStatus['status'] = 'WAITING';
        if (
            workspaceService.isRemoteCloudConfigured() &&
            (typeof navigator === 'undefined' || navigator.onLine)
        ) {
            try {
                const result = await hostBackupService.createBackup(accountingData, 'manual', 'پشتیبان چندمسیره');
                tier3Status = result.success ? 'SYNCED' : 'ERROR';
            } catch {
                tier3Status = 'ERROR';
            }
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
                    name: 'نسخه محلی برنامه (IndexedDB همین دستگاه)',
                    description: 'نسخه محلی برای بازیابی سریع؛ با پاک‌سازی داده‌های برنامه یا مرورگر ممکن است از دست برود و به‌تنهایی کافی نیست',
                    lastBackupDate: tier1Status === 'SYNCED' ? nowPersian : undefined,
                    status: tier1Status,
                    itemCount: tier1Status === 'SYNCED' ? count : 0,
                    sha256Hash: tier1Status === 'SYNCED' ? hash.substring(0, 16) + '...' : undefined,
                    sizeBytes: tier1Status === 'SYNCED' ? sizeBytes : 0
                },
                {
                    tierId: 'android_storage',
                    name: 'نسخه مستقل روی فایل‌سیستم دستگاه',
                    description: 'ذخیره‌سازی مستقل روی دیسک ویندوز یا پوشه خصوصی اندروید هنوز پیاده‌سازی نشده است؛ این لایه عمداً موفق گزارش نمی‌شود',
                    status: tier2Status,
                    itemCount: 0,
                    sizeBytes: 0
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
            await idbService.save('backups', { id: STORAGE_KEY_TRIPLE_REPORT, report });
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
            const saved = await idbService.get('backups', STORAGE_KEY_TRIPLE_REPORT);
            const report = saved?.report;
            if (report && Array.isArray(report.tiers)) {
                return report as TripleBackupReport;
            }
        } catch {}
        return null;
    }
}
