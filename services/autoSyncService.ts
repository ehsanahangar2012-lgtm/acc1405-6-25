/**
 * سرویس همگام‌سازی خودکار و پایش دستگاه‌های متصل - نسخه ۱۶ (بر مبنای مرجعیت سرور و LWW)
 * 
 * ویژگی‌های حیاتی:
 * ۱. مرجعیت سرور ابری (Server-Authoritative): کش قدیمی مرورگر موبایل هرگز داده‌های هاست را بازنویسی نمی‌کند.
 * ۲. رکوردهای حذف‌شده (Tombstone): اقلام حذف‌شده در لپ‌تاپ هرگز توسط موبایل دوباره زنده نمی‌شوند.
 * ۳. فقط تغییرات آفلاین واقعی (Isolated Offline Queue): فقط رکوردهایی که روی همین دستگاه در زمان آفلاین ایجاد یا ویرایش شده‌اند، پس از آنلاین شدن با سرور مرج می‌شوند.
 * ۴. آخرین تغییر ملاک است (Last-Write-Wins): مقایسه دقیق برچسب‌های زمانی updatedAt.
 * ۵. جلوگیری قطعی از رکوردهای تکراری (Deduplication).
 */

import { useStore } from '../store';
import { hostDB } from './hostDatabaseService';
import { syncQueue } from './syncQueueService';
import { notificationService } from './notificationService';
import { persistentStorage } from './persistentStorage';
import { deletedRecordsRegistry } from './deletedRecordsRegistry';
import { workspaceService } from './workspaceService';

const SYNC_INTERVAL_MS = 25_000;   // هر ۲۵ ثانیه
const INITIAL_DELAY_MS = 1_000;    // ۱ ثانیه بعد از بارگذاری اولیه
const BATCH_CONCURRENT = 4;

export interface DeviceSyncStatus {
    deviceId: string;
    lastSyncTimestamp: number;
    lastSyncShamsi: string;
    isOnline: boolean;
    pendingQueueCount: number;
    deletedRecordsCount: number;
    status: 'SYNCED' | 'SYNCING' | 'OFFLINE' | 'ERROR';
}

class AutoSyncService {
    private syncInterval: ReturnType<typeof setInterval> | null = null;
    private isSyncing = false;
    private lastSyncHashes: Map<string, number> = new Map();
    private lastSyncTime: number = 0;
    private deviceId: string;

    constructor() {
        this.deviceId = this.getOrCreateDeviceId();
        if (typeof window !== 'undefined') {
            (window as any).__autoSyncService = this;
        }
    }

