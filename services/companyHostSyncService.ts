/**
 * سرویس همگام‌سازی و ذخیره‌سازی اختصاصی اطلاعات و مدارک شرکت‌ها روی هاست
 * Dedicated Company Profiles & Assets Host Vault Service
 */

import { CompanyProfile } from '../types';
import { persistentStorage } from './persistentStorage';
import { workspaceService } from './workspaceService';
import { isHostConnectedOrAllowed } from '../utils';

export interface CompanyVaultSyncResult {
    success: boolean;
    count: number;
    timestamp: string;
    message?: string;
    error?: string;
}

export class CompanyHostSyncService {
    private static readonly STORAGE_KEY = 'company_vault';

    /**
     * ذخیره‌سازی ابری تمامی شرکت‌های ثبت‌شده به همراه لوگوها، امضاها و مهرها در بخش مجزای هاست
     */
    static async syncCompaniesToHost(companies: CompanyProfile[]): Promise<CompanyVaultSyncResult> {
        if (!isHostConnectedOrAllowed()) {
            localStorage.setItem('company_vault_local_backup', JSON.stringify(companies));
            return {
                success: true,
                count: companies.length,
                timestamp: new Date().toLocaleTimeString('fa-IR'),
                message: 'در حالت تست و لیمیت (بدون لایسنس تجاری)، هیچ ارتباطی با سایت و هاست برقرار نشد. داده‌ها به صورت کاملاً امن و محلی ذخیره شدند.'
            };
        }
        try {
            const saved = await persistentStorage.saveData(this.STORAGE_KEY, companies);
            if (!saved) throw new Error('ذخیره‌سازی امن اطلاعات شرکت‌ها روی سرور تأیید نشد.');
            
            // ذخیره وضعیت محلی
            localStorage.setItem('company_vault_last_sync', Date.now().toString());

            return {
                success: true,
                count: companies.length,
                timestamp: new Date().toLocaleTimeString('fa-IR'),
                message: 'اطلاعات شرکت‌ها در فضای کاری امن ذخیره شد.'
            };
        } catch (error: any) {
            console.warn('Company Vault Sync Fallback (offline mode):', error.message);
            // ذخیره پشتیبان لوکال
            localStorage.setItem('company_vault_local_backup', JSON.stringify(companies));
            return {
                success: false,
                count: companies.length,
                timestamp: new Date().toLocaleTimeString('fa-IR'),
                error: error.message || 'خطا در اتصال به سرور هاست'
            };
        }
    }

    /**
     * دریافت شرکت‌های ذخیره‌شده از بخش مجزای هاست
     */
    static async fetchCompaniesFromHost(): Promise<{ success: boolean; companies: CompanyProfile[] }> {
        if (!isHostConnectedOrAllowed()) {
            const local = localStorage.getItem('company_vault_local_backup');
            return {
                success: true,
                companies: local ? JSON.parse(local) : []
            };
        }
        try {
            const data = await persistentStorage.loadData(this.STORAGE_KEY, true);
            if (!Array.isArray(data)) throw new Error('اطلاعات فضای کاری از سرور در دسترس نیست.');
            return {
                success: true,
                companies: data as CompanyProfile[]
            };
        } catch (err: any) {
            console.warn('Could not fetch from host vault:', err.message);
            const local = localStorage.getItem('company_vault_local_backup');
            return {
                success: false,
                companies: local ? JSON.parse(local) : []
            };
        }
    }
}
