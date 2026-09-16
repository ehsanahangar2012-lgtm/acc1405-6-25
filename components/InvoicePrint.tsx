import React from 'react';
import { Invoice, PrintTheme, Person } from '../types';
import { toPersianDigits, formatCurrency, formatAmountOnly, getCurrencyLabel, getQrCodeUrl, generateBarcodeSvg, generateLocalQrSvg } from '../utils';
import { useStore } from '../store';
import { ShieldCheck, Phone, MapPin, ScrollText, PenTool, UserCheck, CreditCard, Wallet, Layers, Box, Hexagon, Command, Feather, Briefcase, Zap, Hash, Coins, Building2, HelpCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { PersianWatermarkCanvas, PersianHeaderBanner, PersianCard, PersianHashtiSeal, IslimiCornerSvg } from './PersianArtCanvas';
import { DocumentTrialWatermarkFooter } from './DocumentTrialWatermarkFooter';

interface Props { 
    data: Invoice; 
    person?: Person; 
    theme: PrintTheme; 
    showPreviousBalance?: boolean;
}

export const InvoicePrint: React.FC<Props> = ({ data, person, theme, showPreviousBalance = true }) => {
    const { companies, config } = useStore();
    
    // 1. Resolve Company from snapshot or store
    const company = (data as any).companySnapshot || (data as any).company || companies.find(c => c.id === data.companyId) || companies[0];
    
    // 2. Resolve Branch from snapshot or company's branches
    const branch = (data as any).branchSnapshot || company?.branches?.find((b: any) => b.id === data.branchId);

    // 3. Resolve Effective Company/Branch specifications
    const effectiveLogo = branch?.logo || company?.logo;
    const effectiveStamp = branch?.stamp || company?.stamp;
    const effectiveSignature = branch?.signature || company?.signature;
    const companyName = company?.name || 'مجموعه تجاری';
    const branchName = branch?.name || '';
    const branchCode = branch?.code || '';
    const fullTitle = branchName ? `${companyName} (${branchName})` : companyName;
    const effectivePhone = branch?.phone || company?.phone || '---';
    const effectiveAddress = branch?.address || company?.address || '---';
    const economicCode = branch?.economicCode || company?.economicCode;
    const nationalId = branch?.nationalId || company?.nationalId;
    const registrationNumber = branch?.registrationNumber || company?.registrationNumber;
    const postalCode = branch?.postalCode || company?.postalCode;
    const managerName = branch?.managerName || company?.managerName;

    const docCompany = {
        ...company,
        name: fullTitle,
        baseCompanyName: companyName,
        branchName: branchName,
        branchCode: branchCode,
        fullTitle: fullTitle,
        logo: effectiveLogo,
        stamp: effectiveStamp,
        signature: effectiveSignature,
        phone: effectivePhone,
        address: effectiveAddress,
        economicCode: economicCode,
        nationalId: nationalId,
        registrationNumber: registrationNumber,
        postalCode: postalCode,
        managerName: managerName,
    };

    const invoiceNumDisplay = (data.prefix || '') + toPersianDigits(data.number);
    const trackingCode = data.trackingCode || `INV-${data.prefix || ''}${data.number}`;
    
    const currency = config?.currency || 'RIAL';
    const currencyLabel = getCurrencyLabel(currency);

    const [qrCode, setQrCode] = React.useState<string>('');
    const [barcodeUrl, setBarcodeUrl] = React.useState<string>('');

    React.useEffect(() => {
        const qrData = `Invoice:${invoiceNumDisplay}\nDate:${data.date}\nTotal:${data.finalTotal}\nCustomer:${data.personName}\nAuth:${trackingCode}`;
        
        import('qrcode').then((QRCodeLib) => {
            QRCodeLib.default.toDataURL(qrData, { 
                margin: 1, 
                width: 250,
                color: { dark: '#0f172a', light: '#ffffff' }
            }).then(url => setQrCode(url));
        }).catch(() => {
            setQrCode(getQrCodeUrl(qrData));
        });

        setBarcodeUrl(generateBarcodeSvg(trackingCode));
    }, [data.number, data.prefix, data.date, data.finalTotal, data.personName, trackingCode, invoiceNumDisplay]);

    const currentBalance = person?.balance || 0;
    const thisInvoiceDebt = data.finalTotal;
    const thisInvoicePaid = (data.cashAmount || 0) + (data.checkAmount || 0);
    const prevBalance = currentBalance - (thisInvoiceDebt - thisInvoicePaid);
    const effectiveShowPrevBalance = showPreviousBalance !== undefined ? showPreviousBalance : (data.showPreviousBalance !== undefined ? data.showPreviousBalance : true);

    const commonProps = { 
        data, 
        docCompany, 
        qrCode, 
        barcodeUrl, 
        trackingCode, 
        prevBalance, 
        currentBalance, 
        thisInvoicePaid, 
        invoiceNumDisplay,
        currency,
        currencyLabel,
        showPreviousBalance: effectiveShowPrevBalance
    };

    switch (theme) {
        case 'thermal': return <Thermal80mmTheme {...commonProps} />;
        case 'official': return <OfficialCleanTheme {...commonProps} />;
        case 'industrial': return <IndustrialCrispTheme {...commonProps} />;
        case 'premium': return <ExecutiveIvoryTheme {...commonProps} />;
        case 'creative':
        case 'colorful': return <CreativeBrightTheme {...commonProps} />;
        case 'minimal': return <MinimalLightTheme {...commonProps} />;
        case 'persian': return <PersianHeritageTheme {...commonProps} />;
        case 'modern':
        case 'smart':
        default: return <ModernCorporateTheme {...commonProps} />;
    }
};

// --- تم ۱: شرکتی مدرن برگه کاغذ سفید (Modern Corporate Paper White) ---
const ModernCorporateTheme = ({ data, docCompany, qrCode, barcodeUrl, trackingCode, prevBalance, currentBalance, thisInvoicePaid, invoiceNumDisplay, currency, currencyLabel, showPreviousBalance = true }: any) => {
    return (
        <div className="invoice-paper sheet-a4-white bg-white min-h-[297mm] h-auto flex flex-col font-sans text-slate-900 p-8 md:p-12 overflow-visible border-b" dir="rtl" style={{ direction: 'rtl', letterSpacing: 'normal' }}>
            {/* سربرگ */}
            <div className="border-b-2 border-slate-200 pb-6 mb-6" dir="rtl">
                <div className="flex justify-between items-start" dir="rtl">
                    <div className="flex items-center gap-4 text-right" dir="rtl">
                        <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center p-2 text-blue-700 shadow-sm shrink-0">
                            {docCompany?.logo ? <img src={docCompany.logo} className="w-full h-full object-contain" alt="لوگو" /> : <Building2 size={32} />}
                        </div>
                        <div className="text-right" dir="rtl">
                            <h1 className="text-2xl font-black text-slate-950" style={{ letterSpacing: 'normal' }}>{docCompany?.name || 'مجموعه تجاری'}</h1>
                            <p className="text-xs text-slate-600 mt-1 font-medium">{docCompany?.address || 'تهران'}</p>
                            <p className="text-xs text-slate-600 font-medium">تلفن: <span className="font-bold text-slate-800">{toPersianDigits(docCompany?.phone || '---')}</span></p>
                        </div>
                    </div>
                    <div className="text-left flex flex-col items-end">
                        <div className="bg-blue-600 text-white px-6 py-2 rounded-xl text-lg font-black shadow-md mb-2">
                            فاکتور {data.type}
                        </div>
                        <div className="text-xs text-slate-600 font-bold space-y-1">
                            <div>شماره فاکتور: <span className="font-black text-slate-950 text-sm font-mono">{invoiceNumDisplay}</span></div>
                            <div>تاریخ صدور: <span className="font-black text-slate-950">{toPersianDigits(data.date)}</span></div>
                            {data.dueDate && <div>سررسید: <span className="text-slate-800">{toPersianDigits(data.dueDate)}</span></div>}
                        </div>
                    </div>
                </div>
            </div>

            {/* مشخصات مشتری و سند */}
            <div className="grid grid-cols-2 gap-4 mb-6" dir="rtl">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-right" dir="rtl">
                    <div className="flex items-center gap-2 mb-2 text-blue-700 font-black text-xs">
                        <UserCheck size={16} />
                        <span>مشخصات خریدار / طرف حساب</span>
                    </div>
                    <div className="text-slate-950 font-black text-lg mb-1" style={{ letterSpacing: 'normal' }}>{data.personName}</div>
                    <div className="text-xs text-slate-600">کد مشتری: <span className="font-mono font-bold text-slate-800">{toPersianDigits(data.personId?.substring(0, 8) || '---')}</span></div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex justify-between items-center" dir="rtl">
                    <div className="text-right">
                        <div className="text-xs font-bold text-slate-500 mb-1">کد پیگیری و اصالت سند</div>
                        <div className="font-mono font-black text-xs text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 inline-block mb-1">{trackingCode}</div>
                        {data.taxId && <div className="text-[10px] text-slate-600 font-mono">شناسه مالیاتی: {data.taxId}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                        {qrCode && <img src={qrCode} className="w-14 h-14 rounded-lg border border-slate-200 p-0.5 bg-white" alt="QR" />}
                    </div>
                </div>
            </div>

            {/* جدول اقلام با واحد پولی انتخابی */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden mb-6 shadow-sm bg-white" dir="ltr">
                <table className="w-full" dir="ltr" style={{ direction: 'ltr', width: '100%', borderCollapse: 'collapse' }}>
                    <thead className="bg-slate-100 text-slate-800 text-xs font-black border-b border-slate-200" style={{ direction: 'ltr' }}>
                        <tr style={{ direction: 'ltr' }}>
                            <th className="p-3.5 text-left w-40" style={{ textAlign: 'left' }} dir="rtl">جمع کل ({currencyLabel})</th>
                            <th className="p-3.5 text-left w-36" style={{ textAlign: 'left' }} dir="rtl">قیمت واحد ({currencyLabel})</th>
                            <th className="p-3.5 text-center w-20" style={{ textAlign: 'center' }} dir="rtl">تعداد</th>
                            <th className="p-3.5 text-right" style={{ textAlign: 'right' }} dir="rtl">شرح کالا یا خدمات</th>
                            <th className="p-3.5 text-center w-12" style={{ textAlign: 'center' }} dir="rtl">#</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-900 text-sm bg-white" style={{ direction: 'ltr' }}>
                        {data.items.map((item: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-50/80 transition-colors" style={{ direction: 'ltr' }}>
                                <td className="p-3 text-left font-mono font-black text-slate-950" style={{ textAlign: 'left' }} dir="rtl">{formatAmountOnly(item.total, currency)}</td>
                                <td className="p-3 text-left font-mono font-semibold text-slate-800" style={{ textAlign: 'left' }} dir="rtl">{formatAmountOnly(item.unitPrice, currency)}</td>
                                <td className="p-3 text-center font-bold" style={{ textAlign: 'center' }} dir="rtl">{toPersianDigits(item.quantity)}</td>
                                <td className="p-3 font-bold text-slate-950 text-right" style={{ textAlign: 'right', letterSpacing: 'normal' }} dir="rtl">
                                    {item.productName}
                                    {item.description && <span className="block text-[11px] text-slate-500 font-normal mt-0.5">{item.description}</span>}
                                </td>
                                <td className="p-3 text-center text-xs font-bold text-slate-500" style={{ textAlign: 'center' }} dir="rtl">{toPersianDigits(i + 1)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* خلاصه مبالغ و کاردکس */}
            <div className="grid grid-cols-12 gap-6 mb-6" dir="rtl">
                <div className="col-span-7 bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between text-right" dir="rtl">
                    <div>
                        <h4 className="text-xs font-black text-slate-800 mb-2 flex items-center gap-1.5">
                            <Coins size={15} className="text-blue-600"/> 
                            {showPreviousBalance ? 'وضعیت تسویه و کاردکس' : 'وضعیت تسویه فاکتور'}
                        </h4>
                        {showPreviousBalance ? (
                            <div className="grid grid-cols-3 gap-2 text-xs mb-3" dir="rtl">
                                <div className="bg-white p-2 rounded-xl border border-slate-200 text-center">
                                    <span className="text-[10px] text-slate-500 block">مانده قبلی</span>
                                    <span className="font-mono font-bold text-slate-900">{formatCurrency(prevBalance, currency)}</span>
                                </div>
                                <div className="bg-white p-2 rounded-xl border border-slate-200 text-center">
                                    <span className="text-[10px] text-slate-500 block">پرداخت فاکتور</span>
                                    <span className="font-mono font-bold text-emerald-700">{formatCurrency(thisInvoicePaid, currency)}</span>
                                </div>
                                <div className="bg-white p-2 rounded-xl border border-slate-200 text-center">
                                    <span className="text-[10px] text-slate-500 block">مانده کل حساب</span>
                                    <span className="font-mono font-black text-blue-700">{formatCurrency(currentBalance, currency)}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2 text-xs mb-3" dir="rtl">
                                <div className="bg-white p-2 rounded-xl border border-slate-200 text-center">
                                    <span className="text-[10px] text-slate-500 block">پرداخت این فاکتور</span>
                                    <span className="font-mono font-bold text-emerald-700">{formatCurrency(thisInvoicePaid, currency)}</span>
                                </div>
                                <div className="bg-white p-2 rounded-xl border border-slate-200 text-center">
                                    <span className="text-[10px] text-slate-500 block">مانده تسویه فاکتور</span>
                                    <span className="font-mono font-black text-blue-700">{formatCurrency(Math.max(0, data.finalTotal - thisInvoicePaid), currency)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                    {data.description && (
                        <div className="bg-white p-2 rounded-xl border border-slate-200 text-[9.5px] text-slate-600 leading-4 font-normal text-right" style={{ letterSpacing: 'normal' }}>
                            <span className="font-bold text-slate-800 text-[10px]">توضیحات و شرایط: </span>{data.description}
                        </div>
                    )}
                </div>
                <div className="col-span-5 bg-blue-50/80 border border-blue-200 rounded-2xl p-4 text-xs space-y-2 text-right" dir="rtl">
                    <div className="flex justify-between text-slate-700 font-medium">
                        <span>جمع اقلام:</span>
                        <span className="font-mono font-bold">{formatAmountOnly(data.subTotal, currency)} {currencyLabel}</span>
                    </div>
                    {(data.discount || 0) > 0 && (
                        <div className="flex justify-between text-rose-700 font-medium">
                            <span>تخفیف:</span>
                            <span className="font-mono font-bold">-{formatAmountOnly(data.discount, currency)} {currencyLabel}</span>
                        </div>
                    )}
                    {(data.tax || 0) > 0 && (
                        <div className="flex justify-between text-slate-700 font-medium">
                            <span>مالیات:</span>
                            <span className="font-mono font-bold">+{formatAmountOnly(data.tax, currency)} {currencyLabel}</span>
                        </div>
                    )}
                    <div className="border-t border-blue-200 pt-2 flex justify-between items-center">
                        <span className="font-black text-slate-950 text-sm">مبلغ قابل پرداخت:</span>
                        <span className="font-mono font-black text-blue-900 text-lg">{formatCurrency(data.finalTotal, currency)}</span>
                    </div>
                </div>
            </div>

            {/* امضا و تایید */}
            <div className="mt-auto grid grid-cols-3 gap-6 pt-4 border-t border-slate-200 text-center" dir="rtl">
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 min-h-[90px] flex flex-col justify-between">
                    <div className="h-14 flex items-center justify-center gap-2">
                        {docCompany?.stamp && <img src={docCompany.stamp} className="max-h-full max-w-[48%] object-contain" alt="مهر" />}
                        {docCompany?.signature && <img src={docCompany.signature} className="max-h-full max-w-[48%] object-contain" alt="امضا" />}
                    </div>
                    <span className="text-[10px] font-black text-slate-700">مهر و امضای فروشنده {docCompany?.branchName ? `(${docCompany.branchName})` : ''}</span>
                </div>
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 min-h-[90px] flex items-center justify-center gap-3">
                    <img src={generateLocalQrSvg(`INV:${data.id}:${data.finalTotal}`)} alt="PayQR" className="w-12 h-12" />
                    <div className="text-right text-[10px]">
                        <span className="font-black text-slate-900 block">پرداخت سریع</span>
                        <span className="text-slate-500">اسکن با همراه بانک</span>
                    </div>
                </div>
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 min-h-[90px] flex flex-col justify-between">
                    <div className="h-14 flex items-center justify-center">
                        {data.signature && <img src={data.signature} className="max-h-full max-w-full object-contain" alt="امضا" />}
                    </div>
                    <span className="text-[10px] font-black text-slate-700">امضای خریدار</span>
                </div>
            </div>
            <DocumentTrialWatermarkFooter />
        </div>
    );
};

// --- تم ۲: خلاقانه برگه سفید و خوانا (Creative Clean Paper) ---
const CreativeBrightTheme = ({ data, docCompany, qrCode, barcodeUrl, trackingCode, prevBalance, currentBalance, thisInvoicePaid, invoiceNumDisplay, currency, currencyLabel, showPreviousBalance = true }: any) => {
    return (
        <div className="invoice-paper sheet-a4-white bg-white min-h-[297mm] h-auto flex flex-col font-sans text-slate-950 p-8 md:p-12 overflow-visible border-4 border-indigo-100" dir="rtl" style={{ direction: 'rtl', letterSpacing: 'normal' }}>
            <div className="bg-indigo-50/50 border border-indigo-200 rounded-3xl p-6 mb-6 shadow-sm" dir="rtl">
                <div className="flex justify-between items-start" dir="rtl">
                    <div className="flex items-center gap-4 text-right" dir="rtl">
                        <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center p-2.5 shadow-md shrink-0">
                            {docCompany?.logo ? <img src={docCompany.logo} className="w-full h-full object-contain rounded-xl" alt="لوگو" /> : <Zap size={32} />}
                        </div>
                        <div className="text-right" dir="rtl">
                            <h1 className="text-2xl font-black text-indigo-950" style={{ letterSpacing: 'normal' }}>{docCompany?.name || 'مجموعه'}</h1>
                            <p className="text-xs text-slate-600 font-bold mt-1">{docCompany?.address || 'دفتر مرکزی'}</p>
                            <p className="text-xs text-slate-600 font-bold">تلفن: {toPersianDigits(docCompany?.phone || '')}</p>
                        </div>
                    </div>
                    <div className="text-left flex flex-col items-end">
                        <div className="bg-indigo-600 text-white px-5 py-2 rounded-2xl text-lg font-black shadow-md mb-2 flex items-center gap-2">
                            <span>فاکتور {data.type}</span>
                            <span className="bg-white/20 px-2 py-0.5 rounded-lg text-xs font-mono">{invoiceNumDisplay}</span>
                        </div>
                        <div className="text-xs text-slate-700 font-bold space-y-1">
                            <div>تاریخ: <span className="font-black text-slate-950">{toPersianDigits(data.date)}</span></div>
                            <div className="text-[10px] text-indigo-700 font-mono font-bold bg-white px-2 py-0.5 rounded-md border border-indigo-200">{trackingCode}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-4 mb-6" dir="rtl">
                <div className="col-span-8 bg-indigo-50/40 border border-indigo-200 rounded-2xl p-4 text-right" dir="rtl">
                    <span className="text-[10px] font-black text-indigo-700 block mb-1">خریدار محترم</span>
                    <h2 className="text-xl font-black text-slate-950 mb-1" style={{ letterSpacing: 'normal' }}>{data.personName}</h2>
                    <span className="text-xs text-slate-600 font-bold">کد طرف حساب: {toPersianDigits(data.personId?.substring(0, 8) || '---')}</span>
                </div>
                <div className="col-span-4 bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between" dir="rtl">
                    <div className="text-xs text-slate-700 text-right">
                        <span className="font-bold block text-slate-900 mb-1">اصالت دیجیتال</span>
                        <span className="text-[10px] text-slate-500 block">ثبت شده در سامانه</span>
                    </div>
                    {qrCode && <img src={qrCode} className="w-12 h-12 rounded-xl border border-slate-300 p-0.5 bg-white" alt="QR" />}
                </div>
            </div>

            <div className="border border-indigo-100 rounded-2xl overflow-hidden mb-6 shadow-sm bg-white" dir="rtl">
                <table className="w-full text-right" dir="rtl" style={{ direction: 'rtl', width: '100%', borderCollapse: 'collapse' }}>
                    <thead className="bg-indigo-600 text-white text-xs font-black" style={{ direction: 'rtl' }}>
                        <tr style={{ direction: 'rtl' }}>
                            <th className="p-3.5 text-center w-12" style={{ textAlign: 'center' }}>#</th>
                            <th className="p-3.5 text-right" style={{ textAlign: 'right' }}>شرح کالا یا خدمات</th>
                            <th className="p-3.5 text-center w-20" style={{ textAlign: 'center' }}>تعداد</th>
                            <th className="p-3.5 text-left w-36" style={{ textAlign: 'left' }}>قیمت واحد ({currencyLabel})</th>
                            <th className="p-3.5 text-left w-40" style={{ textAlign: 'left' }}>جمع کل ({currencyLabel})</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-950 text-sm bg-white" style={{ direction: 'rtl' }}>
                        {data.items.map((item: any, i: number) => (
                            <tr key={i} className="hover:bg-indigo-50/30 transition-colors" style={{ direction: 'rtl' }}>
                                <td className="p-3.5 text-center text-xs font-black text-indigo-700" style={{ textAlign: 'center' }}>{toPersianDigits(i + 1)}</td>
                                <td className="p-3.5 font-black text-slate-950 text-right" style={{ textAlign: 'right', letterSpacing: 'normal' }}>
                                    {item.productName}
                                    {item.description && <span className="block text-xs text-slate-500 font-normal mt-0.5">{item.description}</span>}
                                </td>
                                <td className="p-3.5 text-center font-black text-slate-950" style={{ textAlign: 'center' }}>
                                    <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 px-2.5 py-1 rounded-lg font-mono font-bold">
                                        {toPersianDigits(item.quantity)}
                                    </span>
                                </td>
                                <td className="p-3.5 text-left font-mono font-bold text-slate-800" style={{ textAlign: 'left' }}>{formatAmountOnly(item.unitPrice, currency)}</td>
                                <td className="p-3.5 text-left font-mono font-black text-indigo-950 text-base" style={{ textAlign: 'left' }}>{formatAmountOnly(item.total, currency)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="grid grid-cols-12 gap-6 mb-6" dir="rtl">
                <div className="col-span-7 space-y-3 text-right" dir="rtl">
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                        <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 mb-2">
                            <Coins size={15} className="text-emerald-600" />
                            <span>{showPreviousBalance ? 'خلاصه کاردکس و وضعیت تسویه حساب' : 'وضعیت تسویه فاکتور'}</span>
                        </div>
                        {showPreviousBalance ? (
                            <div className="grid grid-cols-3 gap-2 text-xs" dir="rtl">
                                <div className="bg-white p-2 rounded-xl border border-slate-200 text-center">
                                    <span className="text-[10px] text-slate-500 block">مانده پیشین</span>
                                    <span className="font-mono font-bold text-slate-800">{formatCurrency(prevBalance, currency)}</span>
                                </div>
                                <div className="bg-white p-2 rounded-xl border border-slate-200 text-center">
                                    <span className="text-[10px] text-slate-500 block">پرداختی</span>
                                    <span className="font-mono font-bold text-emerald-700">{formatCurrency(thisInvoicePaid, currency)}</span>
                                </div>
                                <div className="bg-white p-2 rounded-xl border border-slate-200 text-center">
                                    <span className="text-[10px] text-slate-500 block">مانده نهایی</span>
                                    <span className="font-mono font-black text-indigo-800">{formatCurrency(currentBalance, currency)}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2 text-xs" dir="rtl">
                                <div className="bg-white p-2 rounded-xl border border-slate-200 text-center">
                                    <span className="text-[10px] text-slate-500 block">پرداخت این فاکتور</span>
                                    <span className="font-mono font-bold text-emerald-700">{formatCurrency(thisInvoicePaid, currency)}</span>
                                </div>
                                <div className="bg-white p-2 rounded-xl border border-slate-200 text-center">
                                    <span className="text-[10px] text-slate-500 block">مانده تسویه فاکتور</span>
                                    <span className="font-mono font-black text-indigo-800">{formatCurrency(Math.max(0, data.finalTotal - thisInvoicePaid), currency)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                    {data.description && (
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-[9.5px] text-slate-600 font-normal leading-4 text-right" style={{ letterSpacing: 'normal' }}>
                            <span className="font-bold text-slate-800 text-[10px]">توضیحات و شرایط: </span>
                            {data.description}
                        </div>
                    )}
                </div>

                <div className="col-span-5 bg-indigo-50/60 border-2 border-indigo-200 rounded-2xl p-5 text-xs space-y-2 text-right" dir="rtl">
                    <div className="flex justify-between text-slate-700 font-bold">
                        <span>مجموع اقلام:</span>
                        <span className="font-mono text-slate-950 font-black">{formatAmountOnly(data.subTotal, currency)} {currencyLabel}</span>
                    </div>
                    {(data.discount || 0) > 0 && (
                        <div className="flex justify-between text-rose-700 font-bold">
                            <span>تخفیف:</span>
                            <span className="font-mono font-black">-{formatAmountOnly(data.discount, currency)} {currencyLabel}</span>
                        </div>
                    )}
                    {(data.tax || 0) > 0 && (
                        <div className="flex justify-between text-indigo-900 font-bold">
                            <span>مالیات بر ارزش افزوده:</span>
                            <span className="font-mono font-black">+{formatAmountOnly(data.tax, currency)} {currencyLabel}</span>
                        </div>
                    )}
                    <div className="border-t-2 border-indigo-200 pt-3 flex flex-col items-end">
                        <span className="text-[11px] font-bold text-slate-500 mb-1">مبلغ نهایی فاکتور:</span>
                        <span className="font-mono font-black text-indigo-950 text-2xl">{formatCurrency(data.finalTotal, currency)}</span>
                    </div>
                </div>
            </div>

            <div className="mt-auto grid grid-cols-3 gap-6 pt-4 border-t border-slate-200 text-center" dir="rtl">
                <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50/50 min-h-[90px] flex flex-col justify-between">
                    <div className="h-14 flex items-center justify-center gap-2">
                        {docCompany?.stamp && <img src={docCompany.stamp} className="max-h-full max-w-[48%] object-contain" alt="مهر" />}
                        {docCompany?.signature && <img src={docCompany.signature} className="max-h-full max-w-[48%] object-contain" alt="امضا" />}
                    </div>
                    <span className="text-[10px] font-black text-slate-700">مهر و امضای فروشنده {docCompany?.branchName ? `(${docCompany.branchName})` : ''}</span>
                </div>
                <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50/50 min-h-[90px] flex items-center justify-center gap-3">
                    <img src={generateLocalQrSvg(`INV:${data.id}:${data.finalTotal}`)} alt="PayQR" className="w-12 h-12" />
                    <div className="text-right text-[10px]">
                        <span className="font-black text-indigo-950 block">درگاه پرداخت سریع</span>
                        <span className="text-slate-500">اسکن بارکد بانکی</span>
                    </div>
                </div>
                <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50/50 min-h-[90px] flex flex-col justify-between">
                    <div className="h-14 flex items-center justify-center">
                        {data.signature && <img src={data.signature} className="max-h-full max-w-full object-contain" alt="امضا" />}
                    </div>
                    <span className="text-[10px] font-black text-slate-700">امضای خریدار</span>
                </div>
            </div>
            <DocumentTrialWatermarkFooter />
        </div>
    );
};

// --- تم ۳: رسمی و مالیاتی دارایی برگه سفید (Official Tax Paper) ---
const OfficialCleanTheme = ({ data, docCompany, qrCode, barcodeUrl, trackingCode, prevBalance, currentBalance, thisInvoicePaid, invoiceNumDisplay, currency, currencyLabel, showPreviousBalance = true }: any) => {
    return (
        <div className="invoice-paper sheet-a4-white bg-white min-h-[297mm] h-auto flex flex-col font-sans text-slate-900 p-8 md:p-12 overflow-visible border-2 border-slate-800" dir="rtl" style={{ direction: 'rtl', letterSpacing: 'normal' }}>
            <div className="border-2 border-slate-800 p-4 mb-4 bg-white" dir="rtl">
                <div className="flex justify-between items-center" dir="rtl">
                    <div className="w-24 text-center">
                        {docCompany?.logo && <img src={docCompany.logo} className="w-16 h-16 object-contain mx-auto" alt="لوگو" />}
                    </div>
                    <div className="text-center flex-1">
                        <h1 className="text-xl font-black text-slate-950" style={{ letterSpacing: 'normal' }}>{docCompany?.name || 'فروشنده'}</h1>
                        <p className="text-sm font-black text-slate-800 mt-1">صورتحساب فروش کالا و خدمات ({data.type})</p>
                    </div>
                    <div className="w-48 text-left text-xs space-y-1 font-bold">
                        <div>شماره فاکتور: <span className="font-mono text-sm text-slate-950 font-black">{invoiceNumDisplay}</span></div>
                        <div>تاریخ صدور: <span className="text-slate-950">{toPersianDigits(data.date)}</span></div>
                        <div>شناسه مودیان: <span className="font-mono text-[10px] text-slate-950">{data.taxId || '---'}</span></div>
                    </div>
                </div>
            </div>

            <div className="border-2 border-slate-800 border-b-0 p-3 bg-slate-50 text-xs" dir="rtl">
                <div className="grid grid-cols-2 gap-4 text-right" dir="rtl">
                    <div>
                        <span className="font-black text-slate-950 block mb-1">مشخصات فروشنده ({docCompany?.branchName ? `شعبه ${docCompany.branchName}` : 'مرکزی'}):</span>
                        <div>نام شخص حقیقی/حقوقی: <span className="font-bold">{docCompany?.fullTitle || docCompany?.name}</span></div>
                        {docCompany?.economicCode && <div>کد اقتصادی: <span className="font-mono font-bold">{toPersianDigits(docCompany.economicCode)}</span></div>}
                        {docCompany?.nationalId && <div>شناسه ملی: <span className="font-mono font-bold">{toPersianDigits(docCompany.nationalId)}</span></div>}
                        {docCompany?.postalCode && <div>کد پستی: <span className="font-mono font-bold">{toPersianDigits(docCompany.postalCode)}</span></div>}
                        <div>نشانی: <span>{docCompany?.address || 'تهران'}</span> | تلفن: <span className="font-bold">{toPersianDigits(docCompany?.phone || '')}</span></div>
                    </div>
                    <div>
                        <span className="font-black text-slate-950 block mb-1">مشخصات خریدار:</span>
                        <div>نام شخص حقیقی/حقوقی: <span className="font-bold">{data.personName}</span></div>
                        <div>کد شناسایی: <span className="font-mono font-bold">{toPersianDigits(data.personId?.substring(0, 8) || '---')}</span></div>
                    </div>
                </div>
            </div>

            <div className="border-2 border-slate-800 overflow-hidden mb-4 bg-white" dir="rtl">
                <table className="w-full text-right text-xs" dir="rtl" style={{ direction: 'rtl', width: '100%', borderCollapse: 'collapse' }}>
                    <thead className="bg-slate-200 text-slate-950 font-black border-b-2 border-slate-800" style={{ direction: 'rtl' }}>
                        <tr style={{ direction: 'rtl' }}>
                            <th className="p-2.5 text-center w-10 border-l border-slate-800" style={{ textAlign: 'center' }}>ردیف</th>
                            <th className="p-2.5 border-l border-slate-800 text-right" style={{ textAlign: 'right' }}>شرح کالا یا خدمات</th>
                            <th className="p-2.5 text-center w-16 border-l border-slate-800" style={{ textAlign: 'center' }}>تعداد</th>
                            <th className="p-2.5 text-left w-32 border-l border-slate-800" style={{ textAlign: 'left' }}>مبلغ واحد ({currencyLabel})</th>
                            <th className="p-2.5 text-left w-36" style={{ textAlign: 'left' }}>مبلغ کل ({currencyLabel})</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300 text-slate-900 bg-white" style={{ direction: 'rtl' }}>
                        {data.items.map((item: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-50" style={{ direction: 'rtl' }}>
                                <td className="p-2 text-center font-bold border-l border-slate-300" style={{ textAlign: 'center' }}>{toPersianDigits(i + 1)}</td>
                                <td className="p-2 font-bold border-l border-slate-300 text-right" style={{ textAlign: 'right', letterSpacing: 'normal' }}>{item.productName}</td>
                                <td className="p-2 text-center font-bold border-l border-slate-300" style={{ textAlign: 'center' }}>{toPersianDigits(item.quantity)}</td>
                                <td className="p-2 text-left font-mono font-semibold border-l border-slate-300" style={{ textAlign: 'left' }}>{formatAmountOnly(item.unitPrice, currency)}</td>
                                <td className="p-2 text-left font-mono font-black text-slate-950" style={{ textAlign: 'left' }}>{formatAmountOnly(item.total, currency)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="border-2 border-slate-800 p-4 mb-4 text-xs bg-white" dir="rtl">
                <div className="grid grid-cols-2 gap-6 text-right" dir="rtl">
                    <div className="space-y-1.5">
                        <div className="font-black text-slate-900 mb-1">{showPreviousBalance ? 'نحوه تسویه و وضعیت حساب:' : 'نحوه تسویه این فاکتور:'}</div>
                        {showPreviousBalance ? (
                            <>
                                <div className="flex justify-between"><span>مانده قبلی مشتری:</span><span className="font-mono font-bold">{formatCurrency(prevBalance, currency)}</span></div>
                                <div className="flex justify-between"><span>پرداخت نقدی/چک:</span><span className="font-mono font-bold text-emerald-700">{formatCurrency(thisInvoicePaid, currency)}</span></div>
                                <div className="flex justify-between border-t border-slate-300 pt-1 font-black"><span>مانده نهایی حساب:</span><span className="font-mono text-blue-900">{formatCurrency(currentBalance, currency)}</span></div>
                            </>
                        ) : (
                            <>
                                <div className="flex justify-between"><span>پرداخت این فاکتور:</span><span className="font-mono font-bold text-emerald-700">{formatCurrency(thisInvoicePaid, currency)}</span></div>
                                <div className="flex justify-between border-t border-slate-300 pt-1 font-black"><span>مانده تسویه فاکتور:</span><span className="font-mono text-blue-900">{formatCurrency(Math.max(0, data.finalTotal - thisInvoicePaid), currency)}</span></div>
                            </>
                        )}
                        {data.description && (
                            <div className="pt-2 border-t border-slate-200 text-[9.5px] text-slate-600 font-normal leading-4 text-right">
                                <span className="font-bold text-slate-800 text-[10px]">توضیحات و شرایط: </span>{data.description}
                            </div>
                        )}
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex justify-between"><span>جمع کل صورتحساب:</span><span className="font-mono font-bold">{formatAmountOnly(data.subTotal, currency)} {currencyLabel}</span></div>
                        {(data.discount || 0) > 0 && <div className="flex justify-between text-rose-700"><span>تخفیف:</span><span className="font-mono font-bold">-{formatAmountOnly(data.discount, currency)} {currencyLabel}</span></div>}
                        {(data.tax || 0) > 0 && <div className="flex justify-between"><span>مالیات و عوارض:</span><span className="font-mono font-bold">+{formatAmountOnly(data.tax, currency)} {currencyLabel}</span></div>}
                        <div className="flex justify-between border-t-2 border-slate-800 pt-2 font-black text-sm"><span>مبلغ قابل پرداخت:</span><span className="font-mono text-base">{formatCurrency(data.finalTotal, currency)}</span></div>
                    </div>
                </div>
            </div>

            <div className="mt-auto grid grid-cols-2 gap-4 border-2 border-slate-800 p-4 text-center bg-white" dir="rtl">
                <div className="h-28 flex flex-col justify-between border-l border-slate-400 pl-4">
                    <span className="text-xs font-black text-slate-800">مهر و امضای صادرکننده (فروشنده {docCompany?.branchName ? ` - شعبه ${docCompany.branchName}` : ''})</span>
                    <div className="h-16 flex items-center justify-center gap-2">
                        {docCompany?.stamp && <img src={docCompany.stamp} className="max-h-full max-w-[48%] object-contain" alt="مهر" />}
                        {docCompany?.signature && <img src={docCompany.signature} className="max-h-full max-w-[48%] object-contain" alt="امضا" />}
                    </div>
                </div>
                <div className="h-28 flex flex-col justify-between">
                    <span className="text-xs font-black text-slate-800">مهر و امضای تحویل‌گیرنده (خریدار)</span>
                    <div className="h-16 flex items-center justify-center">
                        {data.signature && <img src={data.signature} className="max-h-full max-w-full object-contain" alt="امضا" />}
                    </div>
                </div>
            </div>
            <DocumentTrialWatermarkFooter />
        </div>
    );
};

// --- تم ۴: صنعتی برگه سفید دقیق (Industrial Clean Paper) ---
const IndustrialCrispTheme = ({ data, docCompany, qrCode, barcodeUrl, trackingCode, prevBalance, currentBalance, thisInvoicePaid, invoiceNumDisplay, currency, currencyLabel, showPreviousBalance = true }: any) => {
    return (
        <div className="invoice-paper sheet-a4-white bg-white min-h-[297mm] h-auto flex flex-col font-sans text-slate-950 p-8 md:p-12 overflow-visible border-4 border-slate-950" dir="rtl" style={{ direction: 'rtl', letterSpacing: 'normal' }}>
            <div className="border-4 border-slate-950 p-5 mb-5 flex justify-between items-center bg-slate-100" dir="rtl">
                <div className="text-right">
                    <h1 className="text-2xl font-black text-slate-950" style={{ letterSpacing: 'normal' }}>{docCompany?.name}</h1>
                    <p className="text-xs font-bold text-slate-700 mt-0.5">{docCompany?.address} | تلفن: {toPersianDigits(docCompany?.phone || '')}</p>
                </div>
                <div className="text-left">
                    <div className="bg-slate-950 text-white px-4 py-1.5 font-black text-base">فاکتور {data.type}</div>
                    <div className="text-xs font-mono font-black mt-1">NO: {invoiceNumDisplay}</div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-5 text-xs text-right" dir="rtl">
                <div className="border-2 border-slate-400 p-3 bg-white">
                    <span className="text-slate-500 font-bold block mb-0.5">طرف حساب:</span>
                    <span className="font-black text-slate-950 text-sm block" style={{ letterSpacing: 'normal' }}>{data.personName}</span>
                </div>
                <div className="border-2 border-slate-400 p-3 bg-white">
                    <span className="text-slate-500 font-bold block mb-0.5">تاریخ سند:</span>
                    <span className="font-mono font-black text-slate-950 text-sm block">{toPersianDigits(data.date)}</span>
                </div>
                <div className="border-2 border-slate-400 p-3 bg-white flex items-center justify-between">
                    <div className="text-right">
                        <span className="text-slate-500 font-bold block mb-0.5">کد رهگیری:</span>
                        <span className="font-mono font-bold text-[10px] block">{trackingCode}</span>
                    </div>
                    {qrCode && <img src={qrCode} className="w-10 h-10" alt="QR" />}
                </div>
            </div>

            <table className="w-full border-2 border-slate-950 mb-5 text-xs bg-white text-right" dir="rtl" style={{ direction: 'rtl', width: '100%', borderCollapse: 'collapse' }}>
                <thead className="bg-slate-950 text-white font-black" style={{ direction: 'rtl' }}>
                    <tr style={{ direction: 'rtl' }}>
                        <th className="p-3 text-center w-10" style={{ textAlign: 'center' }}>#</th>
                        <th className="p-3 text-right" style={{ textAlign: 'right' }}>شرح کالای ارسالی / خدمات صنعتی</th>
                        <th className="p-3 text-center w-20" style={{ textAlign: 'center' }}>مقدار</th>
                        <th className="p-3 text-left w-32" style={{ textAlign: 'left' }}>بهای واحد ({currencyLabel})</th>
                        <th className="p-3 text-left w-36" style={{ textAlign: 'left' }}>بهای کل ({currencyLabel})</th>
                    </tr>
                </thead>
                <tbody className="divide-y border-slate-300 bg-white" style={{ direction: 'rtl' }}>
                    {data.items.map((item: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-100" style={{ direction: 'rtl' }}>
                            <td className="p-2.5 text-center font-bold" style={{ textAlign: 'center' }}>{toPersianDigits(i + 1)}</td>
                            <td className="p-2.5 font-bold text-right" style={{ textAlign: 'right', letterSpacing: 'normal' }}>{item.productName}</td>
                            <td className="p-2.5 text-center font-mono font-black" style={{ textAlign: 'center' }}>{toPersianDigits(item.quantity)}</td>
                            <td className="p-2.5 text-left font-mono font-bold" style={{ textAlign: 'left' }}>{formatAmountOnly(item.unitPrice, currency)}</td>
                            <td className="p-2.5 text-left font-mono font-black" style={{ textAlign: 'left' }}>{formatAmountOnly(item.total, currency)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="grid grid-cols-2 gap-4 mb-6 text-xs text-right" dir="rtl">
                <div className="border-2 border-slate-400 p-3 space-y-1 bg-white">
                    <span className="font-black text-slate-950 block mb-1">{showPreviousBalance ? 'صورت حساب مشتری:' : 'تسویه فاکتور فعلی:'}</span>
                    {showPreviousBalance ? (
                        <>
                            <div className="flex justify-between"><span>بدهی پیشین:</span><span className="font-mono font-bold">{formatCurrency(prevBalance, currency)}</span></div>
                            <div className="flex justify-between"><span>دریافتی نقد/چک:</span><span className="font-mono font-bold text-emerald-800">{formatCurrency(thisInvoicePaid, currency)}</span></div>
                            <div className="flex justify-between border-t border-slate-300 pt-1 font-black"><span>مانده نهایی:</span><span className="font-mono text-blue-900">{formatCurrency(currentBalance, currency)}</span></div>
                        </>
                    ) : (
                        <>
                            <div className="flex justify-between"><span>پرداخت این فاکتور:</span><span className="font-mono font-bold text-emerald-800">{formatCurrency(thisInvoicePaid, currency)}</span></div>
                            <div className="flex justify-between border-t border-slate-300 pt-1 font-black"><span>مانده تسویه فاکتور:</span><span className="font-mono text-blue-900">{formatCurrency(Math.max(0, data.finalTotal - thisInvoicePaid), currency)}</span></div>
                        </>
                    )}
                    {data.description && (
                        <div className="pt-2 border-t border-slate-200 text-[9.5px] text-slate-600 font-normal leading-4 text-right">
                            <span className="font-bold text-slate-800 text-[10px]">توضیحات و مشخصات فنی: </span>{data.description}
                        </div>
                    )}
                </div>
                <div className="border-4 border-slate-950 p-3 space-y-1.5 bg-slate-50">
                    <div className="flex justify-between font-bold"><span>جمع کل:</span><span className="font-mono">{formatAmountOnly(data.subTotal, currency)} {currencyLabel}</span></div>
                    {(data.discount || 0) > 0 && <div className="flex justify-between font-bold text-rose-700"><span>تخفیف:</span><span className="font-mono">-{formatAmountOnly(data.discount, currency)} {currencyLabel}</span></div>}
                    <div className="border-t-2 border-slate-950 pt-1.5 flex justify-between items-center font-black">
                        <span className="text-sm">مبلغ نهایی:</span>
                        <span className="font-mono text-xl">{formatCurrency(data.finalTotal, currency)}</span>
                    </div>
                </div>
            </div>

            <div className="mt-auto grid grid-cols-2 gap-4 border-2 border-slate-950 p-4 text-center bg-white" dir="rtl">
                <div className="h-24 flex flex-col justify-between">
                    <span className="text-xs font-black">امضا و مهر انبار / فروشنده {docCompany?.branchName ? `(${docCompany.branchName})` : ''}</span>
                    <div className="h-14 flex items-center justify-center gap-2">
                        {docCompany?.stamp && <img src={docCompany.stamp} className="max-h-full max-w-[48%] object-contain" alt="مهر" />}
                        {docCompany?.signature && <img src={docCompany.signature} className="max-h-full max-w-[48%] object-contain" alt="امضا" />}
                    </div>
                </div>
                <div className="h-24 flex flex-col justify-between">
                    <span className="text-xs font-black">امضا و تایید تحویل‌گیرنده</span>
                    <div className="h-14 flex items-center justify-center">
                        {data.signature && <img src={data.signature} className="max-h-full max-w-full object-contain" alt="امضا" />}
                    </div>
                </div>
            </div>
            <DocumentTrialWatermarkFooter />
        </div>
    );
};

// --- تم ۵: مینیمال اقتصادی برگه سفید (Minimalist White Paper) ---
const MinimalLightTheme = ({ data, docCompany, qrCode, barcodeUrl, trackingCode, prevBalance, currentBalance, thisInvoicePaid, invoiceNumDisplay, currency, currencyLabel, showPreviousBalance = true }: any) => {
    return (
        <div className="invoice-paper sheet-a4-white bg-white min-h-[297mm] h-auto flex flex-col font-sans text-slate-950 p-10 md:p-14 overflow-visible border" dir="rtl" style={{ direction: 'rtl', letterSpacing: 'normal' }}>
            <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-end" dir="rtl">
                <div className="text-right">
                    <h1 className="text-3xl font-black" style={{ letterSpacing: 'normal' }}>{docCompany?.name}</h1>
                    <p className="text-xs text-slate-700 mt-1">{docCompany?.address} | {toPersianDigits(docCompany?.phone || '')}</p>
                </div>
                <div className="text-left text-xs font-bold space-y-0.5">
                    <div>شماره: #{invoiceNumDisplay}</div>
                    <div>تاریخ: {toPersianDigits(data.date)}</div>
                </div>
            </div>

            <div className="mb-6 text-right" dir="rtl">
                <span className="text-xs text-slate-500 block mb-0.5">صورتحساب خریدار:</span>
                <span className="text-xl font-black" style={{ letterSpacing: 'normal' }}>{data.personName}</span>
            </div>

            <table className="w-full text-right text-xs mb-6 bg-white" dir="rtl" style={{ direction: 'rtl', width: '100%', borderCollapse: 'collapse' }}>
                <thead className="border-b-2 border-black" style={{ direction: 'rtl' }}>
                    <tr style={{ direction: 'rtl' }}>
                        <th className="py-2.5 text-center w-10" style={{ textAlign: 'center' }}>#</th>
                        <th className="py-2.5 text-right" style={{ textAlign: 'right' }}>شرح</th>
                        <th className="py-2.5 text-center w-16" style={{ textAlign: 'center' }}>تعداد</th>
                        <th className="py-2.5 text-left w-32" style={{ textAlign: 'left' }}>قیمت واحد ({currencyLabel})</th>
                        <th className="py-2.5 text-left w-36" style={{ textAlign: 'left' }}>مجموع ({currencyLabel})</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white" style={{ direction: 'rtl' }}>
                    {data.items.map((item: any, i: number) => (
                        <tr key={i} style={{ direction: 'rtl' }}>
                            <td className="py-2.5 text-center" style={{ textAlign: 'center' }}>{toPersianDigits(i + 1)}</td>
                            <td className="py-2.5 font-bold text-right" style={{ textAlign: 'right', letterSpacing: 'normal' }}>{item.productName}</td>
                            <td className="py-2.5 text-center" style={{ textAlign: 'center' }}>{toPersianDigits(item.quantity)}</td>
                            <td className="py-2.5 text-left font-mono" style={{ textAlign: 'left' }}>{formatAmountOnly(item.unitPrice, currency)}</td>
                            <td className="py-2.5 text-left font-mono font-black" style={{ textAlign: 'left' }}>{formatAmountOnly(item.total, currency)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="flex justify-end mb-6" dir="rtl">
                <div className="w-72 space-y-1.5 text-xs text-right" dir="rtl">
                    <div className="flex justify-between"><span>جمع کل:</span><span>{formatAmountOnly(data.subTotal, currency)} {currencyLabel}</span></div>
                    {(data.discount || 0) > 0 && <div className="flex justify-between text-rose-700"><span>تخفیف:</span><span>-{formatAmountOnly(data.discount, currency)} {currencyLabel}</span></div>}
                    <div className="flex justify-between border-t-2 border-black pt-2 font-black text-sm">
                        <span>مبلغ نهایی:</span>
                        <span>{formatCurrency(data.finalTotal, currency)}</span>
                    </div>
                </div>
            </div>

            <div className="border border-black p-3 mb-6 text-xs bg-white" dir="rtl">
                <div className="flex justify-between items-center">
                    {showPreviousBalance ? (
                        <>
                            <div>مانده قبلی: <b>{formatCurrency(prevBalance, currency)}</b></div>
                            <div>پرداختی: <b>{formatCurrency(thisInvoicePaid, currency)}</b></div>
                            <div>مانده کل: <b className="text-sm">{formatCurrency(currentBalance, currency)}</b></div>
                        </>
                    ) : (
                        <>
                            <div>پرداختی این فاکتور: <b>{formatCurrency(thisInvoicePaid, currency)}</b></div>
                            <div>مانده تسویه فاکتور: <b className="text-sm">{formatCurrency(Math.max(0, data.finalTotal - thisInvoicePaid), currency)}</b></div>
                        </>
                    )}
                </div>
                {data.description && (
                    <div className="pt-2 mt-2 border-t border-slate-300 text-[9.5px] text-slate-600 font-normal leading-4 text-right">
                        <b>توضیحات و پانویس: </b>{data.description}
                    </div>
                )}
            </div>

            <div className="mt-auto grid grid-cols-2 gap-6 pt-4 border-t border-black text-center text-xs bg-white" dir="rtl">
                <div>مهر و امضای فروشنده</div>
                <div>امضای خریدار</div>
            </div>
            <DocumentTrialWatermarkFooter />
        </div>
    );
};

// --- تم ۶: مدیریتی زرین برگه روشن (Executive Light Gold Paper) ---
const ExecutiveIvoryTheme = ({ data, docCompany, qrCode, barcodeUrl, trackingCode, prevBalance, currentBalance, thisInvoicePaid, invoiceNumDisplay, currency, currencyLabel, showPreviousBalance = true }: any) => {
    return (
        <div className="invoice-paper sheet-a4-white bg-white min-h-[297mm] h-auto flex flex-col font-sans text-slate-900 p-8 md:p-12 overflow-visible border-4 border-amber-200" dir="rtl" style={{ direction: 'rtl', letterSpacing: 'normal' }}>
            <div className="border-b-2 border-[#d4af37] pb-6 mb-6 flex justify-between items-start" dir="rtl">
                <div className="flex items-center gap-4 text-right" dir="rtl">
                    <div className="w-16 h-16 rounded-2xl bg-amber-50 border-2 border-[#d4af37] flex items-center justify-center p-2 text-amber-800 shrink-0">
                        {docCompany?.logo ? <img src={docCompany.logo} className="w-full h-full object-contain" alt="لوگو" /> : <Hexagon size={32} />}
                    </div>
                    <div className="text-right">
                        <h1 className="text-2xl font-black text-slate-950" style={{ letterSpacing: 'normal' }}>{docCompany?.name}</h1>
                        <p className="text-xs text-slate-600 mt-1">{docCompany?.address} | تلفن: {toPersianDigits(docCompany?.phone || '')}</p>
                    </div>
                </div>
                <div className="text-left">
                    <div className="bg-[#b38728] text-white px-5 py-2 rounded-xl text-base font-black shadow mb-1.5">فاکتور {data.type}</div>
                    <div className="text-xs font-mono font-black text-slate-800">شماره: {invoiceNumDisplay}</div>
                    <div className="text-xs text-slate-600">تاریخ: {toPersianDigits(data.date)}</div>
                </div>
            </div>

            <div className="bg-amber-50/30 border border-amber-200 rounded-2xl p-4 mb-6 shadow-xs text-right" dir="rtl">
                <span className="text-[10px] font-black text-[#b38728] uppercase tracking-wider block mb-1">طرف حساب محترم</span>
                <div className="text-lg font-black text-slate-950" style={{ letterSpacing: 'normal' }}>{data.personName}</div>
            </div>

            <div className="border border-amber-200 rounded-2xl overflow-hidden mb-6 bg-white shadow-xs" dir="rtl">
                <table className="w-full text-right text-xs" dir="rtl" style={{ direction: 'rtl', width: '100%', borderCollapse: 'collapse' }}>
                    <thead className="bg-amber-50 text-slate-900 font-black border-b border-amber-200" style={{ direction: 'rtl' }}>
                        <tr style={{ direction: 'rtl' }}>
                            <th className="p-3 text-center w-10" style={{ textAlign: 'center' }}>#</th>
                            <th className="p-3 text-right" style={{ textAlign: 'right' }}>شرح کالا و خدمات</th>
                            <th className="p-3 text-center w-16" style={{ textAlign: 'center' }}>تعداد</th>
                            <th className="p-3 text-left w-32" style={{ textAlign: 'left' }}>قیمت واحد ({currencyLabel})</th>
                            <th className="p-3 text-left w-36" style={{ textAlign: 'left' }}>جمع کل ({currencyLabel})</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-900 bg-white" style={{ direction: 'rtl' }}>
                        {data.items.map((item: any, i: number) => (
                            <tr key={i} className="hover:bg-amber-50/20" style={{ direction: 'rtl' }}>
                                <td className="p-3 text-center font-bold text-amber-800" style={{ textAlign: 'center' }}>{toPersianDigits(i + 1)}</td>
                                <td className="p-3 font-bold text-right" style={{ textAlign: 'right', letterSpacing: 'normal' }}>{item.productName}</td>
                                <td className="p-3 text-center font-black" style={{ textAlign: 'center' }}>{toPersianDigits(item.quantity)}</td>
                                <td className="p-3 text-left font-mono" style={{ textAlign: 'left' }}>{formatAmountOnly(item.unitPrice, currency)}</td>
                                <td className="p-3 text-left font-mono font-black" style={{ textAlign: 'left' }}>{formatAmountOnly(item.total, currency)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="grid grid-cols-12 gap-6 mb-6" dir="rtl">
                <div className="col-span-7 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-right" dir="rtl">
                    <span className="font-black text-slate-900 block mb-2">{showPreviousBalance ? 'گزارش مانده حساب و گردش مالی:' : 'وضعیت تسویه این فاکتور:'}</span>
                    {showPreviousBalance ? (
                        <div className="grid grid-cols-3 gap-2 text-center" dir="rtl">
                            <div className="bg-white p-2 rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-500 block">مانده قبلی</span>
                                <span className="font-mono font-bold text-xs">{formatCurrency(prevBalance, currency)}</span>
                            </div>
                            <div className="bg-white p-2 rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-500 block">پرداختی</span>
                                <span className="font-mono font-bold text-emerald-800 text-xs">{formatCurrency(thisInvoicePaid, currency)}</span>
                            </div>
                            <div className="bg-white p-2 rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-500 block">مانده نهایی</span>
                                <span className="font-mono font-black text-[#b38728] text-xs">{formatCurrency(currentBalance, currency)}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2 text-center" dir="rtl">
                            <div className="bg-white p-2 rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-500 block">پرداخت این فاکتور</span>
                                <span className="font-mono font-bold text-emerald-800 text-xs">{formatCurrency(thisInvoicePaid, currency)}</span>
                            </div>
                            <div className="bg-white p-2 rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-500 block">مانده تسویه فاکتور</span>
                                <span className="font-mono font-black text-[#b38728] text-xs">{formatCurrency(Math.max(0, data.finalTotal - thisInvoicePaid), currency)}</span>
                            </div>
                        </div>
                    )}
                    {data.description && (
                        <div className="mt-3 pt-2 border-t border-slate-200 text-[9.5px] text-slate-600 font-normal leading-4 text-right">
                            <span className="font-bold text-slate-800 text-[10px]">توضیحات و شرایط: </span>{data.description}
                        </div>
                    )}
                </div>
                <div className="col-span-5 bg-white border-2 border-[#d4af37] rounded-2xl p-4 text-xs space-y-1.5 text-right" dir="rtl">
                    <div className="flex justify-between"><span>جمع اقلام:</span><span className="font-mono font-bold">{formatAmountOnly(data.subTotal, currency)} {currencyLabel}</span></div>
                    {(data.discount || 0) > 0 && <div className="flex justify-between text-rose-700"><span>تخفیف:</span><span className="font-mono font-bold">-{formatAmountOnly(data.discount, currency)} {currencyLabel}</span></div>}
                    <div className="border-t border-[#d4af37] pt-2 flex justify-between items-center font-black">
                        <span className="text-slate-950 text-sm">مبلغ قابل پرداخت:</span>
                        <span className="font-mono text-xl text-[#b38728]">{formatCurrency(data.finalTotal, currency)}</span>
                    </div>
                </div>
            </div>

            <div className="mt-auto grid grid-cols-3 gap-6 pt-4 border-t border-[#d4af37] text-center bg-white" dir="rtl">
                <div className="border border-slate-200 rounded-xl p-3 bg-white min-h-[90px] flex flex-col justify-between">
                    <div className="h-14 flex items-center justify-center gap-2">
                        {docCompany?.stamp && <img src={docCompany.stamp} className="max-h-full max-w-[48%] object-contain" alt="مهر" />}
                        {docCompany?.signature && <img src={docCompany.signature} className="max-h-full max-w-[48%] object-contain" alt="امضا" />}
                    </div>
                    <span className="text-[10px] font-black text-slate-700">مهر و امضای فروشنده {docCompany?.branchName ? `(${docCompany.branchName})` : ''}</span>
                </div>
                <div className="border border-slate-200 rounded-xl p-3 bg-white min-h-[90px] flex items-center justify-center gap-3">
                    <img src={generateLocalQrSvg(`INV:${data.id}:${data.finalTotal}`)} alt="PayQR" className="w-12 h-12" />
                    <div className="text-right text-[10px]">
                        <span className="font-black text-slate-900 block">پرداخت سریع</span>
                        <span className="text-slate-500">اسکن با موبایل بانک</span>
                    </div>
                </div>
                <div className="border border-slate-200 rounded-xl p-3 bg-white min-h-[90px] flex flex-col justify-between">
                    <div className="h-14 flex items-center justify-center">
                        {data.signature && <img src={data.signature} className="max-h-full max-w-full object-contain" alt="امضا" />}
                    </div>
                    <span className="text-[10px] font-black text-slate-700">امضای خریدار</span>
                </div>
            </div>
            <DocumentTrialWatermarkFooter />
        </div>
    );
};

// --- تم اصیل ایرانی: نقوش اسلیمی، تذهیب مینیاتوری، شمسه و کادربندی اسلامی (Persian Heritage Theme) ---
const PersianHeritageTheme = ({
    data,
    docCompany,
    qrCode,
    barcodeUrl,
    trackingCode,
    prevBalance,
    currentBalance,
    thisInvoicePaid,
    invoiceNumDisplay,
    currency,
    currencyLabel,
    showPreviousBalance = true
}: any) => {
    const [showHelp, setShowHelp] = React.useState(false);

    return (
        <div 
            className="invoice-paper sheet-a4-white relative bg-[#fffdf9] min-h-[297mm] h-auto flex flex-col font-sans text-slate-900 p-6 md:p-8 overflow-hidden border-[5px] border-[#b8860b] shadow-2xl"
            dir="rtl"
            style={{ direction: 'rtl', letterSpacing: 'normal' }}
        >
            {/* لچک‌های تذهیب زرین و سرمه‌ای در ۴ گوشه برگه */}
            <div className="absolute top-0 right-0 pointer-events-none z-0 opacity-80">
                <IslimiCornerSvg position="top-right" size={72} />
            </div>
            <div className="absolute top-0 left-0 pointer-events-none z-0 opacity-80">
                <IslimiCornerSvg position="top-left" size={72} />
            </div>
            <div className="absolute bottom-0 right-0 pointer-events-none z-0 opacity-80">
                <IslimiCornerSvg position="bottom-right" size={72} />
            </div>
            <div className="absolute bottom-0 left-0 pointer-events-none z-0 opacity-80">
                <IslimiCornerSvg position="bottom-left" size={72} />
            </div>

            {/* خط حاشیه ظریف تذهیب داخلی */}
            <div className="absolute inset-2 pointer-events-none border border-[#c59b27]/60 rounded-sm z-0">
                <div className="absolute inset-1 border border-dashed border-[#0d9488]/30 rounded-xs" />
            </div>

            {/* دکمه راهنمای هوشمند قالب اسلامی */}
            <div className="absolute top-3 left-3 z-30 no-print">
                <button
                    type="button"
                    onClick={() => setShowHelp(!showHelp)}
                    className="w-7 h-7 rounded-full bg-[#0f172a] text-[#fef08a] hover:bg-[#1e293b] flex items-center justify-center shadow-md border border-[#c59b27] transition-transform active:scale-95"
                    title="راهنمای هوشمند نقوش اسلامی و اسلیمی"
                >
                    <HelpCircle size={15} />
                </button>
            </div>

            {/* پنجره راهنمای هوشمند */}
            {showHelp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 no-print" onClick={() => setShowHelp(false)}>
                    <div className="bg-[#fffdf9] border-2 border-[#b8860b] rounded-3xl max-w-md w-full p-6 text-slate-900 shadow-2xl relative text-right" dir="rtl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-[#e2d7be] pb-3 mb-4">
                            <div className="flex items-center gap-2">
                                <span className="text-[#b8860b] text-lg">❖</span>
                                <h3 className="font-black text-sm text-[#0f172a]">راهنمای هوشمند نقوش اسلیمی و تذهیب</h3>
                            </div>
                            <button onClick={() => setShowHelp(false)} className="text-slate-400 hover:text-slate-700 font-black text-sm">✕</button>
                        </div>
                        <div className="space-y-3 text-xs leading-relaxed text-slate-700">
                            <p className="flex items-start gap-2">
                                <span className="text-[#0d9488] font-bold">۱.</span>
                                <span><strong>جدول‌کشی و تذهیب سنتی:</strong> حاشیه‌ها و کادرها با رنگ‌های نفیس زرین، لاجوردی عمیق و فیروزه‌ای اصیل بدون هرگونه تداخل با متون تنظیم شده‌اند.</span>
                            </p>
                            <p className="flex items-start gap-2">
                                <span className="text-[#0d9488] font-bold">۲.</span>
                                <span><strong>چیدمان کاملاً متقارن و پایدار:</strong> کادرهای طرفین فاکتور و محاسبات مالی با نسبت ۵۰٪ متقارن و بدون به‌هم‌ریختگی در چاپ و پی‌دی‌اف قرار گرفته‌اند.</span>
                            </p>
                            <p className="flex items-start gap-2">
                                <span className="text-[#0d9488] font-bold">۳.</span>
                                <span><strong>شمسه تذهیب و نشان هشت‌پر:</strong> واترمرک محو مرکزی و نشان اصالت با خطوط دقیق و کیوآرکد استعلام رسمی.</span>
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowHelp(false)}
                            className="mt-5 w-full py-2.5 bg-[#0f172a] text-[#fef08a] hover:bg-[#1e293b] rounded-xl font-black text-xs transition-all shadow-md"
                        >
                            متوجه شدم
                        </button>
                    </div>
                </div>
            )}

            {/* واترمارک محو شمسه کانوا در پس‌زمینه برگه */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-90 z-0">
                <PersianWatermarkCanvas opacity={0.032} size={540} />
            </div>

            <div className="relative z-10 flex flex-col flex-1">
                {/* سربرگ کتیبه‌ای سلطنتی با نقوش اسلیمی و رنگ لاجوردی و زرین */}
                <PersianHeaderBanner
                    title={docCompany?.name || 'مجموعه تجاری و صنعتی اشک قلم'}
                    subtitle="صورتحساب رسمی فروش کالا و خدمات • نظام جامع هوشمند"
                    code={invoiceNumDisplay}
                    date={toPersianDigits(data.date)}
                    typeBadge="طرح اصیل ایرانی"
                />

                {/* بخش اطلاعات طرفین فاکتور در دو کادر تذهیب متقارن */}
                <div className="w-full flex flex-row gap-3.5 mb-3.5">
                    {/* مشخصات فروشنده */}
                    <div className="w-1/2">
                        <PersianCard 
                            title="مشخصات فروشنده (ارائه‌دهنده)" 
                            icon={<Building2 size={15} />}
                            badge="صادرکننده"
                        >
                            <div className="space-y-1.5 text-xs text-slate-800">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">نام شخص / شرکت:</span>
                                    <span className="font-bold text-[#0f172a]">{docCompany?.name || 'اشک قلم'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">شناسه ملی / کد اقتصادی:</span>
                                    <span className="font-mono font-bold text-slate-700">{docCompany?.economicCode || docCompany?.nationalId || '---'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">شماره تماس:</span>
                                    <span className="font-mono font-bold text-slate-700">{toPersianDigits(docCompany?.phone || '---')}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">نشانی ثبتی:</span>
                                    <span className="font-medium text-slate-700 truncate max-w-[210px]">{docCompany?.address || 'تهران'}</span>
                                </div>
                            </div>
                        </PersianCard>
                    </div>

                    {/* مشخصات خریدار */}
                    <div className="w-1/2">
                        <PersianCard 
                            title="مشخصات خریدار (دریافت‌کننده)" 
                            icon={<UserCheck size={15} />}
                            badge="مشتری گرامی"
                        >
                            <div className="space-y-1.5 text-xs text-slate-800">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">نام کامل مشتری:</span>
                                    <span className="font-bold text-[#0f172a]">{data.personName || 'مشتری آزاد'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">شماره همراه / تلفن:</span>
                                    <span className="font-mono font-bold text-slate-700">{toPersianDigits(data.personPhone || '---')}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">کد ملی / شناسه:</span>
                                    <span className="font-mono font-bold text-slate-700">{toPersianDigits(data.personNationalCode || '---')}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">آدرس تحویل:</span>
                                    <span className="font-medium text-slate-700 truncate max-w-[210px]">{data.personAddress || '---'}</span>
                                </div>
                            </div>
                        </PersianCard>
                    </div>
                </div>

                {/* جدول اقلام فاکتور با جدول‌کشی زرین و لاجوردی */}
                <div className="mb-3.5 overflow-hidden rounded-xl border-2 border-[#b8860b] shadow-2xs bg-white">
                    <table className="w-full text-right border-collapse text-xs table-auto">
                        <thead>
                            <tr className="bg-[#0f172a] text-[#faf8f2] border-b-2 border-[#b8860b]">
                                <th className="py-2 px-3 text-center font-black w-12">ردیف</th>
                                <th className="py-2 px-3 font-black">شرح کالا یا خدمات</th>
                                <th className="py-2 px-2 text-center font-black w-20">تعداد</th>
                                <th className="py-2 px-2 text-center font-black w-16">واحد</th>
                                <th className="py-2 px-3 text-left font-black w-32">بهای واحد</th>
                                {(data.totalDiscount || 0) > 0 && <th className="py-2 px-2 text-left font-black w-24">تخفیف</th>}
                                {(data.tax || 0) > 0 && <th className="py-2 px-2 text-left font-black w-24">مالیات/عوارض</th>}
                                <th className="py-2 px-3 text-left font-black w-36 bg-[#080d16] text-[#fef08a]">مبلغ نهایی ({currencyLabel})</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.items?.map((item: any, idx: number) => {
                                const isEven = idx % 2 === 0;
                                return (
                                    <tr 
                                        key={item.id || idx} 
                                        className={`border-b border-[#e2d7be]/60 transition-colors ${
                                            isEven ? 'bg-[#fffdfa]' : 'bg-[#fcf8ee]/60'
                                        }`}
                                    >
                                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-600">{toPersianDigits(idx + 1)}</td>
                                        <td className="py-2 px-3 font-bold text-slate-900">
                                            <span>{item.productName || item.title || 'کالای ثبت شده'}</span>
                                            {item.description && (
                                                <span className="block text-[10px] text-slate-500 font-normal mt-0.5">{item.description}</span>
                                            )}
                                        </td>
                                        <td className="py-2 px-2 text-center font-mono font-black text-slate-800">{toPersianDigits(item.quantity)}</td>
                                        <td className="py-2 px-2 text-center text-[11px] text-slate-600">{item.unit || 'عدد'}</td>
                                        <td className="py-2 px-3 text-left font-mono font-bold text-slate-700">{formatAmountOnly(item.unitPrice, currency)}</td>
                                        {(data.totalDiscount || 0) > 0 && (
                                             <td className="py-2 px-2 text-left font-mono text-rose-700">{item.discount ? formatAmountOnly(item.discount, currency) : '-'}</td>
                                        )}
                                        {(data.tax || 0) > 0 && (
                                            <td className="py-2 px-2 text-left font-mono text-amber-800">{item.tax ? formatAmountOnly(item.tax, currency) : '-'}</td>
                                        )}
                                        <td className="py-2 px-3 text-left font-mono font-black text-[#0f172a] bg-[#fdfaf2]">
                                            {formatAmountOnly(item.total, currency)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* بخش محاسبات مالی و وضعیت گردش حساب مشتری (چیدمان دو ستونه ۵۰٪ متقارن) */}
                <div className="w-full flex flex-row gap-3.5 mb-3.5 items-stretch">
                    {/* کارت وضعیت گردش حساب مشتری (سمت راست - ۵۰٪) */}
                    <div className="w-1/2 flex flex-col">
                        <PersianCard 
                            title={showPreviousBalance ? "وضعیت گردش حساب مشتری و تسویه" : "وضعیت تسویه این فاکتور"} 
                            icon={<Coins size={15} />}
                            badge={showPreviousBalance ? "گردش حساب" : "تسویه فاکتور"}
                            className="h-full flex flex-col justify-between"
                        >
                            {showPreviousBalance ? (
                                <div className="grid grid-cols-3 gap-2 text-center mb-2">
                                    <div className="bg-white p-2 rounded-xl border border-[#e2d7be] shadow-2xs">
                                        <span className="text-[10px] text-slate-500 block mb-0.5">مانده پیشین</span>
                                        <span className="font-mono font-bold text-xs text-slate-800">{formatCurrency(prevBalance, currency)}</span>
                                    </div>
                                    <div className="bg-[#ecfdf5] p-2 rounded-xl border border-emerald-200 shadow-2xs">
                                        <span className="text-[10px] text-emerald-700 block mb-0.5">پرداختی فاکتور</span>
                                        <span className="font-mono font-bold text-xs text-emerald-800">{formatCurrency(thisInvoicePaid, currency)}</span>
                                    </div>
                                    <div className="bg-[#fffbeb] p-2 rounded-xl border border-amber-200 shadow-2xs">
                                        <span className="text-[10px] text-amber-800 block mb-0.5">مانده نهایی</span>
                                        <span className="font-mono font-black text-xs text-[#b45309]">{formatCurrency(currentBalance, currency)}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2 text-center mb-2">
                                    <div className="bg-[#ecfdf5] p-2 rounded-xl border border-emerald-200 shadow-2xs">
                                        <span className="text-[10px] text-emerald-700 block mb-0.5">پرداختی این فاکتور</span>
                                        <span className="font-mono font-bold text-xs text-emerald-800">{formatCurrency(thisInvoicePaid, currency)}</span>
                                    </div>
                                    <div className="bg-[#fffbeb] p-2 rounded-xl border border-amber-200 shadow-2xs">
                                        <span className="text-[10px] text-amber-800 block mb-0.5">مانده تسویه فاکتور</span>
                                        <span className="font-mono font-black text-xs text-[#b45309]">{formatCurrency(Math.max(0, data.finalTotal - thisInvoicePaid), currency)}</span>
                                    </div>
                                </div>
                            )}
                            {data.description && (
                                <div className="mt-auto pt-2 text-[9.5px] text-slate-600 font-normal leading-4 bg-white/90 p-2 rounded-lg border border-[#e2d7be]">
                                    <strong className="text-[#0f172a] text-[10px]">یادداشت و شرایط فاکتور: </strong>{data.description}
                                </div>
                            )}
                        </PersianCard>
                    </div>

                    {/* کادر مبالغ کل، تخفیف، مالیات و مبلغ نهایی قابل پرداخت (سمت چپ - ۵۰٪) */}
                    <div className="w-1/2 flex flex-col">
                        <div className="relative h-full bg-gradient-to-br from-[#0f172a] to-[#080d16] border-2 border-[#b8860b] rounded-xl p-3.5 text-white shadow-md flex flex-col justify-between overflow-hidden">
                            <div className="space-y-1.5 text-xs relative z-10">
                                <div className="flex justify-between items-center text-slate-300 border-b border-white/10 pb-1.5">
                                    <span>جمع بهای اقلام:</span>
                                    <span className="font-mono font-bold text-white text-sm">{formatAmountOnly(data.subTotal, currency)} {currencyLabel}</span>
                                </div>
                                {(data.discount || 0) > 0 && (
                                    <div className="flex justify-between items-center text-rose-300 border-b border-white/10 pb-1.5">
                                        <span>مجموع تخفیف:</span>
                                        <span className="font-mono font-bold">-{formatAmountOnly(data.discount, currency)} {currencyLabel}</span>
                                    </div>
                                )}
                                {(data.tax || 0) > 0 && (
                                    <div className="flex justify-between items-center text-amber-300 border-b border-white/10 pb-1.5">
                                        <span>مالیات بر ارزش افزوده:</span>
                                        <span className="font-mono font-bold">+{formatAmountOnly(data.tax, currency)} {currencyLabel}</span>
                                    </div>
                                )}
                            </div>

                            <div className="border-t-2 border-[#b8860b] pt-2 mt-2 flex justify-between items-center relative z-10">
                                <div>
                                    <span className="text-xs text-[#fef08a] font-black block">مبلغ نهایی قابل پرداخت:</span>
                                    <span className="text-[10px] text-slate-300">به حروف و عدد</span>
                                </div>
                                <div className="text-left font-mono font-black text-xl text-[#fef08a] tracking-tight">
                                    {formatCurrency(data.finalTotal, currency)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* بخش امضاها، مهر اصالت اسلیمی و کیوآرکد تاییدیه رسمی */}
                <div className="mt-auto pt-3 border-t-2 border-[#b8860b] grid grid-cols-4 gap-3 text-center bg-white/70 p-2.5 rounded-xl">
                    {/* مهر و امضای فروشنده */}
                    <div className="border border-[#c59b27]/60 rounded-lg p-2 bg-white min-h-[90px] flex flex-col justify-between shadow-2xs">
                        <div className="h-12 flex items-center justify-center gap-1">
                            {docCompany?.stamp && (
                                <img src={docCompany.stamp} className="max-h-full max-w-[48%] object-contain" alt="مهر فروشنده" />
                            )}
                            {docCompany?.signature && (
                                <img src={docCompany.signature} className="max-h-full max-w-[48%] object-contain" alt="امضای فروشنده" />
                            )}
                        </div>
                        <span className="text-[9.5px] font-black text-[#0f172a]">مهر و امضای فروشنده {docCompany?.branchName ? `(${docCompany.branchName})` : ''}</span>
                    </div>

                    {/* نشان اصالت اسلیمی هشت‌پر */}
                    <div className="border border-[#c59b27]/60 rounded-lg p-1 bg-white flex items-center justify-center shadow-2xs">
                        <PersianHashtiSeal title="اصالت سند" subtitle="سامانه هوشمند اشک قلم" code={trackingCode} />
                    </div>

                    {/* بارکد و کیوآرکد استعلام سند */}
                    <div className="border border-[#c59b27]/60 rounded-lg p-1.5 bg-white flex flex-col items-center justify-center gap-0.5 shadow-2xs">
                        {qrCode && (
                            <img src={qrCode} alt="کد کیوآر" className="w-12 h-12 object-contain" />
                        )}
                        <span className="text-[8px] font-black text-[#0f172a]">اسکن استعلام و پرداخت</span>
                        <span className="text-[7.5px] font-mono text-slate-500 truncate max-w-[85px]">{trackingCode}</span>
                    </div>

                    {/* امضا و تایید خریدار */}
                    <div className="border border-[#c59b27]/60 rounded-lg p-2 bg-white min-h-[90px] flex flex-col justify-between shadow-2xs">
                        <div className="h-12 flex items-center justify-center">
                            {data.signature && (
                                <img src={data.signature} className="max-h-full max-w-full object-contain" alt="امضای مشتری" />
                            )}
                        </div>
                        <span className="text-[9.5px] font-black text-[#0f172a]">امضا و تایید خریدار</span>
                    </div>
                </div>

                {/* پانویس تذهیب شده با ترنج زرین */}
                <div className="text-center mt-2 pt-1.5 text-[9px] text-slate-600 flex items-center justify-center gap-2 border-t border-[#e2d7be]/80">
                    <span className="text-[#b8860b] text-xs">❖</span>
                    <span>این سند با سامانه حسابداری هوشمند اشک قلم صادر شده و دارای اعتبار رسمی و رهگیری دیجیتال است.</span>
                    <span className="text-[#b8860b] text-xs">❖</span>
                </div>
                <DocumentTrialWatermarkFooter />
            </div>
        </div>
    );
};

// --- تم ۸: فیش پرینتر حرارتی ۸۰ میلی‌متری موبایل و پوز (Thermal 80mm Mobile POS) ---
export const Thermal80mmTheme = ({
    data,
    docCompany,
    qrCode,
    barcodeUrl,
    trackingCode,
    prevBalance,
    currentBalance,
    thisInvoicePaid,
    invoiceNumDisplay,
    currency,
    currencyLabel,
    showPreviousBalance = true
}: any) => {
    return (
        <div 
            className="thermal-receipt bg-white text-black font-mono p-3 mx-auto w-full max-w-[80mm] sm:max-w-[80mm] shadow-md border border-slate-300"
            dir="rtl"
            style={{ 
                direction: 'rtl',
                letterSpacing: 'normal',
                fontSize: '11px',
                lineHeight: '1.4'
            }}
        >
            {/* سربرگ فیش */}
            <div className="text-center border-b-2 border-dashed border-black pb-2 mb-2">
                {docCompany?.logo && (
                    <div className="w-12 h-12 mx-auto mb-1 flex items-center justify-center">
                        <img src={docCompany.logo} className="max-h-full max-w-full object-contain grayscale" alt="لوگو" />
                    </div>
                )}
                <h1 className="text-base font-black text-black leading-tight">{docCompany?.name || 'فروشگاه اشک قلم'}</h1>
                {docCompany?.branchName && (
                    <div className="text-[10px] font-bold mt-0.5">شعبه: {docCompany.branchName}</div>
                )}
                {docCompany?.phone && (
                    <div className="text-[10px] mt-0.5">تلفن: {toPersianDigits(docCompany.phone)}</div>
                )}
                {docCompany?.address && (
                    <div className="text-[9px] text-slate-700 mt-0.5 leading-snug">{docCompany.address}</div>
                )}
            </div>

            {/* اطلاعات فاکتور */}
            <div className="border-b border-dashed border-black pb-2 mb-2 text-[10px] space-y-1">
                <div className="flex justify-between items-center font-bold">
                    <span>فاکتور: {data.type || 'فروش'}</span>
                    <span>شماره: {invoiceNumDisplay}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span>تاریخ: {toPersianDigits(data.date)}</span>
                    <span>پیگیری: {toPersianDigits(data.number)}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-dotted border-slate-400">
                    <span className="font-bold">مشتری:</span>
                    <span className="font-bold truncate max-w-[180px]">{data.personName || 'مشتری محترم'}</span>
                </div>
                {data.driverName && (
                    <div className="flex justify-between items-center text-[9px] text-slate-800">
                        <span>پیک / تحویل:</span>
                        <span>{data.driverName} {data.driverPhone ? `(${toPersianDigits(data.driverPhone)})` : ''}</span>
                    </div>
                )}
            </div>

            {/* جدول اقلام کالا */}
            <div className="border-b-2 border-dashed border-black pb-2 mb-2">
                <table className="w-full text-right text-[10px]">
                    <thead>
                        <tr className="border-b border-black text-slate-900 font-bold">
                            <th className="py-1">شرح کالا</th>
                            <th className="py-1 text-center w-10">تعداد</th>
                            <th className="py-1 text-left w-20">مبلغ ({currencyLabel})</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-dotted divide-slate-300">
                        {data.items?.map((item: any, idx: number) => (
                            <tr key={idx} className="align-top">
                                <td className="py-1 pr-0.5">
                                    <div className="font-bold text-black">{toPersianDigits(idx + 1)}. {item.productName}</div>
                                    <div className="text-[9px] text-slate-600">
                                        {toPersianDigits(item.quantity)} × {formatAmountOnly(item.unitPrice, currency)}
                                    </div>
                                </td>
                                <td className="py-1 text-center font-bold">{toPersianDigits(item.quantity)}</td>
                                <td className="py-1 text-left font-black">{formatAmountOnly(item.total, currency)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* جمع‌ها و ارقام مالی */}
            <div className="border-b-2 border-dashed border-black pb-2 mb-2 text-[10.5px] space-y-1">
                <div className="flex justify-between items-center">
                    <span>جمع اقلام:</span>
                    <span>{formatAmountOnly(data.totalAmount, currency)} {currencyLabel}</span>
                </div>
                {data.discount > 0 && (
                    <div className="flex justify-between items-center text-slate-800">
                        <span>تخفیف:</span>
                        <span>- {formatAmountOnly(data.discount, currency)} {currencyLabel}</span>
                    </div>
                )}
                {data.tax > 0 && (
                    <div className="flex justify-between items-center text-slate-800">
                        <span>مالیات و عوارض:</span>
                        <span>+ {formatAmountOnly(data.tax, currency)} {currencyLabel}</span>
                    </div>
                )}
                <div className="flex justify-between items-center font-black text-xs pt-1 border-t border-black">
                    <span>مبلغ نهایی:</span>
                    <span>{formatAmountOnly(data.finalTotal, currency)} {currencyLabel}</span>
                </div>

                {/* وضعیت تسویه */}
                <div className="pt-1.5 border-t border-dotted border-slate-400 space-y-0.5 text-[9.5px]">
                    {data.cashAmount > 0 && (
                        <div className="flex justify-between">
                            <span>دریافت نقدی / پوز:</span>
                            <span className="font-bold">{formatAmountOnly(data.cashAmount, currency)} {currencyLabel}</span>
                        </div>
                    )}
                    {(data.checks?.length > 0 || (data.checkAmount && data.checkAmount > 0)) && (
                        <div className="flex justify-between">
                            <span>چک دریافتی:</span>
                            <span className="font-bold">
                                {formatAmountOnly(data.checks?.reduce((s: number, c: any) => s + (c.amount || 0), 0) || data.checkAmount || 0, currency)} {currencyLabel}
                            </span>
                        </div>
                    )}
                    {showPreviousBalance && (
                        <>
                            <div className="flex justify-between text-slate-700">
                                <span>مانده قبلی:</span>
                                <span>{formatAmountOnly(prevBalance, currency)} {currencyLabel}</span>
                            </div>
                            <div className="flex justify-between font-bold text-black pt-0.5 border-t border-dotted border-slate-300">
                                <span>مانده کل حساب:</span>
                                <span>{formatAmountOnly(currentBalance, currency)} {currencyLabel}</span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* پانویس یا توضیحات */}
            {data.description && (
                <div className="text-[9px] text-slate-800 pb-2 mb-2 border-b border-dotted border-black leading-relaxed whitespace-pre-line">
                    {data.description}
                </div>
            )}

            {/* بارکد و کیوآر اصالت */}
            <div className="text-center space-y-2 py-1">
                {barcodeUrl && (
                    <div className="flex justify-center my-1">
                        <img src={barcodeUrl} alt="بارکد" className="max-h-8 object-contain" />
                    </div>
                )}
                <div className="text-[8px] font-mono text-slate-600">{trackingCode}</div>
                {qrCode && (
                    <div className="flex justify-center">
                        <img src={qrCode} alt="QR" className="w-16 h-16 object-contain" />
                    </div>
                )}
                <div className="text-[8.5px] font-bold text-slate-700">از حسن اعتماد و خرید شما سپاسگزاریم</div>
                <div className="text-[7.5px] text-slate-500">سامانه مالی و صدور فاکتور ابری و همراه اشک قلم</div>
            </div>

            {/* خط برش کاغذ حرارتی */}
            <div className="text-center text-slate-400 text-[8px] my-2 select-none border-t border-dashed border-slate-400 pt-1">
                - - - - - - - - - - - - - - - - - - - - - - - - - - - -
            </div>
            <DocumentTrialWatermarkFooter />
        </div>
    );
};


