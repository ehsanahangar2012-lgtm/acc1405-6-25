/**
 * Multi-User LAN & Network Synchronization Service
 * مدیریت سیستم‌های متصل به شبکه محلی، نشست‌های همزمان و قفل‌گذاری اسناد
 */

export type LanNodeRole = 'HOST_SERVER' | 'CLIENT_WORKSTATION';

export interface LanWorkstation {
    id: string;
    nodeName: string;
    ipAddress: string;
    port: number;
    username: string;
    role: string;
    status: 'ONLINE' | 'AWAY' | 'OFFLINE';
    lastPing: string;
    currentWorkingDoc?: string; // سندی که هم‌اکنون توسط این کاربر در حال ویرایش است
}

export interface LanNetworkConfig {
    role: LanNodeRole;
    serverHostIp: string;
    serverPort: number;
    nodeAlias: string;
    maxConcurrentSeats: number;
    activeSeatsCount: number;
    autoDiscoverNodes: boolean;
    broadcastPort: number;
}

export interface DocumentLock {
    documentId: string;
    documentType: 'INVOICE' | 'CHECK' | 'VOUCHER' | 'TRANSACTION';
    lockedByUsername: string;
    lockedByNode: string;
    lockedAt: string;
}

const STORAGE_KEY_LAN_CONFIG = 'ashk_lan_network_config';
const STORAGE_KEY_LAN_NODES = 'ashk_lan_workstations';
const STORAGE_KEY_LAN_LOCKS = 'ashk_lan_doc_locks';

export class LanSyncService {
    static getConfig(): LanNetworkConfig {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_LAN_CONFIG);
            if (raw) return JSON.parse(raw);
        } catch (_) {}
        return {
            role: 'HOST_SERVER',
            serverHostIp: '192.168.1.100',
            serverPort: 9090,
            nodeAlias: 'صندوق و سرور مرکزی',
            maxConcurrentSeats: 3, // طبق لایسنس
            activeSeatsCount: 2,
            autoDiscoverNodes: true,
            broadcastPort: 9091
        };
    }

    static saveConfig(config: LanNetworkConfig): void {
        localStorage.setItem(STORAGE_KEY_LAN_CONFIG, JSON.stringify(config));
    }

    static getWorkstations(): LanWorkstation[] {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_LAN_NODES);
            if (raw) return JSON.parse(raw);
        } catch (_) {}
        return [
            {
                id: 'node-host',
                nodeName: 'سیستم مرکزی (سرور)',
                ipAddress: '192.168.1.100',
                port: 9090,
                username: 'admin (مدیر کل)',
                role: 'مدیر مالی',
                status: 'ONLINE',
                lastPing: 'همین الان'
            },
            {
                id: 'node-pos1',
                nodeName: 'ایستگاه کاری صندوق ۱',
                ipAddress: '192.168.1.102',
                port: 9090,
                username: 'reza_cashier',
                role: 'صندوقدار',
                status: 'ONLINE',
                lastPing: '۱ دقیقه قبل',
                currentWorkingDoc: 'فاکتور فروش شماره ۱۰۴۵'
            },
            {
                id: 'node-anbar',
                nodeName: 'سیستم انبارداری و خروج',
                ipAddress: '192.168.1.105',
                port: 9090,
                username: 'hossein_warehouse',
                role: 'انباردار',
                status: 'ONLINE',
                lastPing: '۴ دقیقه قبل'
            }
        ];
    }

    static saveWorkstations(nodes: LanWorkstation[]): void {
        localStorage.setItem(STORAGE_KEY_LAN_NODES, JSON.stringify(nodes));
    }

    static getDocumentLocks(): DocumentLock[] {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_LAN_LOCKS);
            if (raw) return JSON.parse(raw);
        } catch (_) {}
        return [];
    }

    static lockDocument(docId: string, docType: DocumentLock['documentType'], username: string, nodeName: string): boolean {
        const locks = this.getDocumentLocks();
        const existing = locks.find(l => l.documentId === docId);
        if (existing && existing.lockedByUsername !== username) {
            return false; // سند توسط کاربر دیگری قفل است
        }
        if (!existing) {
            locks.push({
                documentId: docId,
                documentType: docType,
                lockedByUsername: username,
                lockedByNode: nodeName,
                lockedAt: new Date().toLocaleTimeString('fa-IR')
            });
            localStorage.setItem(STORAGE_KEY_LAN_LOCKS, JSON.stringify(locks));
        }
        return true;
    }

    static unlockDocument(docId: string): void {
        const locks = this.getDocumentLocks().filter(l => l.documentId !== docId);
        localStorage.setItem(STORAGE_KEY_LAN_LOCKS, JSON.stringify(locks));
    }
}