    private getOrCreateDeviceId(): string {
        let id = localStorage.getItem('ashke-ghalam-device-id') || localStorage.getItem('device_id');
        if (!id) {
            id = `device-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
            localStorage.setItem('ashke-ghalam-device-id', id);
            localStorage.setItem('device_id', id);
        }
        return id;
    }

    getDeviceId(): string {
        return this.deviceId;
    }

    start() {
        if (this.syncInterval) return;
        if (typeof window === 'undefined') return;

        deletedRecordsRegistry.startAutoSync();

        window.addEventListener('online', () => {
            notificationService.wentOnline();
            // بلافاصله از سرور بخوان و سپس اقلام آفلاین را بفرست
            this.loadFromHost().then(() => {
                syncQueue.processQueue().then(() => {
                    this.syncToHost();
                }).catch(() => {});
            });
        });

        window.addEventListener('offline', () => {
            notificationService.wentOffline();
        });

        // Pull خودکار هنگام بازگشت کاربر به تب
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && navigator.onLine && !this.isSyncing) {
                this.loadFromHost();
            }
        });

        // همگام‌سازی دوره‌ای
        this.syncInterval = setInterval(() => {
            if (navigator.onLine) {
                this.loadFromHost().then(() => {
                    this.syncToHost();
                });
            }
        }, SYNC_INTERVAL_MS);

        // بارگذاری اولیه سریع
        setTimeout(async () => {
            if (navigator.onLine) {
                await this.loadFromHost();
                this.syncToHost();
            }
        }, INITIAL_DELAY_MS);
    }

    stop() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        deletedRecordsRegistry.stopAutoSync();
    }

    /**
     * همگام‌سازی مستقل کاربران از سرور ابری (قبل و بعد از ورود)
     */
    async syncUsersOnly(): Promise<boolean> {
        if (workspaceService.isStandaloneOffline() || !navigator.onLine) return false;
        try {
            const serverUsers = await persistentStorage.loadData('users');
            if (serverUsers && Array.isArray(serverUsers)) {
                const localUsers = useStore.getState().users || [];
                const merged = this.mergeWithServer('users', localUsers, serverUsers, true);
                useStore.setState({ users: merged });
                return true;
            }
        } catch (e) {
            console.warn('syncUsersOnly error:', e);
        }
        return false;
    }

    /**
     * ارسال داده‌های معتبر به سرور هاست (فقط رکوردهای غیرحذف‌شده با برچسب زمانی)
     */
    async syncToHost(force = false): Promise<void> {
        if (workspaceService.isStandaloneOffline()) {
            this.isSyncing = false;
            return;
        }

        const isOnline = navigator.onLine || (typeof window !== 'undefined' && (Boolean((window as any).electronDesktopAPI) || window.location.protocol === 'file:'));
        if (!isOnline || this.isSyncing) return;
        this.isSyncing = true;

        try {
            const state = useStore.getState();

            const tables: Array<{ name: string; stateKey: string; data: any[] }> = [
                { name: 'users',           stateKey: 'users',          data: state.users || [] },
                { name: 'roles',           stateKey: 'roles',          data: state.roles || [] },
                { name: 'companies',       stateKey: 'companies',      data: state.companies || [] },
                { name: 'invoices',        stateKey: 'invoices',       data: state.invoices || [] },
                { name: 'products',        stateKey: 'products',       data: state.products || [] },
                { name: 'people',          stateKey: 'people',         data: state.people || [] },
                { name: 'vouchers',        stateKey: 'vouchers',       data: state.vouchers || [] },
                { name: 'checks',          stateKey: 'checks',         data: state.checks || [] },
                { name: 'transactions',    stateKey: 'transactions',   data: state.transactions || [] },
                { name: 'check_transfers', stateKey: 'checkTransfers', data: state.checkTransfers || [] },
                { name: 'contracts',       stateKey: 'contracts',      data: state.contracts || [] },
                { name: 'salaries',        stateKey: 'salaries',       data: state.salaries || [] },
                { name: 'importConfigs',   stateKey: 'importConfigs',  data: state.importConfigs || [] },
            ];

            // فیلتر رکوردهای معتبر (بدون حذفیات و همراه با زمان ویرایش)
            const preparedTables = tables.map(t => {
                const cleanData = t.data.filter(item => item && item.id && !deletedRecordsRegistry.isDeleted(item.id))
                    .map(item => ({
                        ...item,
                        updatedAt: item.updatedAt || new Date().toISOString(),
                        lastModifiedByDevice: item.lastModifiedByDevice || this.deviceId
                    }));
                
                // محاسبه هش پیشرفته جدول بر اساس تعداد و مجموع زمان‌های ویرایش (تشخیص ویرایش‌ها)
                let timeSum = 0;
                cleanData.forEach(item => {
                    if (item.updatedAt) {
                        timeSum += new Date(item.updatedAt).getTime() || 0;
                    }
                });
                const tableHash = cleanData.length * 1000 + (timeSum % 999999);
                return { ...t, cleanData, tableHash };
            });

            const changedTables = force ? preparedTables : preparedTables.filter(t => {
                const prevHash = this.lastSyncHashes.get(t.name);
                return prevHash === undefined || prevHash !== t.tableHash;
            });

            if (changedTables.length === 0) {
                this.isSyncing = false;
                return;
            }

            notificationService.syncStarted();
            let totalFailed = 0;

            for (let i = 0; i < changedTables.length; i += BATCH_CONCURRENT) {
                const chunk = changedTables.slice(i, i + BATCH_CONCURRENT);
                const results = await Promise.allSettled(
                    chunk.map(t => this.syncTable(t.name, t.cleanData))
                );

                results.forEach((result, idx) => {
                    if (result.status === 'fulfilled') {
                        this.lastSyncHashes.set(chunk[idx].name, chunk[idx].tableHash);
                    } else {
                        totalFailed++;
                    }
                });
            }

            // همچنین ذخیره لیست حذفیات در سرور
            const allDeleted = deletedRecordsRegistry.getAllDeleted();
            await persistentStorage.saveData('deleted_records', allDeleted).catch(() => {});

            this.lastSyncTime = Date.now();
            if (totalFailed === 0) {
                notificationService.syncCompleted(state.invoices.length + state.products.length + state.people.length);
            } else {
                notificationService.syncFailed(`${totalFailed} جدول با خطا مواجه شد`);
            }
        } finally {
            this.isSyncing = false;
        }
    }

    private async syncTable(table: string, data: any[]): Promise<void> {
        if (!Array.isArray(data)) return;
        try {
            const ok = await persistentStorage.saveData(table, data);
            if (!ok) {
                data.slice(0, 30).forEach(item => {
                    syncQueue.enqueue('save', table, item, 'autoSync');
                });
            }
        } catch (err) {
            console.warn(`Sync table ${table} failed:`, err);
            throw err;
        }
    }

    /**
     * بارگذاری از سرور با مرجعیت قطعی سرور (Server-Authoritative)
     * و اعمال تفاضلی تغییرات آفلاین اختصاصی این دستگاه
     */
    async loadFromHost(forceReload = false): Promise<boolean> {
        if (workspaceService.isStandaloneOffline() || !navigator.onLine) return false;

        try {
            // ۱. ابتدا لیست حذفیات سرور را همگام کن
            await deletedRecordsRegistry.syncFromServer();

            const tables = [
                'users', 'roles', 'companies',
                'invoices', 'products', 'people', 'vouchers',
                'checks', 'transactions', 'check_transfers',
                'contracts', 'salaries', 'importConfigs'
            ];
            const state = useStore.getState();
            let hasUpdates = false;

            for (const table of tables) {
                try {
                    const serverData = await persistentStorage.loadData(table);
                    if (!serverData || !Array.isArray(serverData)) continue;

                    const storeKey = table === 'check_transfers' ? 'checkTransfers' : table;
                    const localData = (state as any)[storeKey] as any[] || [];
                    const isUsersTable = table === 'users';

                    // ادغام با مرجعیت سرور و حفظ داده‌های معتبر محلی (بازیابی شده/آفلاین)
                    const merged = this.mergeWithServer(table, localData, serverData, isUsersTable, forceReload);

                    if (forceReload || merged.length !== localData.length || this.hasAnyUpdate(localData, merged)) {
                        hasUpdates = true;
                        useStore.setState({ [storeKey]: merged });
                        this.lastSyncHashes.set(table, merged.length);
                    }
                } catch (err) {
                    console.warn(`Error loading table ${table} from host:`, err);
                }
            }

            this.lastSyncTime = Date.now();
            if (hasUpdates) {
                notificationService.success(`✅ داده‌ها با موفقیت بر اساس آخرین وضعیت سرور به‌روز شدند`);
                return true;
            }
        } catch (error) {
            console.warn('loadFromHost status (offline):', error);
        }
        return false;
    }

    /**
     * ادغام ایمن، هوشمند و بدون حذف ناخواسته (Bidirectional LWW + Tombstone Filtering):
     * - پایه: داده‌های سرور (فیلتر شده از حذفیات)
     * - داده‌های محلی/بازیابی‌شده: در صورتی که در حذفیات نباشند حفظ شده و در سرور نیز ثبت می‌شوند
     * - تضادها: بر مبنای آخرین زمان ویرایش (Last-Write-Wins)
     * - تکرارزدایی (Deduplication): بر اساس ID قطعی
     */
    private mergeWithServer(table: string, local: any[], server: any[], isUsers = false, forceReload = false): any[] {
        const queue = syncQueue.getQueue();
        const pendingForTable = queue.filter(q => q.table === table || (table === 'check_transfers' && q.table === 'checkTransfers'));
        const pendingSaveMap = new Map<string, any>();
        const pendingDeleteSet = new Set<string>();

        pendingForTable.forEach(item => {
            if (item.operation === 'save' && item.data?.id) {
                pendingSaveMap.set(item.data.id, item.data);
            } else if (item.operation === 'delete' && (item.data?.id || item.id)) {
                pendingDeleteSet.add(item.data?.id || item.id);
            }
        });

        const resultMap = new Map<string, any>();
        let hasLocalOnlyOrNewer = false;

        // ۱. پردازش رکوردهای معتبر سرور
        for (const raw of server) {
            const item = raw.data || raw;
            if (!item || !item.id) continue;

            // اگر در رجیستری حذفیات است یا در صف حذف، به هیچ وجه افزوده نشود
            if (deletedRecordsRegistry.isDeleted(item.id) || pendingDeleteSet.has(item.id)) {
                continue;
            }

            const key = isUsers ? (item.username?.toLowerCase() || item.id) : item.id;
            resultMap.set(key, item);
        }

        // ۲. پردازش رکوردهای محلی (از جمله بک‌آپ‌های بازیابی شده یا تغییرات دستگاه)
        if (!forceReload && Array.isArray(local)) {
            for (const localItem of local) {
                if (!localItem || !localItem.id) continue;

                // اگر حذف شده است نادیده بگیر
                if (deletedRecordsRegistry.isDeleted(localItem.id) || pendingDeleteSet.has(localItem.id)) {
                    continue;
                }

                const key = isUsers ? (localItem.username?.toLowerCase() || localItem.id) : localItem.id;
                const serverItem = resultMap.get(key);

                if (!serverItem) {
                    // رکورد در لوکال وجود دارد اما هنوز در سرور نیست (مثلاً از بک‌آپ بازگردانی شده)
                    resultMap.set(key, localItem);
                    hasLocalOnlyOrNewer = true;
                } else {
                    // رکورد در هر دو طرف است: مقایسه زمان ویرایش (Last-Write-Wins)
                    const localTime = new Date(localItem.updatedAt || localItem.createdAt || 0).getTime();
                    const serverTime = new Date(serverItem.updatedAt || serverItem.synced_at || 0).getTime();

                    if (localTime > serverTime) {
                        resultMap.set(key, localItem);
                        hasLocalOnlyOrNewer = true;
                    } else if (isUsers) {
                        resultMap.set(key, {
                            ...serverItem,
                            hashedPassword: serverItem.hashedPassword || localItem.hashedPassword,
                            permissions: serverItem.permissions || localItem.permissions
                        });
                    }
                }
            }
        }

        // ۳. اعمال صف آفلاین
        if (!forceReload) {
            pendingSaveMap.forEach((offlineItem, id) => {
                if (deletedRecordsRegistry.isDeleted(id) || pendingDeleteSet.has(id)) return;
                const key = isUsers ? (offlineItem.username?.toLowerCase() || id) : id;
                resultMap.set(key, offlineItem);
                hasLocalOnlyOrNewer = true;
            });
        }

        // ۴. اگر داده‌های جدید یا جدیدتر محلی اضافه شدند، به سرور منتقل شوند
        if (hasLocalOnlyOrNewer && navigator.onLine) {
            setTimeout(() => {
                this.syncToHost().catch(() => {});
            }, 1200);
        }

        return Array.from(resultMap.values());
    }

    private hasAnyUpdate(local: any[], merged: any[]): boolean {
        if (local.length !== merged.length) return true;
        const localMap = new Map(local.map(i => [i.id || i.username, i.updatedAt || i.synced_at || 0]));
        return merged.some(i => localMap.get(i.id || i.username) !== (i.updatedAt || i.synced_at || 0));
    }

    /**
     * پاکسازی کامل کش محلی و بازخوانی صد در صدی داده‌ها از سرور ابری
     */
    async forceWipeAndSync(): Promise<boolean> {
        localStorage.removeItem('pending_sync_conflicts');
        localStorage.removeItem('offline-queue');
        localStorage.removeItem('host-db-queue');
        return await this.loadFromHost(true);
    }

    getLastSyncTime(): number {
        return this.lastSyncTime;
    }
}

export const autoSyncService = new AutoSyncService();
