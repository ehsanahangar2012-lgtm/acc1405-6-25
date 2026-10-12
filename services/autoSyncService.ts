/**
 * Master Sync Coordinator (موتور هماهنگ‌ساز مرکزی و بهینه‌سازی شده)
 * 
 * ویژگی‌های برجسته برای سرعت فوق‌العاده در ویندوز و موبایل:
 * ۱. پردازش ناهمگام در زمان بیکاری (Idle Execution) بدون کوچک‌ترین افت فریم یا لگ در ویندوز
 * ۲. اعمال یکپارچه تغییرات (Atomic Batched State Update) با ۱ بار رندر به جای ۱۳ بار رندر پی‌درپی
 * ۳. دی‌بانس هوشمند و توقف در هنگام تایپ یا کاربری فعال
 * ۴. تفکیک دقیق داده‌های سرور و لوکال با Tombstone (رجیستری اقلام حذف شده) و LWW
 */

import { useStore } from '../store';
import { syncQueue } from './syncQueueService';
import { notificationService } from './notificationService';
import { persistentStorage } from './persistentStorage';
import { deletedRecordsRegistry } from './deletedRecordsRegistry';
import { workspaceService } from './workspaceService';

const SYNC_INTERVAL_MS = 60_000;   // هر ۶۰ ثانیه برای جلوگیری از بار پردازشی بیهوده
const INITIAL_DELAY_MS = 2_000;    // ۲ ثانیه پس از اجرای اولیه
const BATCH_CONCURRENT = 3;

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
    private lastUserInteraction: number = 0;

    constructor() {
        this.deviceId = this.getOrCreateDeviceId();
        if (typeof window !== 'undefined') {
            (window as any).__autoSyncService = this;
            
            // ثبت تعاملات کاربر برای جلوگیری از سینک همزمان با تایپ
            const markInteraction = () => { this.lastUserInteraction = Date.now(); };
            window.addEventListener('keydown', markInteraction, { passive: true });
            window.addEventListener('mousedown', markInteraction, { passive: true });
            window.addEventListener('touchstart', markInteraction, { passive: true });
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

    /**
     * آیا برقراری ارتباط و همگام‌سازی با سرور مجاز است؟
     */
    public canSyncWithServer(): boolean {
        if (typeof window === 'undefined') return false;
        if (!navigator.onLine) return false;
        if (workspaceService.isStandaloneOffline()) return false;
        return workspaceService.isRemoteCloudConfigured();
    }

    start() {
        if (this.syncInterval) return;
        if (typeof window === 'undefined') return;

        // اگر سیستم در حالت محلی مستقل و خام است، هیچ سینکی با سرور شروع نمی‌شود
        if (!this.canSyncWithServer()) {
            return;
        }

        deletedRecordsRegistry.startAutoSync();

        window.addEventListener('online', () => {
            if (this.canSyncWithServer()) {
                notificationService.wentOnline();
                this.scheduleIdleSync();
            }
        });

        window.addEventListener('offline', () => {
            notificationService.wentOffline();
        });

        // Pull خودکار هنگام بازگشت کاربر به تب
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.canSyncWithServer() && !this.isSyncing) {
                this.scheduleIdleSync(500);
            }
        });

        // همگام‌سازی دوره‌ای سبک
        this.syncInterval = setInterval(() => {
            if (this.canSyncWithServer() && !this.isSyncing) {
                // اگر کاربر کمتر از ۳ ثانیه پیش کلیک یا تایپ کرده، سینک را به تاخیر بینداز
                if (Date.now() - this.lastUserInteraction < 3000) {
                    return;
                }
                this.scheduleIdleSync();
            }
        }, SYNC_INTERVAL_MS);

        // بارگذاری اولیه با تاخیر امن
        setTimeout(() => {
            if (this.canSyncWithServer()) {
                this.scheduleIdleSync(0);
            }
        }, INITIAL_DELAY_MS);
    }

    private scheduleIdleSync(delay = 200) {
        if (!this.canSyncWithServer()) return;
        setTimeout(() => {
            if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
                (window as any).requestIdleCallback(() => {
                    this.executeFullSyncCycle();
                }, { timeout: 4000 });
            } else {
                this.executeFullSyncCycle();
            }
        }, delay);
    }

    private async executeFullSyncCycle() {
        if (!this.canSyncWithServer() || this.isSyncing) return;
        try {
            await this.loadFromHost();
            await syncQueue.processQueue();
            await this.syncToHost();
        } catch (e) {
            console.warn('Sync cycle completed with notice:', e);
        }
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
        if (!this.canSyncWithServer()) return false;
        try {
            const serverUsers = await persistentStorage.loadData('users');
            if (serverUsers && Array.isArray(serverUsers)) {
                const localUsers = useStore.getState().users || [];
                const merged = this.mergeWithServer('users', localUsers, serverUsers, true);
                if (this.hasAnyUpdate(localUsers, merged)) {
                    useStore.setState({ users: merged });
                }
                return true;
            }
        } catch (e) {
            console.warn('syncUsersOnly error:', e);
        }
        return false;
    }

    /**
     * ارسال داده‌های تغییریافته به سرور هاست
     */
    async syncToHost(force = false): Promise<void> {
        if (!this.canSyncWithServer()) {
            this.isSyncing = false;
            return;
        }

        const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
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

            const preparedTables = tables.map(t => {
                const cleanData = (t.data || []).filter(item => item && item.id && !deletedRecordsRegistry.isDeleted(item.id))
                    .map(item => ({
                        ...item,
                        updatedAt: item.updatedAt || new Date().toISOString(),
                        lastModifiedByDevice: item.lastModifiedByDevice || this.deviceId
                    }));
                
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

            for (let i = 0; i < changedTables.length; i += BATCH_CONCURRENT) {
                const chunk = changedTables.slice(i, i + BATCH_CONCURRENT);
                await Promise.allSettled(
                    chunk.map(async t => {
                        const ok = await persistentStorage.saveData(t.name, t.cleanData);
                        if (ok) {
                            this.lastSyncHashes.set(t.name, t.tableHash);
                        }
                    })
                );
            }

            // ذخیره لیست حذفیات در سرور
            const allDeleted = deletedRecordsRegistry.getAllDeleted();
            if (allDeleted && allDeleted.length > 0) {
                await persistentStorage.saveData('deleted_records', allDeleted).catch(() => {});
            }

            this.lastSyncTime = Date.now();
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * بارگذاری تغییرات از سرور به صورت تجمیعی (Single-Batch UI State Update)
     */
    async loadFromHost(forceReload = false): Promise<boolean> {
        if (!this.canSyncWithServer()) return false;

        try {
            await deletedRecordsRegistry.syncFromServer();

            const tables = [
                'users', 'roles', 'companies',
                'invoices', 'products', 'people', 'vouchers',
                'checks', 'transactions', 'check_transfers',
                'contracts', 'salaries', 'importConfigs'
            ];
            const state = useStore.getState();
            const updatesToApply: Record<string, any[]> = {};
            let hasAnyRealUpdate = false;

            for (const table of tables) {
                try {
                    const serverData = await persistentStorage.loadData(table);
                    if (!serverData || !Array.isArray(serverData)) continue;

                    const storeKey = table === 'check_transfers' ? 'checkTransfers' : table;
                    const localData = (state as any)[storeKey] as any[] || [];
                    const isUsersTable = table === 'users';

                    const merged = this.mergeWithServer(table, localData, serverData, isUsersTable, forceReload);

                    if (forceReload || merged.length !== localData.length || this.hasAnyUpdate(localData, merged)) {
                        updatesToApply[storeKey] = merged;
                        this.lastSyncHashes.set(table, merged.length);
                        hasAnyRealUpdate = true;
                    }
                } catch (err) {
                    console.warn(`Error loading table ${table}:`, err);
                }
            }

            // اعمال تمامی جداول فقط در ۱ دستور تغییر وضعیت به جای ۱۳ رندر متوالی!
            if (hasAnyRealUpdate && Object.keys(updatesToApply).length > 0) {
                useStore.setState(updatesToApply);
                this.lastSyncTime = Date.now();
                return true;
            }
        } catch (error) {
            console.warn('loadFromHost status (offline):', error);
        }
        return false;
    }

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

        // ۱. رکوردهای معتبر سرور
        for (const raw of server) {
            const item = raw.data || raw;
            if (!item || !item.id) continue;
            if (deletedRecordsRegistry.isDeleted(item.id) || pendingDeleteSet.has(item.id)) {
                continue;
            }
            const key = isUsers ? (item.username?.toLowerCase() || item.id) : item.id;
            resultMap.set(key, item);
        }

        // ۲. رکوردهای محلی
        if (!forceReload && Array.isArray(local)) {
            for (const localItem of local) {
                if (!localItem || !localItem.id) continue;
                if (deletedRecordsRegistry.isDeleted(localItem.id) || pendingDeleteSet.has(localItem.id)) {
                    continue;
                }

                const key = isUsers ? (localItem.username?.toLowerCase() || localItem.id) : localItem.id;
                const serverItem = resultMap.get(key);

                if (!serverItem) {
                    resultMap.set(key, localItem);
                    hasLocalOnlyOrNewer = true;
                } else {
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

        // ۳. صف آفلاین
        if (!forceReload) {
            pendingSaveMap.forEach((offlineItem, id) => {
                if (deletedRecordsRegistry.isDeleted(id) || pendingDeleteSet.has(id)) return;
                const key = isUsers ? (offlineItem.username?.toLowerCase() || id) : id;
                resultMap.set(key, offlineItem);
                hasLocalOnlyOrNewer = true;
            });
        }

        if (hasLocalOnlyOrNewer && navigator.onLine) {
            setTimeout(() => {
                this.syncToHost().catch(() => {});
            }, 2500);
        }

        return Array.from(resultMap.values());
    }

    private hasAnyUpdate(local: any[], merged: any[]): boolean {
        if (local.length !== merged.length) return true;
        const localMap = new Map(local.map(i => [i.id || i.username, i.updatedAt || i.synced_at || 0]));
        return merged.some(i => localMap.get(i.id || i.username) !== (i.updatedAt || i.synced_at || 0));
    }

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
