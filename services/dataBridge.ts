import { hostDB } from './hostDatabaseService';
import { syncQueue } from './syncQueueService';
import { smartStorage } from './smartStorageService';
import { unifiedStorage } from './unifiedStorageService';
import { securityService } from './securityService';
import { API_CONFIG, HOST_BASE_URL } from '../config';
import { getPersianDate, toPersianDigits, generateUUID } from '../utils';

export interface DataResponse<T> {
    success: boolean;
    data?: T;
    source?: 'HOST' | 'LOCAL' | 'MOBILE_BRIDGE';
    error?: string;
    timestamp?: string;
}

export interface MobileBridgePacket {
    type: 'SYNC_REQUEST' | 'SYNC_RESPONSE' | 'BARCODE_SCANNED' | 'SIGNATURE_CAPTURED' | 'RECEIPT_PRINT' | 'HEARTBEAT';
    payload: any;
    deviceId?: string;
    token?: string;
    timestamp: number;
    shamsiDate: string;
}

export class DataBridge {
    private broadcastChannel: BroadcastChannel | null = null;
    private listeners: Map<string, Set<(data: any) => void>> = new Map();
    private deviceId: string;

    constructor() {
        this.deviceId = this.getOrCreateDeviceId();
        this.initCrossTabChannel();
        this.initMobileBridgeListeners();
    }

    private getOrCreateDeviceId(): string {
        let id = localStorage.getItem('ashke-ghalam-device-id');
        if (!id) {
            id = `device_${generateUUID().substring(0, 8)}`;
            localStorage.setItem('ashke-ghalam-device-id', id);
        }
        return id;
    }

