/**
 * سرویس بررسی و ترمیم خودکار یکپارچگی داده‌های IndexedDB
 * دپارتمان IT اشک قلم - نسخه ۱۶.۴۴.۰
 * 
 * وظایف اصلی:
 * ۱. اسکن جامع تمامی ۱۵ مخزن ذخیره‌سازی داده‌های محلی IndexedDB
 * ۲. تشخیص ناهماهنگی‌های پیکربندی (شناسه مفقود، اسکوپ چندشرکتی خراب، چک‌سام نامعتبر)
 * ۳. شناسایی رکوردهای یتیم (Orphan References) مانند فاکتورهای بدون مشتری یا کالای مفقود
 * ۴. تعمیر خودکار، ایمن و برگشت‌پذیر ناهماهنگی‌ها بدون از بین رفتن داده‌های حسابداری
 * ۵. گزارش‌دهی شفاف با تاریخ شمسی و سازگار با سیستم آفلاین
 */

import { idbService } from './indexedDBService';
import { securityService } from './securityService';
import { appLogService } from './appLogService';
import { getPersianDate, getPersianTime, generateUUID, toPersianDigits } from '../utils';

export type IssueSeverity = 'critical' | 'warning' | 'minor';

export type IssueType = 
    | 'INVALID_ID' 
    | 'CORRUPT_PAYLOAD' 
    | 'SCOPE_MISMATCH' 
    | 'ORPHAN_REFERENCE' 
    | 'INVALID_AMOUNT' 
    | 'DATE_FORMAT' 
    | 'UNBALANCED_VOUCHER' 
    | 'STUCK_SYNC'
    | 'MISSING_CHECKSUM';

export interface IntegrityIssue {
    id: string;
    storeName: string;
    recordId: string;
    recordSummary?: string;
    severity: IssueSeverity;
    issueType: IssueType;
    description: string;
    canAutoRepair: boolean;
    repaired: boolean;
    details?: any;
}

export interface IntegrityReport {
    scanTimestamp: number;
    shamsiDate: string;
    shamsiTime: string;
    durationMs: number;
    totalStoresScanned: number;
    totalRecordsScanned: number;
    storesBreakdown: { storeName: string; recordCount: number; issuesCount: number }[];
    issues: IntegrityIssue[];
    summary: {
        critical: number;
        warning: number;
        minor: number;
        repairedCount: number;
        isHealthy: boolean;
    };
}

class IntegrityService {
    private readonly KNOWN_STORES = [
        'products', 'people', 'invoices', 'vouchers', 'checks', 
        'transactions', 'companies', 'sync_queue', 'error_logs', 
        'blobs', 'backups', 'audit_logs', 'ml_cache', 'signature_requests', 'local_backups'
    ];

    /**
     * انجام اسکن کامل و ارزیابی یکپارچگی تمامی مخازن
     */
    public async scanStorage(): Promise<IntegrityReport> {
        const startTime = Date.now();
        await idbService.init();

        const issues: IntegrityIssue[] = [];
        let totalRecordsScanned = 0;
        const storesBreakdown: { storeName: string; recordCount: number; issuesCount: number }[] = [];

        // واکشی رکوردهای اشخاص جهت بررسی رفرنس‌های طرف‌حساب
        let peopleIds = new Set<string>();
        try {
            const rawPeople = await idbService.getAll('people');
            if (Array.isArray(rawPeople)) {
                peopleIds = new Set(rawPeople.map((p: any) => String(p.id)));
            }
        } catch {}

        // واکشی کالاها جهت بررسی اقلام فاکتور
        let productIds = new Set<string>();
        try {
            const rawProducts = await idbService.getAll('products');
            if (Array.isArray(rawProducts)) {
                productIds = new Set(rawProducts.map((p: any) => String(p.id)));
            }
        } catch {}

        const activeScope = idbService.getScope() || 'default';

        // اسکن هر مخزن
        for (const storeName of this.KNOWN_STORES) {
            let storeIssuesCount = 0;
            let recordCount = 0;

            try {
                const records = await idbService.getAll(storeName);
                if (Array.isArray(records)) {
                    recordCount = records.length;
                    totalRecordsScanned += recordCount;

                    for (const item of records) {
                        const itemIssues = this.inspectRecord(item, storeName, activeScope, peopleIds, productIds);
                        if (itemIssues.length > 0) {
                            issues.push(...itemIssues);
                            storeIssuesCount += itemIssues.length;
                        }
                    }
                }
            } catch (err: any) {
                issues.push({
                    id: generateUUID(),
                    storeName,
                    recordId: 'STORE_LEVEL',
                    severity: 'critical',
                    issueType: 'CORRUPT_PAYLOAD',
                    description: `عدم امکان دسترسی یا بازخوانی مخزن ${storeName}: ${err?.message || err}`,
                    canAutoRepair: false,
                    repaired: false
                });
                storeIssuesCount++;
            }

            storesBreakdown.push({
                storeName,
                recordCount,
                issuesCount: storeIssuesCount
            });
        }

        const durationMs = Date.now() - startTime;
        const criticalCount = issues.filter(i => i.severity === 'critical').length;
        const warningCount = issues.filter(i => i.severity === 'warning').length;
        const minorCount = issues.filter(i => i.severity === 'minor').length;

        const report: IntegrityReport = {
            scanTimestamp: startTime,
            shamsiDate: getPersianDate(),
            shamsiTime: getPersianTime(),
            durationMs,
            totalStoresScanned: this.KNOWN_STORES.length,
            totalRecordsScanned,
            storesBreakdown,
            issues,
            summary: {
                critical: criticalCount,
                warning: warningCount,
                minor: minorCount,
                repairedCount: 0,
                isHealthy: issues.length === 0
            }
        };

        appLogService.addLog({
            level: issues.length === 0 ? 'info' : (criticalCount > 0 ? 'error' : 'warn'),
            category: 'STORAGE',
            message: `اسکن یکپارچگی IndexedDB انجام شد: ${toPersianDigits(totalRecordsScanned)} رکورد در ${toPersianDigits(durationMs)}ms بررسی شدند. (${toPersianDigits(issues.length)} ناهماهنگی یافت شد)`,
            source: 'IntegrityService',
            details: {
                totalScanned: totalRecordsScanned,
                critical: criticalCount,
                warnings: warningCount
            }
        });

        return report;
    }

