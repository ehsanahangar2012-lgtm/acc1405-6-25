// سرویس ذخیره snapshot محلی JSON در ویندوز و تولید خروجی انتقال SQL
// فایل محلی منبع داده JSON است؛ فایل SQL تنها خروجی انتقال به MariaDB/MySQL است.
import { isDesktopApp } from '../utils';

export interface DatabaseStatusInfo {
    isAvailable: boolean;
    isDesktop: boolean;
    engineType: 'JSON_STATE_FILE' | 'INDEXED_DB_LOCAL' | 'HOST_MYSQL';
    dbPath?: string;
    sqlPath?: string;
    directory?: string;
    sizeBytes?: number;
    sizeFormatted?: string;
    lastModified?: string | null;
}

class DesktopDatabaseService {
    private saveDebounceTimer: any = null;
    private readonly DEBOUNCE_MS = 400; // تاخیر بهینه جهت پیشگیری کامل از لگ و کندی در تایپ و محاسبات

    /**
     * بررسی دسترسی به ذخیره‌ساز فایل snapshot محلی دسکتاپ
     */
    isDesktopDatabaseAvailable(): boolean {
        if (typeof window === 'undefined') return false;
        const api = (window as any).electronDesktopAPI;
        return Boolean(api && typeof api.saveSqlDatabase === 'function');
    }

    /**
     * بارگذاری داده‌ها از فایل JSON محلی دسکتاپ
     */
    async loadFromDatabase(): Promise<string | null> {
        if (this.isDesktopDatabaseAvailable()) {
            try {
                const api = (window as any).electronDesktopAPI;
                const res = await api.loadSqlDatabase();
                if (res && res.success && res.data) {
                    console.log('[DesktopDB] داده‌ها با موفقیت از پایگاه داده ویندوز لود شد.');
                    return res.data;
                }
            } catch (err) {
                console.warn('[DesktopDB] خطا در خواندن از دیتابیس ویندوز:', err);
            }
        }
        return null;
    }

    /**
     * ذخیره snapshot JSON در دیسک با Debounce جهت کاهش کار ذخیره‌سازی
     */
    async saveToDatabase(stateData: any, immediate = false): Promise<boolean> {
        if (!this.isDesktopDatabaseAvailable()) return false;

        if (this.saveDebounceTimer) {
            clearTimeout(this.saveDebounceTimer);
            this.saveDebounceTimer = null;
        }

        const executeSave = async () => {
            try {
                const api = (window as any).electronDesktopAPI;
                const res = await api.saveSqlDatabase(stateData);
                return Boolean(res && res.success);
            } catch (e) {
                console.error('[DesktopDB] خطا در ذخیره روی دیتابیس هارد دیسک:', e);
                return false;
            }
        };

        if (immediate) {
            return executeSave();
        }

        return new Promise((resolve) => {
            this.saveDebounceTimer = setTimeout(async () => {
                const ok = await executeSave();
                resolve(ok);
            }, this.DEBOUNCE_MS);
        });
    }

    /**
     * دریافت جزئیات فایل snapshot JSON دسکتاپ
     */
    async getDatabaseInfo(): Promise<DatabaseStatusInfo> {
        if (this.isDesktopDatabaseAvailable()) {
            try {
                const api = (window as any).electronDesktopAPI;
                const info = await api.getSqlDatabaseInfo();
                return {
                    isAvailable: true,
                    isDesktop: true,
                    engineType: 'JSON_STATE_FILE',
                    ...info
                };
            } catch {}
        }

        return {
            isAvailable: true,
            isDesktop: isDesktopApp(),
            engineType: 'INDEXED_DB_LOCAL',
            sizeFormatted: 'مخزن داده محلی در IndexedDB'
        };
    }

    /**
     * باز کردن پوشه دیتابیس در فایل منیجر سیستم عامل
     */
    async openDatabaseFolder(): Promise<boolean> {
        if (this.isDesktopDatabaseAvailable()) {
            try {
                const api = (window as any).electronDesktopAPI;
                const res = await api.openDatabaseFolder();
                return Boolean(res && res.success);
            } catch {}
        }
        return false;
    }

    /**
     * برون‌بری فایل SQL جهت باز کردن در نرم‌افزارهای دیتابیس یا هاست سی‌پنل (phpMyAdmin)
     */
    async exportSqlDump(defaultName = 'ashke_ghalam_dump.sql'): Promise<boolean> {
        if (this.isDesktopDatabaseAvailable()) {
            try {
                const api = (window as any).electronDesktopAPI;
                const res = await api.exportSqlFile(defaultName);
                return Boolean(res && res.success && !res.canceled);
            } catch {}
        }
        return false;
    }

