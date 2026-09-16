// Workspace & Multi-Tenant Management Service
// مدیریت فضاهای کاری مجزا، استقلال نسخه دسکتاپ و پیکربندی بدون تداخل با سایر مشتریان
import { HOST_BASE_URL } from '../config';

export interface WorkspaceConfig {
    workspaceId: string;           // شناسه یکتای فضای کاری (مثلاً client_rahimi یا default)
    workspaceToken: string;        // کلید امنیتی یا لایسنس
    customServerUrl: string;       // آدرس سفارشی هاست (اختیاری)
    standaloneOfflineMode: boolean;// حالت کاملاً آفلاین و ایزوله (بدون ارسال داده به سرور)
    appTitle: string;              // عنوان اختصاصی نرم‌افزار (برند اختصاصی)
    companyName: string;           // نام شرکت / مشتری
    licenseKey: string;            // شماره لایسنس یا شناسه فعال‌سازی
    updatedAt: string;             // تاریخ آخرین تغییر
}

const DEFAULT_WORKSPACE_CONFIG: WorkspaceConfig = {
    workspaceId: 'default',
    workspaceToken: '',
    customServerUrl: '',
    standaloneOfflineMode: false,
    appTitle: 'سامانه یکپارچه مالی و انبارداری اشک قلم',
    companyName: 'اشک قلم',
    licenseKey: 'ASHK-STANDARD-FREE',
    updatedAt: new Date().toISOString()
};

const STORAGE_KEY = 'ashk_workspace_config_v1';

class WorkspaceService {
    private config: WorkspaceConfig = DEFAULT_WORKSPACE_CONFIG;
    private initialized = false;

    constructor() {
        this.loadLocalConfig();
        this.initDesktopIntegration();
    }

