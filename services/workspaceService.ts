// Workspace & Multi-Tenant Management Service
// مدیریت فضاهای کاری مجزا، استقلال نسخه دسکتاپ و پیکربندی بدون تداخل با سایر مشتریان
import { HOST_BASE_URL, IS_BROWSER_PREVIEW } from '../config';
import { isAndroidApp, isDesktopApp } from '../utils';

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
        return IS_BROWSER_PREVIEW || Boolean(this.config.standaloneOfflineMode);
    }

    /**
     * بررسی دسترسی به سرور هاست:
     * در نسخه اندروید و ویندوز در حالت نصب خام، دسترسی به هاست مسدود است و داده‌ها کاملاً محلی و ایزوله هستند.
     * اتصال فقط و فقط در صورتی برقرار می‌شود که:
     * ۱. آدرس سرور مشخص (customServerUrl یا ashk_custom_server_url یا ashk_host_url) وارد شده باشد.
     * ۲. توکن ابری (workspaceToken یا ashk_cloud_token یا ashk_host_sync_token) یا لایسنس فعال سرور وارد شده باشد.
     */
    public isRemoteCloudConfigured(): boolean {
        if (IS_BROWSER_PREVIEW || typeof window === 'undefined') return false;
        if (this.isStandaloneOffline()) return false;

        const customUrl = (
            this.config.customServerUrl || 
            localStorage.getItem('ashk_custom_server_url') || 
            localStorage.getItem('ashk_host_url') || 
            ''
        ).trim();

        const token = (
            this.config.workspaceToken || 
            localStorage.getItem('ashk_cloud_token') || 
            localStorage.getItem('ashk_host_sync_token') || 
            ''
        ).trim();

        const localStatus = localStorage.getItem('ashk_license_status');
        const localKey = (
            localStorage.getItem('ashk_license_key') ||
            localStorage.getItem('ashk_active_license_key') ||
            ''
        ).trim();
        const activationCode = (localStorage.getItem('ashk_activation_code') || '').trim();
        let serverVerified = false;
        try {
            const serverData = JSON.parse(localStorage.getItem('ashk_server_license_data') || 'null');
            serverVerified = Boolean(
                serverData?.serverVerified === true &&
                serverData?.workspaceId &&
                serverData.workspaceId !== 'default' &&
                serverData.workspaceId !== 'main' &&
                serverData?.licenseKey &&
                serverData.licenseKey === localKey
            );
        } catch {}
        const offlineLicenseConfirmed = Boolean(
            localStatus === 'ACTIVATED' &&
            localKey &&
            activationCode &&
            !localKey.startsWith('PWA-HOST-LIC-')
        );
        const licenseConfirmed = Boolean(localStatus === 'ACTIVATED' && (offlineLicenseConfirmed || serverVerified));

        // Native clients never use the shared default tenant. A device must have a valid
        // activation record, its own registered workspace and an explicit server token.
        if (isAndroidApp() || isDesktopApp()) {
            const workspaceId = this.getWorkspaceId();
            return Boolean(
                customUrl &&
                token &&
                licenseConfirmed &&
                workspaceId &&
                workspaceId !== 'default' &&
                workspaceId !== 'main'
            );
        }

        // در وب عادی تنها در صورتی که هاست مشخص و توکن وجود داشته باشد سینک مجاز است
        return Boolean(customUrl && token);
    }

    public getBaseUrl(): string {
        if (IS_BROWSER_PREVIEW) return '';
        const custom = (
            this.config.customServerUrl || 
            (typeof window !== 'undefined' ? localStorage.getItem('ashk_custom_server_url') || localStorage.getItem('ashk_host_url') : '') || 
            ''
        ).trim();

        if (custom) {
            return custom.replace(/\/+$/, '');
        }

        // در اندروید و ویندوز در حالت نصب خام، هیچ ارتباط پیش‌فرضی به سایت اصلی برقرار نمی‌شود
        if (isAndroidApp() || isDesktopApp()) {
            return '';
        }

        return HOST_BASE_URL;
    }

    public getHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'X-Workspace-ID': this.getWorkspaceId()
        };
        const token = this.config.workspaceToken || (typeof window !== 'undefined' ? localStorage.getItem('ashk_cloud_token') || localStorage.getItem('ashk_host_sync_token') : '');
        if (token) {
            headers['X-Workspace-Token'] = token;
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

    // تست اتصال به هاست (فقط بررسی سلامت و پینگ بدون فراخوانی و دریافت داده‌های بیزینس)
    public async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
        if (IS_BROWSER_PREVIEW) {
            return {
                success: true,
                message: 'پیش‌نمایش مرورگری فعال است؛ داده‌ها فقط محلی هستند و اتصال به هاست غیرفعال است.'
            };
        }
        if (this.isStandaloneOffline()) {
            return {
                success: true,
                message: 'حالت آفلاین مستقل (Standalone Offline) فعال است. کلیه داده‌ها منحصراً روی سیستم محلی پردازش می‌شوند.'
            };
        }

        try {
            const baseUrl = this.getBaseUrl();
            // درخواست سبک سلامت سرور (Health Check / Ping) بدون بارگذاری رکوردها
            const healthUrl = `${baseUrl.replace(/\/$/, '')}/api.php?action=health`;
            const response = await fetch(healthUrl, {
                method: 'GET',
                cache: 'no-store'
            }).catch(() => null);

            if (response && response.ok) {
                const data = await response.json().catch(() => null);
                return {
                    success: true,
                    message: `اتصال به هاست با موفقیت برقرار شد. (${data?.company_name || 'سرور مرکزی'})`,
                    details: data
                };
            }

            // تلاش جایگزین سبک با storage.php و اکشن ping
            const responsePing = await fetch(`${baseUrl}/storage.php`, {
                method: 'POST',
                cache: 'no-store',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getHeaders()
                },
                body: JSON.stringify({ action: 'ping' })
            }).catch(() => null);

            if (responsePing && responsePing.ok) {
                const pingData = await responsePing.json().catch(() => null);
                return {
                    success: true,
                    message: `ارتباط با هاست برقرار شد. (وضعیت سرور فعال است)`,
                    details: pingData
                };
            }

            return {
                success: false,
                message: 'هاست پاسخگو نیست یا مسیر ارتباطی برقرار نشد.'
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
