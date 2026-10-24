import * as XLSX from 'xlsx';
import { Person, Transaction, Invoice, CompanyProfile } from '../types';
import { formatCurrency, toPersianDigits, getPersianDate } from '../utils';

export interface LedgerExportOptions {
    person: Person;
    company?: CompanyProfile;
    entries: any[];
    totalDebit: number;
    totalCredit: number;
    finalBalance: number;
    fromDate?: string;
    toDate?: string;
}

export interface ProfitLossExportOptions {
    company?: CompanyProfile;
    periodTitle: string;
    fromDate: string;
    toDate: string;
    grossSales: number;
    salesDiscounts: number;
    netSales: number;
    cogs: number;
    grossProfit: number;
    salariesExpense: number;
    operationalExpenses: number;
    totalOperatingExpenses: number;
    operatingProfit: number;
    otherIncome: number;
    financingCosts: number;
    netProfitBeforeTax: number;
    estimatedTax: number;
    netProfit: number;
}

export class ExcelExportService {
    /**
     * استخراج کاردکس حساب اشخاص با فرمت استاندارد حسابداری و دارایی
     */
    static exportPersonLedgerToExcel(options: LedgerExportOptions) {
        const { person, company, entries, totalDebit, totalCredit, finalBalance, fromDate, toDate } = options;
        const printDate = getPersianDate();
        const companyName = company?.name || 'مجموعه تجاری اشک قلم';

        // ایجاد ردیف‌های عنوان سربرگ
        const compAny = company as any;
        const data: any[][] = [
            [`کاردکس حساب تفصیلی اشخاص (استاندارد حسابرسی و امور مالیاتی)`],
            [`نام مجموعه / شرکت: ${companyName}`, '', `شناسه ملی / کد اقتصادی: ${compAny?.nationalId || compAny?.economicCode || compAny?.legalName || '-'}`],
            [`نام طرف حساب: ${person.name}`, `کد حساب: ${person.code || person.id.slice(-6)}`, `شماره تماس: ${person.phone || '-'}`],
            [`کد ملی / شناسه اقتصادی: ${person.nationalId || '-'}`, '', `دوره گزارش: از ${fromDate || 'ابتدای دوره'} تا ${toDate || 'پایان دوره'}`],
            [`تاریخ صدور گزارش: ${printDate}`, '', 'واحد پول: ریال ایران'],
            [], // ردیف خالی
            [
                'ردیف',
                'تاریخ سند',
                'نوع سند / رویداد مالی',
                'شماره سند / فاکتور',
                'شرح کامل عملیات مالی',
                'بدهکار (ریال)',
                'بستانکار (ریال)',
                'تشخیص',
                'مانده نهایی (ریال)'
            ]
        ];

        // افزودن سطرهای تراکنش
        entries.forEach((entry, index) => {
            let docTypeName = 'سند متفرقه';
            if (entry.type === 'INVOICE') {
                docTypeName = entry.debit > 0 ? 'فاکتور فروش کالا/خدمات' : 'فاکتور خرید کالا/خدمات';
            } else if (entry.type === 'PAYMENT') {
                docTypeName = entry.credit > 0 ? 'دریافت وجه نقد / حواله' : 'پرداخت وجه نقد / حواله';
            } else if (entry.type === 'CHECK' || entry.type === 'CHECK_PAYMENT') {
                docTypeName = 'سند دریافت / واگذاری چک';
            } else if (entry.type === 'VOUCHER' || entry.type === 'VOUCHER_INFO') {
                docTypeName = 'حواله انبار (صرفاً اطلاع)';
            }

            const debitVal = Number(entry.debit) || 0;
            const creditVal = Number(entry.credit) || 0;
            const balanceVal = Number(entry.balance) || 0;
            const diagnosis = balanceVal > 0 ? 'بدهکار' : balanceVal < 0 ? 'بستانکار' : 'تسویه';

            data.push([
                index + 1,
                entry.date || '-',
                docTypeName,
                entry.referenceNumber || entry.referenceId || '-',
                entry.description || '-',
                debitVal,
                creditVal,
                diagnosis,
                Math.abs(balanceVal)
            ]);
        });

        // ردیف سرجمع نهایی
        const finalDiagnosis = finalBalance > 0 ? 'بدهکار' : finalBalance < 0 ? 'بستانکار' : 'بی‌حساب / تسویه';
        data.push([]);
        data.push([
            '',
            '',
            'جمع کل گردش دوره:',
            '',
            '',
            totalDebit,
            totalCredit,
            finalDiagnosis,
            Math.abs(finalBalance)
        ]);

        data.push([]);
        data.push(['تاییدیه امور مالی و حسابداری', '', '', '', '', '', 'امضا و اثرانگشت طرف حساب']);

        // ساخت شیت اکسل
        const worksheet = XLSX.utils.aoa_to_sheet(data);

        // تنظیم جهت راست‌چین (RTL)
        worksheet['!views'] = [{ rightToLeft: true }];

        // تنظیم عرض استاندارد ستون‌ها
        worksheet['!cols'] = [
            { wch: 8 },  // ردیف
            { wch: 14 }, // تاریخ
            { wch: 24 }, // نوع سند
            { wch: 18 }, // شماره سند
            { wch: 45 }, // شرح
            { wch: 20 }, // بدهکار
            { wch: 20 }, // بستانکار
            { wch: 12 }, // تشخیص
            { wch: 22 }  // مانده
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'کاردکس حساب');

        const cleanPersonName = person.name.replace(/[\\/:*?"<>|]/g, '_');
        const fileName = `کاردکس_حساب_${cleanPersonName}_${printDate.replace(/\//g, '-')}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    }

    /**
     * استخراج صورت سود و زیان استاندارد به اکسل جهت ارائه به حسابرس و اداره مالیات
     */
    static exportProfitLossToExcel(options: ProfitLossExportOptions) {
        const { company, periodTitle, fromDate, toDate } = options;
        const printDate = getPersianDate();
        const companyName = company?.name || 'مجموعه تجاری اشک قلم';

        const compAny = company as any;
        const data: any[][] = [
            [`صورت سود و زیان دوره‌ای (استاندارد سازمان حسابرسی و امور مالیاتی)`],
            [`نام واحد اقتصادی: ${companyName}`, '', `شناسه ملی / ثبت: ${compAny?.nationalId || compAny?.registrationNumber || compAny?.legalName || '-'}`],
            [`دوره مالی گزارش: ${periodTitle} (از ${fromDate} تا ${toDate})`, '', `تاریخ تهیه گزارش: ${printDate}`],
            ['واحد ارقام: ریال ایران', '', 'کد گزارش: PL-STD-1403'],
            [], // ردیف خالی
            ['شرح سرفصل حسابداری', 'مبلغ فرعی (ریال)', 'مبلغ اصلی (ریال)', 'درصد از درآمد خالص']
        ];

        const netSales = options.netSales || 1; // جلوگیری از تقسیم بر صفر

        // ۱. درآمد عملیاتی
        data.push(['۱. درآمدهای عملیاتی (فروش ناخالص)', options.grossSales, '', '']);
        data.push(['   کسر می‌شود: تخفیفات و برگشت از فروش', options.salesDiscounts, '', '']);
        data.push(['   درآمد خالص فروش کالا و خدمات', '', options.netSales, '۱۰۰.۰ ٪']);

        // ۲. بهای تمام شده
        data.push(['۲. کسر می‌شود: بهای تمام‌شده کالای فروش‌رفته و خدمات', '', options.cogs, `${((options.cogs / netSales) * 100).toFixed(1)} ٪`]);
        data.push(['   سود (زیان) ناخالص عملیاتی', '', options.grossProfit, `${((options.grossProfit / netSales) * 100).toFixed(1)} ٪`]);

        // ۳. هزینه‌ها
        data.push(['۳. هزینه‌های عمومی، اداری و فروش', '', '', '']);
        data.push(['   هزینه‌های حقوق و دستمزد پرسنل', options.salariesExpense, '', '']);
        data.push(['   سایر هزینه‌های جاری و اداری', options.operationalExpenses, '', '']);
        data.push(['   مجموع هزینه‌های عملیاتی دوره', '', options.totalOperatingExpenses, `${((options.totalOperatingExpenses / netSales) * 100).toFixed(1)} ٪`]);

        // ۴. سود عملیاتی
        data.push(['۴. سود (زیان) عملیاتی دوره', '', options.operatingProfit, `${((options.operatingProfit / netSales) * 100).toFixed(1)} ٪`]);

        // ۵. درآمدهای غیرعملیاتی
        data.push(['۵. سایر درآمدها و هزینه‌های غیرعملیاتی', '', '', '']);
        data.push(['   درآمدهای متفرقه و سرمایه‌گذاری', options.otherIncome, '', '']);
        data.push(['   کسر می‌شود: هزینه‌های مالی و کارمزدها', options.financingCosts, '', '']);

        // ۶. سود قبل و بعد از مالیات
        data.push(['۶. سود (زیان) خالص قبل از کسر مالیات', '', options.netProfitBeforeTax, `${((options.netProfitBeforeTax / netSales) * 100).toFixed(1)} ٪`]);
        data.push(['   مالیات عملکرد برآوردی (۲۵٪ قانون مالیات‌های مستقیم)', '', options.estimatedTax, `${((options.estimatedTax / netSales) * 100).toFixed(1)} ٪`]);
        data.push(['۷. سود (زیان) ویژه خالص پس از کسر مالیات دوره', '', options.netProfit, `${((options.netProfit / netSales) * 100).toFixed(1)} ٪`]);

        data.push([]);
        data.push(['تهیه‌کننده: کارشناس مالی', '', 'بررسی‌کننده: مدیر مالی', 'تاییدکننده: هیئت‌مدیره / مدیرعامل']);

        const worksheet = XLSX.utils.aoa_to_sheet(data);
        worksheet['!views'] = [{ rightToLeft: true }];
        worksheet['!cols'] = [
            { wch: 45 }, // شرح
            { wch: 22 }, // فرعی
            { wch: 24 }, // اصلی
            { wch: 20 }  // درصد
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'صورت سود و زیان');

        const fileName = `صورت_سود_و_زیان_${periodTitle.replace(/\s+/g, '_')}_${printDate.replace(/\//g, '-')}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    }
}
