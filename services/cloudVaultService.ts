/**
 * Cloud Backup Vault Service - گاوصندوق ابری پشتیبان‌گیری و همگام‌سازی خودکار
 * ذخیره‌سازی ابری ایمن، رمزنگاری کلاینت، تاریخچه نسخه‌ها و بازیابی آنی
 */

export interface CloudVaultPlan {
    id: 'FREE' | 'SILVER' | 'GOLD';
    name: string;
    maxStorageMb: number;
    usedStorageMb: number;
    expireDate: string;
    isEncrypted: boolean;
    autoDailyBackup: boolean;
    retentionDays: number;
}

export interface CloudBackupSnapshot {
    id: string;
    fileName: string;
    createdAt: string;
    sizeKb: number;
    recordCount: number;
    deviceHwid: string;
    deviceName: string;
    sha256Hash: string;
    isEncrypted: boolean;
    storageUrl?: string;
    backupDataJson?: string;
}

const STORAGE_KEY_VAULT_PLAN = 'ashk_cloud_vault_plan';
const STORAGE_KEY_VAULT_SNAPSHOTS = 'ashk_cloud_vault_snapshots';
const STORAGE_KEY_VAULT_SETTINGS = 'ashk_cloud_vault_settings';

export class CloudVaultService {
    static getPlan(): CloudVaultPlan {
        // Local browser preferences are not a subscription ledger or proof of an
        // encrypted cloud service. Never synthesize storage quota/expiry values.
        return {
            id: 'FREE',
            name: 'سرویس ابری به سرور واقعی متصل نشده',
            maxStorageMb: 0,
            usedStorageMb: 0,
            expireDate: '—',
            isEncrypted: false,
            autoDailyBackup: false,
            retentionDays: 0
        };
    }

    static savePlan(_plan: CloudVaultPlan): void {
        throw new Error('پلن و سهمیهٔ گاوصندوق باید از سرویس واقعی و احرازشده دریافت شود؛ ذخیرهٔ محلی به‌عنوان اشتراک معتبر پذیرفته نیست.');
    }

    static getSnapshots(): CloudBackupSnapshot[] {
        // Intentionally do not return old mock rows as cloud snapshots. Older builds
        // may still have legacy entries in localStorage; the real UI now uses the
        // authenticated host-backup API and never treats these as remote files.
        return [];
    }

    static async uploadSnapshot(
        _backupData: any,
        _metadata?: { recordCount?: number; customNote?: string }
    ): Promise<CloudBackupSnapshot> {
        // The previous implementation only saved plaintext JSON to localStorage
        // after a delay. Failing closed prevents callers from falsely reporting that
        // an upload or client-side encryption succeeded.
        throw new Error('این شبیه‌ساز محلی حذف شده است. از گاوصندوق ابری متصل به API واقعی و تأییدشده استفاده کنید.');
    }

    static deleteSnapshot(_id: string): void {
        throw new Error('حذف بکاپ ابری فقط باید از endpoint واقعی سرور انجام شود.');
    }}
