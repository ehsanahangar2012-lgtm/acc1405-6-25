// Workspace & Multi-Tenant Management Service
// مدیریت فضاهای کاری مجزا، استقلال نسخه دسکتاپ و پیکربندی بدون تداخل با سایر مشتریان
import { HOST_BASE_URL, IS_BROWSER_PREVIEW } from '../config';
import { isAndroidApp, isDesktopApp } from '../utils';
import { hardwareIdService } from './hardwareIdService';
import { hasNativeBackupStorage, getNativeBackupValue, setNativeBackupValue } from './nativeBackupStorage';

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
const NATIVE_WORKSPACE_CONFIG_KEY = 'workspace:config:v1';
const LEGACY_WORKSPACE_TOKEN_KEYS = ['ashk_cloud_token', 'ashk_host_sync_token'];

class WorkspaceService {
    private config: WorkspaceConfig = DEFAULT_WORKSPACE_CONFIG;
    private initialized = false;
    private legacyNativeConfig: Partial<WorkspaceConfig> | null = null;
    private nativeCredentialStorageHealthy = true;
    private nativeConfigLoadedSecurely = false;

    constructor() {
        this.loadLocalConfig();
        void this.initDesktopIntegration();
    }

    private loadLocalConfig(): void {
        try {
            if (typeof window === 'undefined' || !window.localStorage) return;
            const nativeClient = hasNativeBackupStorage();
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) return;

            const parsed = JSON.parse(saved);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
            if (nativeClient) {
                // Preserve legacy credentials only in memory until successfully migrated
                // to OS/Keystore-backed storage. Never continue using plaintext tokens.
                this.legacyNativeConfig = parsed as Partial<WorkspaceConfig>;
                this.config = {
                    ...DEFAULT_WORKSPACE_CONFIG,
                    ...parsed,
                    workspaceToken: '',
                    licenseKey: ''
                };
            } else {
                this.config = { ...DEFAULT_WORKSPACE_CONFIG, ...parsed };
            }
        } catch (e) {
            console.warn('Failed to load local workspace config:', e);
        }
    }

    // بررسی و خواندن خودکار پیکربندی از فایل app-config.json در دسکتاپ
    private async initDesktopIntegration(): Promise<void> {
        if (typeof window === 'undefined') return;
        const nativeClient = hasNativeBackupStorage();
        const desktopApi = (window as any).electronDesktopAPI;
        let externalConfig: any = null;

        if (nativeClient) {
            try {
                const encrypted = await getNativeBackupValue(NATIVE_WORKSPACE_CONFIG_KEY);
                if (encrypted !== null) {
                    const parsed = JSON.parse(encrypted);
                    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                        throw new Error('NATIVE_WORKSPACE_CONFIG_INVALID');
                    }
                    this.config = { ...this.config, ...parsed };
                    this.nativeConfigLoadedSecurely = true;
                }
            } catch (error) {
                // Fail closed: do not re-use credentials from localStorage/app-config
                // when the secure store cannot be read or authenticated.
                this.nativeCredentialStorageHealthy = false;
                this.config = { ...this.config, workspaceToken: '', licenseKey: '' };
                this.initialized = true;
                console.warn('Secure workspace credentials are unavailable; cloud features remain disabled:', error);
                return;
            }
        }

        if (desktopApi && typeof desktopApi.invoke === 'function') {
            try {
                externalConfig = await desktopApi.invoke('get-app-config');
                if (externalConfig && typeof externalConfig === 'object') {
                    const canMigrateExternalCredentials = !nativeClient || !this.nativeConfigLoadedSecurely;
                    this.config = {
                        ...this.config,
                        workspaceId: externalConfig.workspace_id || externalConfig.workspaceId || this.config.workspaceId,
                        workspaceToken: canMigrateExternalCredentials
                            ? (externalConfig.workspace_token || externalConfig.workspaceToken || this.config.workspaceToken)
                            : this.config.workspaceToken,
                        customServerUrl: externalConfig.api_base_url || externalConfig.customServerUrl || this.config.customServerUrl,
                        standaloneOfflineMode: Boolean(externalConfig.standalone_offline_mode ?? externalConfig.standaloneOfflineMode ?? this.config.standaloneOfflineMode),
                        appTitle: externalConfig.app_title || externalConfig.appTitle || this.config.appTitle,
                        companyName: externalConfig.company_name || externalConfig.companyName || this.config.companyName,
                        licenseKey: canMigrateExternalCredentials
                            ? (externalConfig.license_key || externalConfig.licenseKey || this.config.licenseKey)
                            : this.config.licenseKey
                    };
                }
            } catch (e) {
                console.log('Desktop config check completed without external file');
            }
        }

        if (nativeClient) {
            // One-time migration of older plaintext credentials to native encrypted storage.
            // A stored secure config wins over any older app-config/localStorage token.
            if (!this.nativeConfigLoadedSecurely) {
                const legacyToken = this.config.workspaceToken ||
                    this.legacyNativeConfig?.workspaceToken ||
                    localStorage.getItem('ashk_cloud_token') ||
                    localStorage.getItem('ashk_host_sync_token') ||
                    '';
                if (legacyToken) this.config.workspaceToken = String(legacyToken);
                const legacyLicense = this.config.licenseKey ||
                    this.legacyNativeConfig?.licenseKey ||
                    '';
                if (legacyLicense) this.config.licenseKey = String(legacyLicense);
            } else if (!this.config.workspaceToken) {
                // The encrypted workspace object may predate the separate legacy token keys.
                const legacyToken = localStorage.getItem('ashk_cloud_token') ||
                    localStorage.getItem('ashk_host_sync_token') || '';
                if (legacyToken) this.config.workspaceToken = legacyToken;
            }

            try {
                await this.saveLocalConfig();
                this.nativeCredentialStorageHealthy = true;

                // Remove any old plaintext token/license from app-config.json once a
                // secure copy has been committed successfully.
                if (desktopApi && typeof desktopApi.invoke === 'function') {
                    await desktopApi.invoke('save-app-config', {
                        workspace_id: this.config.workspaceId,
                        workspace_token: '',
                        api_base_url: this.config.customServerUrl,
                        standalone_offline_mode: this.config.standaloneOfflineMode,
                        app_title: this.config.appTitle,
                        company_name: this.config.companyName,
                        license_key: ''
                    });
                }
            } catch (error) {
                this.nativeCredentialStorageHealthy = false;
                this.config = { ...this.config, workspaceToken: '', licenseKey: '' };
                console.warn('Secure workspace credentials could not be saved; cloud features remain disabled:', error);
            }
        } else {
            await this.saveLocalConfig();
        }

        this.initialized = true;
    }

    private async saveLocalConfig(): Promise<void> {
        try {
            if (typeof window === 'undefined' || !window.localStorage) return;
            if (hasNativeBackupStorage()) {
                // Save full credential-bearing config only inside encrypted native storage.
                await setNativeBackupValue(NATIVE_WORKSPACE_CONFIG_KEY, JSON.stringify(this.config));

                // Keep non-secret display/configuration fields for synchronous startup only.
                localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    ...this.config,
                    workspaceToken: '',
                    licenseKey: ''
                }));
                for (const key of LEGACY_WORKSPACE_TOKEN_KEYS) localStorage.removeItem(key);
                this.legacyNativeConfig = null;
                this.nativeConfigLoadedSecurely = true;
                return;
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
        } catch (e) {
            console.warn('Failed to save local workspace config securely:', e);
            throw e;
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

        const workspaceId = this.getWorkspaceId();
        let motherSessionToken = '';
        if (workspaceId === 'default' || workspaceId === 'main') {
            try {
                motherSessionToken = typeof window !== 'undefined'
                    ? (window.sessionStorage.getItem('ashk_mother_admin_secret') || '')
                    : '';
            } catch {
                motherSessionToken = '';
            }
        }
        const token = (
            motherSessionToken ||
            this.config.workspaceToken ||
            ((!isAndroidApp() && !isDesktopApp()) ? (localStorage.getItem('ashk_cloud_token') || localStorage.getItem('ashk_host_sync_token') || '') : '') ||
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
        const workspaceId = this.getWorkspaceId();
        const headers: Record<string, string> = {
            'X-Workspace-ID': workspaceId
        };

        // Reserved master workspaces never fall back to the public client token.
        // Their admin credential is kept only for this browser tab/session after server validation.
        let token = '';
        if (workspaceId === 'default' || workspaceId === 'main') {
            try {
                token = typeof window !== 'undefined'
                    ? (window.sessionStorage.getItem('ashk_mother_admin_secret') || '')
                    : '';
            } catch {
                token = '';
            }
        } else {
            token = this.config.workspaceToken || (
                typeof window !== 'undefined' && !isAndroidApp() && !isDesktopApp()
                    ? localStorage.getItem('ashk_cloud_token') || localStorage.getItem('ashk_host_sync_token') || ''
                    : ''
            );
        }

        if (token) {
            headers['X-Workspace-Token'] = token;
        }
        return headers;
    }

    /** Add a device-bound credential to tenant API requests; the central portal uses its session admin secret. */
    public async getSecureHeaders(): Promise<Record<string, string>> {
        const headers = this.getHeaders();
        const workspaceId = this.getWorkspaceId();
        if (workspaceId === 'default' || workspaceId === 'main') return headers;

        const hwid = String(await hardwareIdService.getHardwareId() || '').trim();
        if (!hwid) throw new Error('شناسه دستگاه برای اتصال امن به فضای کاری در دسترس نیست.');
        headers['X-Device-HWID'] = hwid;
        return headers;
    }

    public async updateConfig(partial: Partial<WorkspaceConfig>): Promise<void> {
        this.config = {
            ...this.config,
            ...partial,
            updatedAt: new Date().toISOString()
        };
        await this.saveLocalConfig();

        // در نسخه مستقل، کلیدها در مخزن امن می‌مانند؛ فایل app-config فقط تنظیمات غیرحساس دارد.
        const desktopApi = (typeof window !== 'undefined') ? (window as any).electronDesktopAPI : null;
        if (desktopApi && typeof desktopApi.invoke === 'function') {
            try {
                await desktopApi.invoke('save-app-config', {
                    workspace_id: this.config.workspaceId,
                    workspace_token: '',
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
                    ...await this.getSecureHeaders()
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
            workspace_token: '',
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
        await this.saveLocalConfig();
    }
}

export const workspaceService = new WorkspaceService();
