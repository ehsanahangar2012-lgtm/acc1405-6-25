/**
 * سرویس همگام‌سازی و ذخیره‌سازی اختصاصی اطلاعات و مدارک شرکت‌ها روی هاست
 * Dedicated Company Profiles & Assets Host Vault Service
 */

import { CompanyProfile } from '../types';
import { API_CONFIG } from '../config';
import { safeFetchJson, isHostConnectedOrAllowed } from '../utils';

export interface CompanyVaultSyncResult {
    success: boolean;
    count: number;
    timestamp: string;
    message?: string;
    error?: string;
}

export class CompanyHostSyncService {
    private static baseUrl = API_CONFIG.BASE_URL;

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
            const data = await safeFetchJson(`${this.baseUrl}/api.php?action=company_vault`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ companies })
            });

            if (!data) {
                throw new Error('پاسخ نامعتبر از هاست');
            }
            
            // ذخیره وضعیت محلی
            localStorage.setItem('company_vault_last_sync', Date.now().toString());

            return {
                success: true,
                count: companies.length,
                timestamp: new Date().toLocaleTimeString('fa-IR'),
                message: data.message || 'اطلاعات شرکت‌ها با موفقیت در مخزن مجزای هاست ذخیره شد.'
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
            const data = await safeFetchJson(`${this.baseUrl}/api.php?action=company_vault`, {
                method: 'GET'
            });

            if (!data) throw new Error('خطا در فراخوانی اطلاعات از هاست');
            return {
                success: true,
                companies: data.companies || []
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