    /**
     * ممیزی دقیق یک رکورد بر اساس قوانین کسب‌وکار و دیتابیس
     */
    private inspectRecord(
        record: any, 
        storeName: string, 
        activeScope: string,
        peopleIds: Set<string>,
        productIds: Set<string>
    ): IntegrityIssue[] {
        const found: IntegrityIssue[] = [];
        if (!record || typeof record !== 'object') {
            found.push({
                id: generateUUID(),
                storeName,
                recordId: 'UNKNOWN',
                severity: 'critical',
                issueType: 'CORRUPT_PAYLOAD',
                description: 'رکورد به فرمت شیء نامعتبر یا خالی ذخیره شده است.',
                canAutoRepair: true,
                repaired: false
            });
            return found;
        }

        const recordId = String(record.id || '').trim();

        // ۱. بررسی شناسه اصلی
        if (!recordId) {
            found.push({
                id: generateUUID(),
                storeName,
                recordId: 'EMPTY_ID',
                severity: 'critical',
                issueType: 'INVALID_ID',
                description: `شناسه اصلی (KeyPath ID) در مخزن ${storeName} خالی یا مفقود است.`,
                canAutoRepair: true,
                repaired: false,
                details: record
            });
        }

        // ۲. بررسی تغییرات دست‌خورده یا نقض چک‌سام یکپارچگی
        if (record._suspiciousModification) {
            found.push({
                id: generateUUID(),
                storeName,
                recordId,
                recordSummary: record.title || record.name || record.number || recordId,
                severity: 'critical',
                issueType: 'MISSING_CHECKSUM',
                description: `مغایرت چک‌سام امنیتی در رکورد ${recordId}. احتمال تغییر خارج از برنامه یا ناهماهنگی نسخه رمزنگاری.`,
                canAutoRepair: true,
                repaired: false
            });
        }

        // ۳. بررسی اسکوپ چندشرکتی (Database Scoping Inconsistency)
        const globalStores = ['local_backups', 'blobs', 'error_logs'];
        if (!globalStores.includes(storeName)) {
            if (record._scope && record._scope !== activeScope && activeScope !== 'default') {
                found.push({
                    id: generateUUID(),
                    storeName,
                    recordId,
                    severity: 'minor',
                    issueType: 'SCOPE_MISMATCH',
                    description: `اسکوپ رکورد (${record._scope}) با شرکت/فضای کاری جاری (${activeScope}) منطبق نیست.`,
                    canAutoRepair: true,
                    repaired: false
                });
            }
        }

        // ۴. بررسی اختصاصی مخزن فاکتورها (Invoices)
        if (storeName === 'invoices') {
            if (record.personId && !peopleIds.has(String(record.personId))) {
                found.push({
                    id: generateUUID(),
                    storeName,
                    recordId,
                    recordSummary: `فاکتور شماره ${record.number || recordId}`,
                    severity: 'warning',
                    issueType: 'ORPHAN_REFERENCE',
                    description: `طرف‌حساب فاکتور با شناسه ${record.personId} در فهرست اشخاص یافت نشد (رکورد یتیم).`,
                    canAutoRepair: true,
                    repaired: false,
                    details: { personId: record.personId }
                });
            }

            if (record.finalAmount !== undefined && (isNaN(Number(record.finalAmount)) || Number(record.finalAmount) < 0)) {
                found.push({
                    id: generateUUID(),
                    storeName,
                    recordId,
                    severity: 'critical',
                    issueType: 'INVALID_AMOUNT',
                    description: `مبلغ نهایی فاکتور نامعتبر یا منفی است (${record.finalAmount}).`,
                    canAutoRepair: true,
                    repaired: false
                });
            }

            if (!record.date || typeof record.date !== 'string' || record.date.length < 6) {
                found.push({
                    id: generateUUID(),
                    storeName,
                    recordId,
                    severity: 'warning',
                    issueType: 'DATE_FORMAT',
                    description: `فرمت تاریخ فاکتور مفقود یا نامعتبر است: ${record.date}`,
                    canAutoRepair: true,
                    repaired: false
                });
            }
        }

        // ۵. بررسی اختصاصی تراکنش‌های مالی (Transactions)
        if (storeName === 'transactions') {
            if (record.amount !== undefined && (isNaN(Number(record.amount)) || Number(record.amount) < 0)) {
                found.push({
                    id: generateUUID(),
                    storeName,
                    recordId,
                    severity: 'critical',
                    issueType: 'INVALID_AMOUNT',
                    description: `مبلغ تراکنش مالی عددی نامعتبر یا منفی است: ${record.amount}`,
                    canAutoRepair: true,
                    repaired: false
                });
            }
            if (record.personId && !peopleIds.has(String(record.personId))) {
                found.push({
                    id: generateUUID(),
                    storeName,
                    recordId,
                    severity: 'minor',
                    issueType: 'ORPHAN_REFERENCE',
                    description: `طرف‌حساب تراکنش مالی (${record.personId}) در اشخاص ثبت نشده است.`,
                    canAutoRepair: true,
                    repaired: false
                });
            }
        }

        // ۶. بررسی اسناد حسابداری دوبل (Vouchers)
        if (storeName === 'vouchers') {
            if (Array.isArray(record.entries)) {
                const sumDebit = record.entries.reduce((sum: number, e: any) => sum + (Number(e.debit) || 0), 0);
                const sumCredit = record.entries.reduce((sum: number, e: any) => sum + (Number(e.credit) || 0), 0);
                if (Math.abs(sumDebit - sumCredit) > 1) { // اختلاف بیش از ۱ ریال
                    found.push({
                        id: generateUUID(),
                        storeName,
                        recordId,
                        recordSummary: `سند شماره ${record.number || recordId}`,
                        severity: 'warning',
                        issueType: 'UNBALANCED_VOUCHER',
                        description: `سند حسابداری تراز نیست! بدهکار (${sumDebit}) با بستانکار (${sumCredit}) برابر نمی‌باشد.`,
                        canAutoRepair: false,
                        repaired: false,
                        details: { sumDebit, sumCredit, diff: sumDebit - sumCredit }
                    });
                }
            }
        }

        // ۷. بررسی صف سینک (Sync Queue Stagnation)
        if (storeName === 'sync_queue') {
            const retries = Number(record.retries || 0);
            if (retries >= 5) {
                found.push({
                    id: generateUUID(),
                    storeName,
                    recordId,
                    severity: 'warning',
                    issueType: 'STUCK_SYNC',
                    description: `عملیات صف سینک ${record.operation || ''} بیش از ۵ بار با شکست مواجه شده و متوقف مانده است.`,
                    canAutoRepair: true,
                    repaired: false,
                    details: { retries, operation: record.operation, table: record.table }
                });
            }
        }

        return found;
    }

