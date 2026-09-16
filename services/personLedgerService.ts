// سرویس کاردکس اشخاص - بر اساس قوانین حسابداری ایران و استانداردهای سازمان امور مالیاتی
import { useStore } from '../store';
import { InvoiceType } from '../types';
import { toPersianDigits } from '../utils';

export interface LedgerEntry {
    id: string;
    date: string;
    type: 'INVOICE' | 'PAYMENT' | 'CHECK' | 'VOUCHER' | 'TRANSACTION' | 'REVERSAL' | 'VOUCHER_INFO';
    referenceId: string;
    referenceNumber: string;
    description: string;
    debit: number;  // بدهکار - مشتری بدهکار میشود (باید بدهد)
    credit: number; // بستانکار - مشتری بستانکار میشود (باید بگیرد / تسویه)
    balance: number; // مانده: مثبت = بدهکار (طلب ما از مشتری)، منفی = بستانکار (بدهی ما به شخص)، صفر = تسویه
    timestamp: number;
    relatedInvoiceId?: string;
    isParent?: boolean;
    isChild?: boolean;
    imageUrl?: string;
}

class PersonLedgerService {
    /**
     * محاسبه و استخراج کاردکس دقیق شخص از روی فاکتورها، تراکنش‌ها، چک‌ها و حواله‌های انبار
     * مطابق با اصول حسابداری ایران:
     * - فاکتور فروش: بدهکار شخص (+)
     * - فاکتور خرید: بستانکار شخص (-)
     * - دریافت نقدی/چک/حواله از مشتری: بستانکار شخص (-)
     * - پرداخت نقدی/چک/هزینه به طرف‌حساب: بدهکار شخص (+)
     * - حواله انبار: صرفاً جهت اطلاع لجستیکی و رهگیری کالا (بدون تاثیر در ارقام و مانده حساب)
     */
    static getLedger(personId: string, customInvoices?: any[], customTransactions?: any[], customChecks?: any[], customVouchers?: any[]): LedgerEntry[] {
        if (!personId) return [];

        let storeState: any = null;
        try {
            storeState = useStore.getState();
        } catch {
            storeState = null;
        }

        const entries: LedgerEntry[] = [];

        const invoices = customInvoices || storeState?.invoices || [];
        const transactions = customTransactions || storeState?.transactions || [];
        const checks = customChecks || storeState?.checks || [];
        const vouchers = customVouchers || storeState?.vouchers || [];

        // ۱. فاکتورهای مربوط به شخص (به جز پیش‌فاکتورها که سند مالی قطعی نیستند)
        const personInvoices = invoices.filter((inv: any) => inv.personId === personId && inv.type !== InvoiceType.PROFORMA);
        
        personInvoices.forEach((inv: any) => {
            const isSale = inv.type === InvoiceType.SALE;
            const timestamp = inv.createdAt ? new Date(inv.createdAt).getTime() : 1;

            // ثبت سند فاکتور (اصل بدهکاری/بستانکاری کالا)
            entries.push({
                id: `inv-${inv.id}`,
                date: inv.date,
                type: 'INVOICE',
                referenceId: inv.id,
                referenceNumber: String(inv.number || ''),
                description: `فاکتور ${isSale ? 'فروش' : 'خرید'} شماره ${inv.number}${inv.items?.length ? ` (${inv.items.length} قلم کالا)` : ''}`,
                debit: isSale ? (inv.finalTotal || 0) : 0,    // فاکتور فروش = بدهکار
                credit: !isSale ? (inv.finalTotal || 0) : 0, // فاکتور خرید = بستانکار
                balance: 0,
                timestamp: timestamp,
                isParent: true
            });
        });

        // ۲. کلیه تراکنش‌های مالی شخص (دریافت، پرداخت، هزینه، تسویه فاکتور و...)
        // فیلتر کردن ردیف‌های تکراری سند فاکتور (چون فاکتور در مرحله ۱ اضافه شد)
        const personTransactions = transactions.filter((t: any) => {
            if (t.personId !== personId) return false;
            if (t.type === 'INVOICE_SALE' || t.type === 'INVOICE_PURCHASE') return false;
            return true;
        });

        personTransactions.forEach((t: any) => {
            // تعیین بدهکار / بستانکار بر اساس استاندارد حسابداری ایران
            let isDebit = false;
            if (typeof t.isDebit === 'boolean') {
                isDebit = t.isDebit;
            } else if (t.type === 'EXPENSE' || t.type === 'PAYMENT' || t.type === 'SALARY_PAYMENT') {
                isDebit = true; // پرداخت به شخص / هزینه برای شخص = بدهکار شخص
            } else {
                isDebit = false; // دریافت از شخص (درآمد، دریافت نقدی، رسید فاکتور) = بستانکار شخص
            }

            const isChild = !!t.relatedInvoiceId;
            let desc = t.description;
            if (!desc) {
                desc = isDebit ? 'پرداخت به طرف‌حساب' : 'دریافت از مشتری';
            }

            entries.push({
                id: `trans-${t.id}`,
                date: t.date,
                type: 'PAYMENT',
                referenceId: t.id,
                referenceNumber: t.trackingCode || '',
                description: desc,
                debit: isDebit ? (t.amount || 0) : 0,
                credit: !isDebit ? (t.amount || 0) : 0,
                balance: 0,
                timestamp: t.timestamp || 2,
                relatedInvoiceId: t.relatedInvoiceId,
                isChild
            });
        });

        // ۳. بررسی فاکتورهایی که مبلغ نقدی یا چک درون خود فاکتور دارند ولی در آرایه تراکنش‌ها ثبت جداگانه ندارند
        personInvoices.forEach((inv: any) => {
            const isSale = inv.type === InvoiceType.SALE;
            const timestamp = inv.createdAt ? new Date(inv.createdAt).getTime() : 1;

            if (inv.cashAmount && inv.cashAmount > 0) {
                const hasExistingTrans = personTransactions.some((t: any) => 
                    t.relatedInvoiceId === inv.id && (t.type === 'CASH_PAYMENT' || t.type === 'INVOICE_RECEIPT')
                );
                if (!hasExistingTrans) {
                    entries.push({
                        id: `cash-${inv.id}`,
                        date: inv.date,
                        type: 'PAYMENT',
                        referenceId: inv.id,
                        referenceNumber: `CSH-${inv.number}`,
                        description: isSale ? `دریافت نقدی بابت فاکتور فروش ${inv.number}` : `پرداخت نقدی بابت فاکتور خرید ${inv.number}`,
                        debit: !isSale ? inv.cashAmount : 0, // خرید نقدی = بدهکار، فروش نقدی = بستانکار
                        credit: isSale ? inv.cashAmount : 0,
                        balance: 0,
                        timestamp: timestamp + 1,
                        relatedInvoiceId: inv.id,
                        isChild: true
                    });
                }
            }

            if (inv.checkAmount && inv.checkAmount > 0) {
                const hasExistingTrans = personTransactions.some((t: any) => 
                    t.relatedInvoiceId === inv.id && (t.type === 'CHECK_INFO' || t.type === 'CHECK')
                );
                if (!hasExistingTrans) {
                    const checkNos = inv.checks?.map((c: any) => c.checkNumber || c.sayadId || 'چک').join('، ') || 'چک';
                    const firstCheckImg = inv.checks?.find((c: any) => c.imageUrl)?.imageUrl;
                    entries.push({
                        id: `chk-inv-${inv.id}`,
                        date: inv.date,
                        type: 'CHECK',
                        referenceId: inv.id,
                        referenceNumber: `CHK-${inv.number}`,
                        description: isSale ? `چک دریافتی (${checkNos}) بابت فاکتور ${inv.number}` : `چک پرداختی (${checkNos}) بابت فاکتور ${inv.number}`,
                        debit: !isSale ? inv.checkAmount : 0,
                        credit: isSale ? inv.checkAmount : 0,
                        balance: 0,
                        timestamp: timestamp + 2,
                        relatedInvoiceId: inv.id,
                        isChild: true,
                        imageUrl: firstCheckImg
                    });
                }
            }
        });

        // ۴. چک‌های مستقل ثبت‌شده برای شخص (خارج از فاکتورها و تراکنش‌ها)
        const personChecks = checks.filter((c: any) => 
            c.personId === personId && 
            !c.relatedInvoiceId &&
            !personInvoices.some((inv: any) => inv.checks?.some((ic: any) => ic.id === c.id)) &&
            !personTransactions.some((t: any) => t.referenceId === c.id)
        );

        personChecks.forEach((c: any) => {
            const isReceived = c.checkType === 'RECEIVED' || !c.checkType;
            entries.push({
                id: `chk-${c.id}`,
                date: c.dueDate || c.issueDate || getPersianDateFallback(),
                type: 'CHECK',
                referenceId: c.id,
                referenceNumber: c.sayadId || c.checkNumber || '',
                description: `چک ${isReceived ? 'دریافتی' : 'پرداختی'} بانک ${c.bankName || ''} (${c.checkNumber || ''})`,
                debit: !isReceived ? (c.amount || 0) : 0, // چک پرداختی به شخص = بدهکار شخص
                credit: isReceived ? (c.amount || 0) : 0, // چک دریافتی از مشتری = بستانکار شخص
                balance: 0,
                timestamp: 3,
                imageUrl: c.imageUrl
            });
        });

        // ۵. حواله‌های انبار (ورود/خروج/مرجوعی) - صرفاً جهت اطلاع با آیکن خاص و بدون هیچ تاثیری در ارقام و مانده
        const personVouchers = vouchers.filter((v: any) => v.personId === personId);
        personVouchers.forEach((v: any) => {
            const isOut = v.type === 'OUT';
            const isIn = v.type === 'IN';
            const typeLabel = isIn ? 'ورود به انبار' : isOut ? 'خروج از انبار' : 'مرجوعی کالا';
            const itemCount = v.items?.length || 0;
            const itemsSummary = v.items?.map((it: any) => `${it.productName || 'کالا'} (${toPersianDigits(it.quantity)} ${it.unit || 'عدد'})`).slice(0, 2).join('، ');
            const descSuffix = itemsSummary ? ` [${itemsSummary}${itemCount > 2 ? ' ...' : ''}]` : '';

            entries.push({
                id: `vouch-${v.id}`,
                date: v.date,
                type: 'VOUCHER_INFO',
                referenceId: v.id,
                referenceNumber: String(v.number || v.trackingCode || ''),
                description: `حواله ${typeLabel} شماره ${v.number}${descSuffix}`,
                debit: 0,   // هیچ تاثیری در مبالغ ندارد
                credit: 0,  // هیچ تاثیری در مبالغ ندارد
                balance: 0, // مانده را تغییر نمی‌دهد
                timestamp: v.createdAt ? new Date(v.createdAt).getTime() : 1.5,
                relatedInvoiceId: v.relatedInvoiceId,
                isChild: true
            });
        });

        // مرتب‌سازی تقویمی و اولویت سندی (در تاریخ یکسان: ابتدا فاکتور، سپس دریافت/پرداخت، سپس چک، سپس حواله اطلاع)
        entries.sort((a, b) => {
            if (a.date !== b.date) {
                return a.date.localeCompare(b.date);
            }
            const typePriority = (t: string) => (t === 'INVOICE' ? 1 : t === 'PAYMENT' ? 2 : t === 'CHECK' ? 3 : t === 'VOUCHER_INFO' ? 4 : 5);
            const prioDiff = typePriority(a.type) - typePriority(b.type);
            if (prioDiff !== 0) return prioDiff;
            return (a.timestamp || 0) - (b.timestamp || 0);
        });

        // محاسبه مانده تجمعی خط به خط (مانده مثبت = بدهکار، مانده منفی = بستانکار)
        let currentBalance = 0;
        const calculatedEntries = entries.map(entry => {
            currentBalance += (entry.debit - entry.credit);
            return {
                ...entry,
                balance: currentBalance
            };
        });

        // ذخیره در کش محلی جهت دسترسی آفلاین سریع
        try {
            localStorage.setItem(`ledger-${personId}`, JSON.stringify(calculatedEntries));
        } catch {}

        return calculatedEntries;
    }
    