    /**
     * تولید اسکریپت SQL برای انتقال داده به MariaDB/MySQL در cPanel
     */
    generateSqlScript(state: any): string {
        try {
            const parsed = typeof state === 'string' ? JSON.parse(state) : state;
            const s = parsed.state || parsed;

            const lines: string[] = [
                '-- ====================================================================',
                '-- اسکریپت پایگاه داده رابطه‌ای نرم‌افزار حسابداری اشک قلم',
                '-- سازگار با cPanel MariaDB / MySQL',
                `-- تاریخ استخراج: ${new Date().toLocaleDateString('fa-IR')} ${new Date().toLocaleTimeString('fa-IR')}`,
                '-- ====================================================================',
                '',
                'SET NAMES utf8mb4;',
                'SET FOREIGN_KEY_CHECKS = 0;',
                '',
                'CREATE TABLE IF NOT EXISTS `people` (',
                '  `id` VARCHAR(64) NOT NULL PRIMARY KEY,',
                '  `code` VARCHAR(32),',
                '  `name` VARCHAR(255) NOT NULL,',
                '  `phone` VARCHAR(64),',
                '  `category` VARCHAR(64),',
                '  `balance` BIGINT DEFAULT 0,',
                '  `address` TEXT',
                ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;',
                '',
                'CREATE TABLE IF NOT EXISTS `products` (',
                '  `id` VARCHAR(64) NOT NULL PRIMARY KEY,',
                '  `code` VARCHAR(32),',
                '  `name` VARCHAR(255) NOT NULL,',
                '  `stock` INT DEFAULT 0,',
                '  `buy_price` BIGINT DEFAULT 0,',
                '  `sell_price` BIGINT DEFAULT 0,',
                '  `unit` VARCHAR(32) DEFAULT \'عدد\',',
                '  `category` VARCHAR(64)',
                ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;',
                '',
                'CREATE TABLE IF NOT EXISTS `invoices` (',
                '  `id` VARCHAR(64) NOT NULL PRIMARY KEY,',
                '  `number` VARCHAR(64) NOT NULL,',
                '  `type` VARCHAR(32) NOT NULL,',
                '  `date` VARCHAR(32) NOT NULL,',
                '  `person_id` VARCHAR(64),',
                '  `total` BIGINT DEFAULT 0,',
                '  `tax` BIGINT DEFAULT 0,',
                '  `discount` BIGINT DEFAULT 0,',
                '  `items_json` LONGTEXT',
                ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;',
                '',
                'CREATE TABLE IF NOT EXISTS `checks` (',
                '  `id` VARCHAR(64) NOT NULL PRIMARY KEY,',
                '  `bank_name` VARCHAR(128),',
                '  `amount` BIGINT DEFAULT 0,',
                '  `due_date` VARCHAR(32),',
                '  `status` VARCHAR(32),',
                '  `sayad_id` VARCHAR(64),',
                '  `person_id` VARCHAR(64)',
                ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;',
                ''
            ];

            if (Array.isArray(s.people)) {
                s.people.forEach((p: any) => {
                    if (!p || !p.id) return;
                    const safeName = (p.name || '').replace(/'/g, "''");
                    const safePhone = (p.phone || '').replace(/'/g, "''");
                    const safeCat = (p.category || '').replace(/'/g, "''");
                    const safeAddr = (p.address || '').replace(/'/g, "''");
                    const safeCode = (p.code || '').replace(/'/g, "''");
                    lines.push(`REPLACE INTO \`people\` (\`id\`, \`code\`, \`name\`, \`phone\`, \`category\`, \`balance\`, \`address\`) VALUES ('${p.id}', '${safeCode}', '${safeName}', '${safePhone}', '${safeCat}', ${Number(p.balance) || 0}, '${safeAddr}');`);
                });
            }

            if (Array.isArray(s.products)) {
                s.products.forEach((p: any) => {
                    if (!p || !p.id) return;
                    const safeName = (p.name || '').replace(/'/g, "''");
                    const safeCode = (p.code || '').replace(/'/g, "''");
                    const safeUnit = (p.unit || 'عدد').replace(/'/g, "''");
                    const safeCat = (p.category || '').replace(/'/g, "''");
                    lines.push(`REPLACE INTO \`products\` (\`id\`, \`code\`, \`name\`, \`stock\`, \`buy_price\`, \`sell_price\`, \`unit\`, \`category\`) VALUES ('${p.id}', '${safeCode}', '${safeName}', ${Number(p.stock) || 0}, ${Number(p.buyPrice) || 0}, ${Number(p.sellPrice) || 0}, '${safeUnit}', '${safeCat}');`);
                });
            }

            if (Array.isArray(s.invoices)) {
                s.invoices.forEach((inv: any) => {
                    if (!inv || !inv.id) return;
                    const safeNum = (inv.number || '').replace(/'/g, "''");
                    const safeType = (inv.type || '').replace(/'/g, "''");
                    const safeDate = (inv.date || '').replace(/'/g, "''");
                    const safePid = (inv.personId || '').replace(/'/g, "''");
                    const safeItems = JSON.stringify(inv.items || []).replace(/'/g, "''");
                    lines.push(`REPLACE INTO \`invoices\` (\`id\`, \`number\`, \`type\`, \`date\`, \`person_id\`, \`total\`, \`tax\`, \`discount\`, \`items_json\`) VALUES ('${inv.id}', '${safeNum}', '${safeType}', '${safeDate}', '${safePid}', ${Number(inv.total) || 0}, ${Number(inv.tax) || 0}, ${Number(inv.discount) || 0}, '${safeItems}');`);
                });
            }

            lines.push('SET FOREIGN_KEY_CHECKS = 1;');
            return lines.join('\n');
        } catch (e: any) {
            return `-- خطا در ایجاد اسکریپت SQL: ${e.message}`;
        }
    }

    /**
     * دانلود مستقیم فایل SQL در مرورگر برای کاربران نسخه وب و سی‌پنل
     */
    downloadWebSqlFile(state: any, filename = 'ashke_ghalam_cpanel.sql') {
        const sql = this.generateSqlScript(state);
        const blob = new Blob([sql], { type: 'text/sql;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

export const desktopDatabaseService = new DesktopDatabaseService();