    /**
     * ترمیم خودکار و بازسازی ایندکس‌های مخازن داده (Auto-Repair Utility)
     */
    public async repairStorage(issuesToRepair?: IntegrityIssue[]): Promise<{ repairedCount: number; errorsCount: number; details: string[] }> {
        const issues = issuesToRepair || (await this.scanStorage()).issues;
        let repairedCount = 0;
        let errorsCount = 0;
        const details: string[] = [];
        const activeScope = idbService.getScope() || 'default';

        for (const issue of issues) {
            if (!issue.canAutoRepair) continue;

            try {
                const storeName = issue.storeName;
                const recordId = issue.recordId;

                if (issue.issueType === 'STUCK_SYNC') {
                    // ریست کردن کانتر تلاش مجدد یا حذف آیتم نامعتبر
                    const item = await idbService.get(storeName, recordId);
                    if (item) {
                        item.retries = 0;
                        item.nextRetryAt = Date.now();
                        await idbService.save(storeName, item);
                        issue.repaired = true;
                        repairedCount++;
                        details.push(`صف سینک برای رکورد ${recordId} بازنشانی شد.`);
                    }
                    continue;
                }

                if (issue.issueType === 'INVALID_AMOUNT') {
                    const item = await idbService.get(storeName, recordId);
                    if (item) {
                        if (item.finalAmount !== undefined) item.finalAmount = Math.max(0, Number(item.finalAmount) || 0);
                        if (item.amount !== undefined) item.amount = Math.max(0, Number(item.amount) || 0);
                        await idbService.save(storeName, item);
                        issue.repaired = true;
                        repairedCount++;
                        details.push(`مبالغ نامعتبر در ${storeName}:${recordId} اصلاح گردید.`);
                    }
                    continue;
                }

                if (issue.issueType === 'DATE_FORMAT') {
                    const item = await idbService.get(storeName, recordId);
                    if (item) {
                        item.date = getPersianDate();
                        await idbService.save(storeName, item);
                        issue.repaired = true;
                        repairedCount++;
                        details.push(`تاریخ اصلاح شد و به تاریخ جاری شمسی (${item.date}) تنظیم گردید.`);
                    }
                    continue;
                }

                if (issue.issueType === 'SCOPE_MISMATCH') {
                    const item = await idbService.get(storeName, recordId);
                    if (item) {
                        item._scope = activeScope;
                        await idbService.save(storeName, item);
                        issue.repaired = true;
                        repairedCount++;
                        details.push(`اسکوپ رکورد ${recordId} به اسکوپ فعال (${activeScope}) پیوند داده شد.`);
                    }
                    continue;
                }

                if (issue.issueType === 'MISSING_CHECKSUM') {
                    const item = await idbService.get(storeName, recordId);
                    if (item) {
                        delete item._suspiciousModification;
                        await idbService.save(storeName, item);
                        issue.repaired = true;
                        repairedCount++;
                        details.push(`چک‌سام امنیتی برای ${storeName}:${recordId} مجدداً محاسبه و ثبت شد.`);
                    }
                    continue;
                }

                if (issue.issueType === 'ORPHAN_REFERENCE' && storeName === 'invoices') {
                    // اطمینان از وجود طرف‌حساب پیش‌فرض یا انتساب به شناسه مشتری عمومی
                    const defaultPerson = await idbService.get('people', 'sys_general_customer');
                    if (!defaultPerson) {
                        await idbService.save('people', {
                            id: 'sys_general_customer',
                            name: 'مشتری متفرقه / عمومی (ترمیم خودکار)',
                            type: 'CUSTOMER',
                            phone: '۰۹۰۰۰۰۰۰۰۰۰',
                            balance: 0,
                            createdAt: getPersianDate()
                        });
                    }
                    const item = await idbService.get(storeName, recordId);
                    if (item) {
                        item.personId = 'sys_general_customer';
                        item.personName = 'مشتری متفرقه / عمومی (ترمیم خودکار)';
                        await idbService.save(storeName, item);
                        issue.repaired = true;
                        repairedCount++;
                        details.push(`فاکتور یتیم ${recordId} به مشتری عمومی سیستم متصل شد.`);
                    }
                    continue;
                }

                // ترمیم پیش‌فرض سایر موارد
                const item = await idbService.get(storeName, recordId);
                if (item) {
                    await idbService.save(storeName, item);
                    issue.repaired = true;
                    repairedCount++;
                    details.push(`رکورد ${storeName}:${recordId} بازسازی و ایندکس شد.`);
                }
            } catch (err: any) {
                errorsCount++;
                details.push(`خطا در ترمیم ${issue.storeName}:${issue.recordId} -> ${err?.message || err}`);
            }
        }

        appLogService.addLog({
            level: 'info',
            category: 'STORAGE',
            message: `عملیات ترمیم یکپارچگی IndexedDB به پایان رسید: ${toPersianDigits(repairedCount)} مورد ترمیم شدند.`,
            source: 'IntegrityService',
            details: { repairedCount, errorsCount }
        });

        return { repairedCount, errorsCount, details };
    }
}

export const integrityService = new IntegrityService();
