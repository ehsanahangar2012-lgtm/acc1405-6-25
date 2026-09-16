// IndexedDB Service with Cryptographic Integrity and Database Scoping Support
// پشتیبانی کامل از Database Scoping جهت تفکیک صددرصدی داده‌های چند شرکت، چند لایسنس و فضاهای کاری
import { securityService } from './securityService';

class IndexedDBService {
    private db: IDBDatabase | null = null;
    private readonly DB_NAME = 'ashke_ghalam_db';
    private readonly DB_VERSION = 6;
    private currentScope = 'default';

    constructor() {
        this.initCurrentScope();
    }

    /**
     * بازیابی اسکوپ ذخیره سازی از مانیفست یا شرکت فعال
     */
    private initCurrentScope() {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                const manifestScope = localStorage.getItem('ashk_active_manifest_scope');
                const activeCompany = localStorage.getItem('ashk_active_company_id');
                if (manifestScope) {
                    this.currentScope = manifestScope;
                } else if (activeCompany) {
                    this.currentScope = `cmp_${activeCompany}`;
                }
            }
        } catch {}
    }

    /**
     * تنظیم اسکوپ داده‌های جاری (بر پایه شناسه شرکت، لایسنس یا فضای کاری)
     */
    public setScope(scopeIdentifier: string | { companyId?: string; workspaceId?: string; licenseKey?: string }): void {
        if (!scopeIdentifier) {
            this.currentScope = 'default';
            return;
        }

        if (typeof scopeIdentifier === 'string') {
            this.currentScope = scopeIdentifier.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'default';
        } else {
            const parts: string[] = [];
            if (scopeIdentifier.companyId) parts.push(`cmp_${scopeIdentifier.companyId}`);
            if (scopeIdentifier.workspaceId && scopeIdentifier.workspaceId !== 'default') parts.push(`ws_${scopeIdentifier.workspaceId}`);
            if (scopeIdentifier.licenseKey) parts.push(`lic_${scopeIdentifier.licenseKey.slice(-6)}`);
            this.currentScope = parts.join('_') || 'default';
        }

        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                localStorage.setItem('ashk_active_manifest_scope', this.currentScope);
            }
        } catch {}
    }

    /**
     * دریافت اسکوپ فعال فعلی
     */
    public getScope(): string {
        return this.currentScope;
    }

    /**
     * تولید کلید پیشونددار اسکوپ
     */
    private getScopedId(storeName: string, id: string): string {
        const globalStores = ['local_backups', 'blobs', 'error_logs'];
        if (globalStores.includes(storeName) || !this.currentScope || this.currentScope === 'default') {
            return id;
        }
        if (id.startsWith(`${this.currentScope}::`)) {
            return id;
        }
        return `${this.currentScope}::${id}`;
    }

    /**
     * استخراج شناسه اصلی بدون پیشوند اسکوپ
     */
    private extractOriginalId(scopedId: string): string {
        if (!scopedId || typeof scopedId !== 'string') return scopedId;
        const separatorIdx = scopedId.indexOf('::');
        if (separatorIdx !== -1) {
            return scopedId.substring(separatorIdx + 2);
        }
        return scopedId;
    }

    private encryptRecord(storeName: string, data: any): any {
        const nonSensitiveStores = ['blobs', 'error_logs', 'ml_cache'];
        if (nonSensitiveStores.includes(storeName) || !data) return data;
        
        const plaintextFields = ['id', 'userId', 'timestamp', 'entity', 'personId', 'date', 'type', 'token', 'status', '_scope', '_originalId'];
        const plainObject: any = {};
        const sensitiveObject: any = {};
        
        Object.keys(data).forEach(key => {
            if (plaintextFields.includes(key)) {
                plainObject[key] = data[key];
            } else {
                sensitiveObject[key] = data[key];
            }
        });
        
        try {
            const checksum = securityService.generateRecordChecksum(data.id || '', sensitiveObject);
            sensitiveObject._integrityChecksum = checksum;
            
            const encryptedPayload = securityService.encrypt(JSON.stringify(sensitiveObject));
            return {
                ...plainObject,
                encryptedPayload
            };
        } catch (err) {
            return data;
        }
    }

    private decryptRecord(storeName: string, data: any): any {
        const nonSensitiveStores = ['blobs', 'error_logs', 'ml_cache'];
        if (nonSensitiveStores.includes(storeName) || !data || !data.encryptedPayload) {
            if (data && data.id && data._originalId) {
                return { ...data, id: data._originalId };
            }
            return data;
        }
        
        try {
            const decryptedStr = securityService.decrypt(data.encryptedPayload);
            const sensitiveObject = JSON.parse(decryptedStr);
            
            if (sensitiveObject._integrityChecksum) {
                const { _integrityChecksum, ...payload } = sensitiveObject;
                const computed = securityService.generateRecordChecksum(data.id || '', payload);
                if (_integrityChecksum !== computed) {
                    console.warn(`[SECURITY WARNING] Record integrity validation failed for ${storeName}:${data.id}. Suspicious out-of-band modification detected!`);
                    data._suspiciousModification = true;
                }
            } else {
                console.warn(`[SECURITY WARNING] Record integrity check missing for ${storeName}:${data.id}.`);
                data._suspiciousModification = true;
            }
            
            const { encryptedPayload, ...plainObject } = data;
            const originalId = data._originalId || this.extractOriginalId(data.id);
            return {
                ...plainObject,
                ...sensitiveObject,
                id: originalId
            };
        } catch (err) {
            return data;
        }
    }

    async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event: any) => {
                const db = event.target.result;
                
                const stores = ['products', 'people', 'invoices', 'vouchers', 'checks', 
                               'transactions', 'companies', 'sync_queue', 'error_logs', 'blobs', 'backups', 'audit_logs', 'ml_cache', 'signature_requests', 'local_backups'];
                
                stores.forEach(store => {
                    if (!db.objectStoreNames.contains(store)) {
                        const objectStore = db.createObjectStore(store, { keyPath: 'id' });
                        
                        // ایجاد ایندکسها برای جستجوی سریعتر
                        if (store === 'audit_logs') {
                            objectStore.createIndex('userId', 'userId', { unique: false });
                            objectStore.createIndex('timestamp', 'timestamp', { unique: false });
                            objectStore.createIndex('entity', 'entity', { unique: false });
                        }
                        if (store === 'transactions') {
                            objectStore.createIndex('personId', 'personId', { unique: false });
                            objectStore.createIndex('date', 'date', { unique: false });
                            objectStore.createIndex('type', 'type', { unique: false });
                        }
                        if (store === 'invoices') {
                            objectStore.createIndex('personId', 'personId', { unique: false });
                            objectStore.createIndex('date', 'date', { unique: false });
                        }
                        if (store === 'signature_requests') {
                            objectStore.createIndex('token', 'token', { unique: true });
                            objectStore.createIndex('status', 'status', { unique: false });
                        }
                    }
                });
            };
        });
    }

    async save(storeName: string, data: any): Promise<void> {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            try {
                if (!this.db!.objectStoreNames.contains(storeName)) {
                    resolve();
                    return;
                }
                const tx = this.db!.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);

                // اعمال Database Scoping
                const rawId = String(data.id || Date.now().toString());
                const scopedId = this.getScopedId(storeName, rawId);

                const scopedData = {
                    ...data,
                    id: scopedId,
                    _originalId: rawId,
                    _scope: this.currentScope
                };

                const encrypted = this.encryptRecord(storeName, scopedData);
                const request = store.put(encrypted);
                
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            } catch (error) {
                resolve();
            }
        });
    }

    async set(key: string, value: any): Promise<void> {
        return this.save('backups', { id: key, data: value, timestamp: Date.now() });
    }

    async remove(key: string): Promise<void> {
        return this.delete('backups', key);
    }

    async get(storeName: string, id?: string): Promise<any> {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            try {
                if (!this.db!.objectStoreNames.contains(storeName)) {
                    resolve(id ? null : []);
                    return;
                }
                const tx = this.db!.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);
                
                if (id) {
                    const scopedId = this.getScopedId(storeName, id);
                    const request = store.get(scopedId);
                    request.onsuccess = () => {
                        if (request.result) {
                            resolve(this.decryptRecord(storeName, request.result));
                        } else {
                            // بازگشت برای شناسه بدون اسکوپ (سازگاری با داده‌های قدیمی)
                            const fallbackRequest = store.get(id);
                            fallbackRequest.onsuccess = () => resolve(fallbackRequest.result ? this.decryptRecord(storeName, fallbackRequest.result) : null);
                            fallbackRequest.onerror = () => resolve(null);
                        }
                    };
                    request.onerror = () => reject(request.error);
                } else {
                    const request = store.getAll();
                    request.onsuccess = () => {
                        const allResults = request.result || [];
                        const globalStores = ['local_backups', 'blobs', 'error_logs'];
                        const isGlobal = globalStores.includes(storeName);

                        const filtered = allResults.filter((r: any) => {
                            if (isGlobal) return true;
                            // اگر رکورد دارای فیلد _scope است، باید با اسکوپ فعلی تطابق داشته باشد
                            if (r._scope) {
                                return r._scope === this.currentScope;
                            }
                            // اگر آی‌دی با پیشوند اسکوپ شروع شده است
                            if (r.id && typeof r.id === 'string' && r.id.includes('::')) {
                                return r.id.startsWith(`${this.currentScope}::`);
                            }
                            // رکوردهای بدون اسکوپ در اسکوپ پیش‌فرض نمایش داده می‌شوند
                            return this.currentScope === 'default';
                        });

                        resolve(filtered.map((r: any) => this.decryptRecord(storeName, r)));
                    };
                    request.onerror = () => reject(request.error);
                }
            } catch (error) {
                resolve(id ? null : []);
            }
        });
    }

    async getAll(storeName: string): Promise<any[]> {
        return this.get(storeName);
    }

    async getByIndex(storeName: string, indexName: string, value: any): Promise<any> {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            try {
                if (!this.db!.objectStoreNames.contains(storeName)) {
                    resolve(null);
                    return;
                }
                const tx = this.db!.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);
                const index = store.index(indexName);
                const request = index.get(value);
                
                request.onsuccess = () => resolve(this.decryptRecord(storeName, request.result));
                request.onerror = () => reject(request.error);
            } catch (error) {
                resolve(null);
            }
        });
    }

    async getAllByIndex(storeName: string, indexName: string, value: any): Promise<any[]> {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            try {
                if (!this.db!.objectStoreNames.contains(storeName)) {
                    resolve([]);
                    return;
                }
                const tx = this.db!.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);
                const index = store.index(indexName);
                const request = index.getAll(value);
                
                request.onsuccess = () => {
                    const results = (request.result || []).filter((r: any) => {
                        if (r._scope) return r._scope === this.currentScope;
                        return true;
                    });
                    resolve(results.map((r: any) => this.decryptRecord(storeName, r)));
                };
                request.onerror = () => reject(request.error);
            } catch (error) {
                resolve([]);
            }
        });
    }

    async delete(storeName: string, id: string): Promise<void> {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            try {
                if (!this.db!.objectStoreNames.contains(storeName)) {
                    resolve();
                    return;
                }
                const tx = this.db!.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                const scopedId = this.getScopedId(storeName, id);
                
                const request = store.delete(scopedId);
                request.onsuccess = () => {
                    // اگر با شناسه ساده هم وجود داشت پاک شود
                    if (scopedId !== id) {
                        try {
                            store.delete(id);
                        } catch {}
                    }
                    resolve();
                };
                request.onerror = () => reject(request.error);
            } catch (error) {
                resolve();
            }
        });
    }

    async saveBlob(path: string, blob: Blob): Promise<void> {
        return this.save('blobs', { id: path, blob, timestamp: Date.now() });
    }

    async getBlob(path: string): Promise<Blob | null> {
        const result = await this.get('blobs', path);
        return result?.blob || null;
    }

    async clear(storeName: string): Promise<void> {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const tx = this.db!.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            
            // اگر اسکوپ پیش‌فرض نیست، فقط داده‌های اسکوپ جاری حذف شود
            if (this.currentScope !== 'default') {
                const req = store.getAll();
                req.onsuccess = () => {
                    const items = req.result || [];
                    items.forEach((item: any) => {
                        if (item._scope === this.currentScope || (item.id && item.id.startsWith(`${this.currentScope}::`))) {
                            store.delete(item.id);
                        }
                    });
                    resolve();
                };
                req.onerror = () => reject(req.error);
            } else {
                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            }
        });
    }
}

export const idbService = new IndexedDBService();