    // دریافت مانده دقیق شخص با پشتیبانی از کالکشن‌های سفارشی/به‌روز
    static getBalance(personId: string, customInvoices?: any[], customTransactions?: any[], customChecks?: any[], customVouchers?: any[]): number {
        if (!personId) return 0;
        const ledger = this.getLedger(personId, customInvoices, customTransactions, customChecks, customVouchers);
        return ledger.length > 0 ? ledger[ledger.length - 1].balance : 0;
    }
    
    // گزارش کاردکس با امکان فیلتر بازه تاریخی و احتساب مانده منقول از قبل (استاندارد دارایی و حسابداری)
    static getReport(personId: string, fromDate?: string, toDate?: string, customInvoices?: any[], customTransactions?: any[], customChecks?: any[], customVouchers?: any[]) {
        const fullLedger = this.getLedger(personId, customInvoices, customTransactions, customChecks, customVouchers);
        
        let filteredEntries = [...fullLedger];
        let openingEntry: LedgerEntry | null = null;

        if (fromDate) {
            const beforeEntries = fullLedger.filter(e => e.date < fromDate);
            if (beforeEntries.length > 0) {
                const prevDebit = beforeEntries.reduce((s, e) => s + (e.debit || 0), 0);
                const prevCredit = beforeEntries.reduce((s, e) => s + (e.credit || 0), 0);
                const openingBalance = prevDebit - prevCredit;

                openingEntry = {
                    id: `opening-${personId}-${fromDate}`,
                    date: fromDate,
                    type: 'TRANSACTION',
                    referenceId: 'opening-balance',
                    referenceNumber: '---',
                    description: `مانده منقول از قبل (پیش از تاریخ ${fromDate})`,
                    debit: openingBalance > 0 ? openingBalance : 0,
                    credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
                    balance: openingBalance,
                    timestamp: 0
                };
            }
            filteredEntries = fullLedger.filter(e => e.date >= fromDate);
        }

        if (toDate) {
            filteredEntries = filteredEntries.filter(e => e.date <= toDate);
        }

        const entriesToShow = openingEntry ? [openingEntry, ...filteredEntries] : filteredEntries;

        const totalDebit = filteredEntries.reduce((sum, e) => sum + (e.debit || 0), 0) + (openingEntry ? (openingEntry.debit || 0) : 0);
        const totalCredit = filteredEntries.reduce((sum, e) => sum + (e.credit || 0), 0) + (openingEntry ? (openingEntry.credit || 0) : 0);
        const finalBalance = fullLedger.length > 0 ? fullLedger[fullLedger.length - 1].balance : 0;
        
        return {
            entries: entriesToShow,
            totalDebit,
            totalCredit,
            finalBalance
        };
    }

    // متدهای سازگاری گذشته
    static addEntry(personId: string, entry: any): LedgerEntry {
        const ledger = this.getLedger(personId);
        return ledger[ledger.length - 1] || entry;
    }

    static removeEntry(personId: string, entryId: string) {
        // با اتکا به استور نیازی به دستی نیست
    }

    static removeByReference(personId: string, referenceId: string) {
        try {
            const raw = localStorage.getItem(`ledger-${personId}`);
            if (raw) {
                const list = JSON.parse(raw);
                const filtered = list.filter((e: any) => e.referenceId !== referenceId && e.relatedInvoiceId !== referenceId);
                localStorage.setItem(`ledger-${personId}`, JSON.stringify(filtered));
            }
        } catch {}
    }
}

function getPersianDateFallback(): string {
    return new Date().toLocaleDateString('fa-IR-u-nu-latn').split('/').map(p => p.padStart(2, '0')).join('/');
}

export default PersonLedgerService;