    private loadLocalConfig(): void {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                const saved = localStorage.getItem(STORAGE_KEY);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    this.config = { ...DEFAULT_WORKSPACE_CONFIG, ...parsed };
                }
            }
        } catch (e) {
            console.warn('Failed to load local workspace config:', e);
        }
    }

    // بررسی و خواندن خودکار پیکربندی از فایل app-config.json در دسکتاپ
    private async initDesktopIntegration(): Promise<void> {
        if (typeof window === 'undefined') return;

        const desktopApi = (window as any).electronDesktopAPI;
        if (desktopApi && typeof desktopApi.invoke === 'function') {
            try {
                const desktopConfig = await desktopApi.invoke('get-app-config');
                if (desktopConfig && typeof desktopConfig === 'object') {
                    this.config = {
                        ...this.config,
                        workspaceId: desktopConfig.workspace_id || desktopConfig.workspaceId || this.config.workspaceId,
                        workspaceToken: desktopConfig.workspace_token || desktopConfig.workspaceToken || this.config.workspaceToken,
                        customServerUrl: desktopConfig.api_base_url || desktopConfig.customServerUrl || this.config.customServerUrl,
                        standaloneOfflineMode: Boolean(desktopConfig.standalone_offline_mode ?? desktopConfig.standaloneOfflineMode ?? this.config.standaloneOfflineMode),
                        appTitle: desktopConfig.app_title || desktopConfig.appTitle || this.config.appTitle,
                        companyName: desktopConfig.company_name || desktopConfig.companyName || this.config.companyName,
                        licenseKey: desktopConfig.license_key || desktopConfig.licenseKey || this.config.licenseKey
                    };
                    this.saveLocalConfig();
                }
            } catch (e) {
                console.log('Desktop config check completed without external file');
            }
        }
        this.initialized = true;
    }

    private saveLocalConfig(): void {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
            }
        } catch (e) {
            console.warn('Failed to save local workspace config:', e);
        }
    }

    public getConfig(): WorkspaceConfig {
        return { ...this.config };
    }

    public getWorkspaceId(): string {
        const id = (this.config.workspaceId || '').trim();
        return id || 'default';
    }

    public isStandaloneOffline(): boolean {
        return Boolean(this.config.standaloneOfflineMode);
    }

    public getBaseUrl(): string {
        if (this.config.customServerUrl && this.config.customServerUrl.trim()) {
            return this.config.customServerUrl.trim().replace(/\/+$/, '');
        }
        return HOST_BASE_URL;
    }

    public getHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'X-Workspace-ID': this.getWorkspaceId()
        };
        if (this.config.workspaceToken) {
            headers['X-Workspace-Token'] = this.config.workspaceToken;
        }
        return headers;
    }

    public async updateConfig(partial: Partial<WorkspaceConfig>): Promise<void> {
        this.config = {
            ...this.config,
            ...partial,
            updatedAt: new Date().toISOString()
        };
        this.saveLocalConfig();

        // اگر در محیط دسکتاپ هستیم، فایل app-config.json کنار نرم‌افزار را هم به‌روز کنیم
        const desktopApi = (typeof window !== 'undefined') ? (window as any).electronDesktopAPI : null;
        if (desktopApi && typeof desktopApi.invoke === 'function') {
            try {
                await desktopApi.invoke('save-app-config', {
                    workspace_id: this.config.workspaceId,
                    workspace_token: this.config.workspaceToken,
                    api_base_url: this.config.customServerUrl,
                    standalone_offline_mode: this.config.standaloneOfflineMode,
                    app_title: this.config.appTitle,
                    company_name: this.config.companyName,
                    license_key: this.config.licenseKey
                });
            } catch (err) {
                console.warn('Failed to save desktop app-config.json:', err);
            }
        }
    }

    // تست اتصال به فضای کاری هاست
    public async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
        if (this.isStandaloneOffline()) {
            return {
                success: true,
                message: 'حالت آفلاین مستقل (Standalone Offline) فعال است. کلیه داده‌ها منحصراً روی سیستم محلی پردازش می‌شوند.'
            };
        }

        try {
            const baseUrl = this.getBaseUrl();
            const response = await fetch(`${baseUrl}/storage.php`, {
                method: 'POST',
                cache: 'no-store',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getHeaders()
                },
                body: JSON.stringify({ action: 'checkWorkspace' })
            });

            if (!response.ok) {
                return {
                    success: false,
                    message: `سرور وضعیت ${response.status} را بازگرداند.`
                };
            }

            const data = await response.json();
            if (data && data.success) {
                return {
                    success: true,
                    message: `اتصال به فضای کاری ${data.workspace} در هاست با موفقیت برقرار شد. (${data.record_count} رکورد ثبت شده)`,
                    details: data
                };
            }

            return {
                success: false,
                message: data.message || 'خطا در احراز هویت فضای کاری'
            };
        } catch (e) {
            return {
                success: false,
                message: `عدم دسترسی به هاست: ${e instanceof Error ? e.message : 'خطای شبکه'}`
            };
        }
    }

    // ایجاد متن فایل کانفیگ پرتابل app-config.json
    public generateConfigFileString(): string {
        const json = {
            workspace_id: this.config.workspaceId || 'client_standalone_1403',
            workspace_token: this.config.workspaceToken || '',
            api_base_url: this.config.customServerUrl || HOST_BASE_URL,
            standalone_offline_mode: this.config.standaloneOfflineMode || false,
            app_title: this.config.appTitle || 'سامانه مالی و انبارداری اختصاصی',
            company_name: this.config.companyName || '',
            license_key: this.config.licenseKey || 'ASHK-PORTABLE-1403'
        };
        return JSON.stringify(json, null, 2);
    }

    // ریست به حالت استاندارد
    public async resetToDefault(): Promise<void> {
        this.config = { ...DEFAULT_WORKSPACE_CONFIG, updatedAt: new Date().toISOString() };
        this.saveLocalConfig();
    }
}

export const workspaceService = new WorkspaceService();