    private initCrossTabChannel() {
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
            try {
                this.broadcastChannel = new BroadcastChannel('ashke-ghalam-mobile-bridge');
                this.broadcastChannel.onmessage = (event) => {
                    this.handleIncomingPacket(event.data);
                };
            } catch (e) {
                console.warn('[DataBridge] BroadcastChannel not supported in current environment', e);
            }
        }
    }

    private initMobileBridgeListeners() {
        if (typeof window === 'undefined') return;

        // Listen for standard window message (WebView, Capacitor, React Native, Android WebView interface)
        window.addEventListener('message', (event) => {
            if (event.data && event.data.source === 'ASHK_MOBILE_APP') {
                this.handleIncomingPacket(event.data.packet);
            }
        });

        // Register global bridge on window for native android/desktop apps
        (window as any).AshkeGhalamBridge = {
            version: '15.0.0',
            deviceId: this.deviceId,
            syncAll: () => this.syncAllWithHost(),
            exportData: () => this.exportAllData(),
            importData: (jsonStr: string) => this.importExternalData(jsonStr),
            onScanBarcode: (code: string) => this.dispatch('BARCODE_SCANNED', { code }),
            onSignatureCaptured: (sig: string) => this.dispatch('SIGNATURE_CAPTURED', { sig }),
            getLiveStatus: () => this.getBridgeStatus()
        };
    }

    private handleIncomingPacket(packet: MobileBridgePacket) {
        if (!packet || !packet.type) return;
        this.dispatch(packet.type, packet.payload);
    }

    public on(eventType: string, callback: (data: any) => void): () => void {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, new Set());
        }
        this.listeners.get(eventType)!.add(callback);
        return () => {
            this.listeners.get(eventType)?.delete(callback);
        };
    }

    public dispatch(eventType: string, data: any) {
        const callbacks = this.listeners.get(eventType);
        if (callbacks) {
            callbacks.forEach(cb => {
                try {
                    cb(data);
                } catch (err) {
                    console.error(`[DataBridge] Error dispatching event ${eventType}:`, err);
                }
            });
        }
    }

    public sendToMobile(type: MobileBridgePacket['type'], payload: any) {
        const packet: MobileBridgePacket = {
            type,
            payload,
            deviceId: this.deviceId,
            timestamp: Date.now(),
            shamsiDate: getPersianDate()
        };

        // Broadcast to tabs/PWA
        this.broadcastChannel?.postMessage(packet);

        // Send to native mobile wrapper if running in Android WebView or iframe
        if (typeof window !== 'undefined') {
            if ((window as any).AndroidBridge?.postMessage) {
                (window as any).AndroidBridge.postMessage(JSON.stringify(packet));
            }
            if ((window as any).webkit?.messageHandlers?.mobileBridge?.postMessage) {
                (window as any).webkit.messageHandlers.mobileBridge.postMessage(packet);
            }
            window.parent.postMessage({ source: 'ASHK_WEB_CORE', packet }, '*');
        }
    }

    // Generic Fetch with Smart fallback
    async fetch<T>(table: string, id?: string): Promise<DataResponse<T[] | T>> {
        try {
            const data = await smartStorage.get(table, id);
            return { 
                success: true, 
                data, 
                source: smartStorage.getStorageMode(),
                timestamp: getPersianDate() 
            };
        } catch (error) {
            return { success: false, error: String(error), timestamp: getPersianDate() };
        }
    }

    // Generic Save (Atomic & Synced)
    async save<T extends { id: string }>(table: string, data: T): Promise<DataResponse<T>> {
        try {
            const result = await smartStorage.save(table, data);
            this.sendToMobile('SYNC_RESPONSE', { table, action: 'SAVE', id: data.id });
            return { 
                success: true, 
                data, 
                source: result.source,
                timestamp: getPersianDate() 
            };
        } catch (error) {
            return { success: false, error: String(error), timestamp: getPersianDate() };
        }
    }

    // Generic Delete
    async delete(table: string, id: string): Promise<DataResponse<boolean>> {
        try {
            const result = await smartStorage.delete(table, id);
            this.sendToMobile('SYNC_RESPONSE', { table, action: 'DELETE', id });
            return { 
                success: true, 
                data: true, 
                source: result.source,
                timestamp: getPersianDate() 
            };
        } catch (error) {
            return { success: false, error: String(error), timestamp: getPersianDate() };
        }
    }

    // Full Host Synchronizer
    async syncAllWithHost(): Promise<{ success: boolean; syncedTables: string[]; errors: string[] }> {
        const tables = ['products', 'people', 'invoices', 'vouchers', 'checks', 'companies', 'transactions', 'contracts'];
        const syncedTables: string[] = [];
        const errors: string[] = [];

        for (const table of tables) {
            try {
                await unifiedStorage.syncWithDeletionCheck(table);
                syncedTables.push(table);
            } catch (err) {
                errors.push(`${table}: ${String(err)}`);
            }
        }

        // Process offline sync queue
        try {
            await syncQueue.processQueue();
        } catch (qErr) {
            errors.push(`Queue: ${String(qErr)}`);
        }

        return {
            success: errors.length === 0,
            syncedTables,
            errors
        };
    }

    // Mobile Integration / Sync DTO
    async exportAllData(): Promise<string> {
        const tables = ['products', 'people', 'invoices', 'vouchers', 'checks', 'companies', 'transactions', 'salaries', 'contracts'];
        const exportData: Record<string, any> = {
            app: 'ashke-ghalam-cloud',
            version: '15.0.0',
            exportedAt: new Date().toISOString(),
            shamsiDate: getPersianDate(),
            deviceId: this.deviceId,
            data: {}
        };
        
        for (const table of tables) {
            exportData.data[table] = await smartStorage.get(table);
        }
        
        return JSON.stringify(exportData);
    }

    // Import Data from Mobile / External Source
    async importExternalData(jsonStr: string): Promise<{ success: boolean; importedCount: number; error?: string }> {
        try {
            const parsed = JSON.parse(jsonStr);
            const dataToImport = parsed.data || parsed;
            let count = 0;

            for (const [table, items] of Object.entries(dataToImport)) {
                if (Array.isArray(items)) {
                    for (const item of items) {
                        if (item && item.id) {
                            await smartStorage.save(table, item);
                            count++;
                        }
                    }
                }
            }

            return { success: true, importedCount: count };
        } catch (err) {
            return { success: false, importedCount: 0, error: String(err) };
        }
    }

    // Generate Mobile QR Connect Payload
    generateMobileConnectPayload(): string {
        const payload = {
            host: HOST_BASE_URL,
            api: API_CONFIG.BASE_URL,
            version: '15.0.0',
            deviceId: this.deviceId,
            date: getPersianDate(),
            token: securityService.encrypt(JSON.stringify({ deviceId: this.deviceId, timestamp: Date.now() }))
        };
        return JSON.stringify(payload);
    }

    // Diagnostic Status
    getBridgeStatus() {
        return {
            version: '15.0.0',
            deviceId: this.deviceId,
            isOnline: navigator.onLine,
            hostUrl: HOST_BASE_URL,
            storageMode: smartStorage.getStorageMode(),
            queueStats: syncQueue.getStats(),
            shamsiDate: getPersianDate()
        };
    }
}

export const dataBridge = new DataBridge();
