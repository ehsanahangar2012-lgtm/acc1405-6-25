
import React from 'react';
import { Invoice, Voucher, PrintTheme, CheckTransfer, VoucherItem, InvoiceItem } from '../types';
import { toPersianDigits, formatCurrency, getQrCodeUrl, generateId, getPersianDate } from '../utils';
import { useStore } from '../store';
import { Truck, Info, Package, MapPin, Phone, Hash, ArrowRight, Box, Layers, ShieldCheck, UserCheck, Calendar, Gavel, Scale, FileText, CheckCircle2, PenTool, Fingerprint, Barcode as BarcodeIcon, Car, Clock, CreditCard, Wallet, Banknote, Palette, Sparkles, MapPinned, Weight, MapPinHouse, Camera, Landmark, QrCode, ScrollText } from 'lucide-react';
import { DocumentTrialWatermarkFooter } from './DocumentTrialWatermarkFooter';

interface PrintProps {
    data: Invoice | Voucher | CheckTransfer | any;
    theme: PrintTheme;
    type: 'INVOICE' | 'VOUCHER' | 'CHECK_TRANSFER' | 'CONTRACT' | 'CHECK' | 'RECEIPT' | 'PAYMENT';
}

export const PrintTemplate: React.FC<PrintProps> = ({ data, theme, type }) => {
    const { companies } = useStore();
    
    if (!data) return <div className="p-20 text-center text-slate-400 font-black">در حال بارگذاری اطلاعات سند...</div>;

    const docCompany = data.company
      || companies.find(c => c.id === data.companyId) 
      || companies.find(c => c.isActive) 
      || companies[0] 
      || { name: 'اشک قلم', phone: '۰۲۱', address: 'تهران' };

    const trackingCode = data.trackingCode || (type === 'CHECK' ? `CHK-${data.sayadId || data.id}` : `DOC-${data.number || '000'}`);
    
    const signatureUrl = type === 'CONTRACT' 
      ? (data.signatureUrl || `${window.location.origin}${window.location.pathname}#/sign/${data.id}`) 
      : `DocType:${type}\nCode:${trackingCode}\nAmount:${data.finalTotal || data.totalAmount || data.amount || 0}\nPerson:${data.personName || data.holderName || ''}`;
      
    const qrCode = getQrCodeUrl(signatureUrl);

    if (type === 'INVOICE') {
        return <InvoiceUniversalTemplate data={data} docCompany={docCompany} trackingCode={trackingCode} qrCode={qrCode} theme={theme} />;
    }

    if (type === 'VOUCHER') {
        return <VoucherUniversalTemplate data={data} docCompany={docCompany} trackingCode={trackingCode} qrCode={qrCode} theme={theme} />;
    }

    if (type === 'CHECK_TRANSFER') {
        return <CheckTransferTemplate data={data} docCompany={docCompany} trackingCode={trackingCode} qrCode={qrCode} />;
    }

    if (type === 'CHECK') {
        return <SingleCheckPrintTemplate data={data} docCompany={docCompany} trackingCode={trackingCode} qrCode={qrCode} theme={theme} />;
    }

    if (type === 'CONTRACT') {
        return <ContractPrintTemplate data={data} docCompany={docCompany} trackingCode={trackingCode} qrCode={qrCode} theme={theme} />;
    }

    if (type === 'RECEIPT' || type === 'PAYMENT') {
        return <ReceiptUniversalTemplate data={data} docCompany={docCompany} trackingCode={trackingCode} qrCode={qrCode} theme={theme} />;
    }

    return null;
};

const DeveloperFooter = () => (
    <div className="w-full mt-auto">
        <DocumentTrialWatermarkFooter />
    </div>
);

const InvoiceUniversalTemplate = ({ data, docCompany, trackingCode, qrCode, theme }: any) => {
    // Premium Theme uses pure Black & White for maximum contrast
    const isPremium = theme === 'premium';
    
    return (
        <div className="p-10 bg-white min-h-[297mm] flex flex-col text-slate-900 font-sans" dir="rtl">
            {/* Header Area */}
            <div className={`flex justify-between items-start mb-8 border-b-[8px] ${isPremium ? 'border-black' : 'border-slate-900'} pb-6`}>
                <div className="flex items-center gap-6">
                    <div className={`w-28 h-28 ${isPremium ? 'bg-black' : 'bg-slate-900'} rounded-3xl flex items-center justify-center text-white shadow-xl overflow-hidden`}>
                        {docCompany.logo ? <img src={docCompany.logo} className="w-full h-full object-contain p-2" /> : <ShieldCheck size={54}/>}
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-slate-950 tracking-tighter">{docCompany.name}</h1>
                        <p className="text-[11px] font-black text-slate-600 uppercase tracking-[0.2em] mt-2">{docCompany.legalName || 'Official Financial Management'}</p>
                        <div className="flex gap-4 mt-4 text-[11px] font-black text-slate-700">
                            <span className="flex items-center gap-1.5"><Phone size={14}/> {toPersianDigits(docCompany.phone)}</span>
                            <span className="flex items-center gap-1.5"><MapPin size={14}/> {docCompany.address}</span>
                        </div>
                    </div>
                </div>
                <div className="text-left flex flex-col items-end">
                    <div className={`${isPremium ? 'bg-black' : 'bg-slate-900'} text-white px-8 py-3 rounded-2xl text-xl font-black mb-4 uppercase`}>فاکتور {data.type}</div>
                    <div className="text-[10px] font-black text-slate-400 mb-1 uppercase tracking-widest">Tracking Authenticity Code:</div>
                    <div className="font-mono text-lg font-black text-slate-950 tracking-wider mb-4">{trackingCode}</div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Verified Digital Entry</p>
                            <p className="text-[10px] font-black text-emerald-600">اصالت تایید شده</p>
                        </div>
                        <img src={qrCode} className="w-20 h-20 border-2 border-slate-100 p-1.5 rounded-2xl bg-white" alt="Authenticity QR" />
                    </div>
                </div>
            </div>

            {/* Entity Info */}
            <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="bg-slate-50 p-6 rounded-[2.5rem] border-2 border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">مشخصات خریدار / مشتری:</span>
                    <div className="text-2xl font-black text-slate-950 mb-1">{data.personName}</div>
                    <div className="text-xs font-bold text-slate-500 leading-6">مشتری گرامی، از حسن انتخاب شما سپاسگزاریم. کالاها طبق لیست زیر تقدیم می‌گردد.</div>
                </div>
                <div className="bg-slate-50 p-6 rounded-[2.5rem] border-2 border-slate-100 grid grid-cols-2 gap-4">
                    <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase mb-1 block">تاریخ صدور:</span>
                        <span className="text-base font-mono font-black text-slate-900">{toPersianDigits(data.date)}</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase mb-1 block">تاریخ سررسید:</span>
                        <span className="text-base font-mono font-black text-indigo-700">{toPersianDigits(data.dueDate || data.date)}</span>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-slate-200">
                        <span className="text-[10px] font-black text-slate-400 uppercase mb-1 block">شماره داخلی فاکتور:</span>
                        <span className="text-base font-mono font-black text-slate-950">#{toPersianDigits(data.number)}</span>
                    </div>
                </div>
            </div>

            {/* High Contrast Table */}
            <div className="flex-1 bg-white border-2 border-slate-200 rounded-[2rem] overflow-hidden mb-8 shadow-sm">
                <table className="w-full text-right border-collapse">
                    <thead className={`${isPremium ? 'bg-black' : 'bg-slate-900'} text-white`}>
                        <tr className="text-[11px] font-black uppercase tracking-wider">
                            <th className="p-4 border-l border-white/10 text-center">ردیف</th>
                            <th className="p-4 border-l border-white/10">شرح کالا / خدمات</th>
                            <th className="p-4 text-center border-l border-white/10">تعداد</th>
                            <th className="p-4 text-left border-l border-white/10">قیمت واحد (ریال)</th>
                            <th className="p-4 text-left">جمع ردیف (ریال)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-slate-100">
                        {data.items?.map((item: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-50">
                                <td className="p-4 font-mono text-sm text-slate-400 border-l border-slate-100 text-center">{toPersianDigits(i + 1)}</td>
                                <td className="p-4 border-l border-slate-100">
                                    <div className="font-black text-slate-950 text-base">{item.productName}</div>
                                    {item.description && <div className="text-[10px] text-indigo-700 font-bold mt-2 leading-6 bg-indigo-50/50 px-3 py-2 rounded-xl border border-indigo-100">{item.description}</div>}
                                </td>
                                <td className="p-4 text-center font-black text-slate-900 text-base border-l border-slate-100">{toPersianDigits(item.quantity)}</td>
                                <td className="p-4 text-left font-mono text-sm text-slate-800 border-l border-slate-100">{toPersianDigits(item.unitPrice.toLocaleString())}</td>
                                <td className="p-4 text-left font-mono font-black text-slate-950 text-base">{toPersianDigits(item.total.toLocaleString())}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Summary & Totals */}
            <div className="grid grid-cols-12 gap-8 mb-8">
                <div className="col-span-7 bg-slate-50 p-6 rounded-[2rem] border border-slate-200 shadow-inner">
                    <h4 className="text-[11px] font-black text-slate-400 uppercase mb-4 flex items-center gap-2"><ScrollText size={16}/> ملاحظات و پانویس قانونی</h4>
                    <p className="text-[12px] font-bold text-slate-700 leading-8 whitespace-pre-line">{data.description || 'کالا صحیح و سالم تحویل گردید و حق هرگونه اعتراض بعدی سلب شد.'}</p>
                </div>
                <div className="col-span-5 space-y-3">
                    <div className="bg-slate-100 p-6 rounded-[2rem] space-y-4 border-2 border-slate-200">
                        <div className="flex justify-between items-center text-xs font-black text-slate-500">
                            <span>جمع کل کالاها:</span>
                            <span className="font-mono text-slate-900">{toPersianDigits(data.subTotal.toLocaleString())}</span>
                        </div>
                        {data.discount > 0 && <div className="flex justify-between items-center text-xs font-black text-rose-600"><span>تخفیف نقدی:</span><span className="font-mono">-{toPersianDigits(data.discount.toLocaleString())}</span></div>}
                        {data.tax > 0 && <div className="flex justify-between items-center text-xs font-black text-indigo-600"><span>مالیات و عوارض:</span><span className="font-mono">+{toPersianDigits(data.tax.toLocaleString())}</span></div>}
                        <div className="pt-4 border-t-4 border-slate-900 flex justify-between items-center">
                            <span className="text-base font-black text-slate-950 uppercase">مبلغ نهایی فاکتور:</span>
                            <span className="text-2xl font-black font-mono text-slate-950">{formatCurrency(data.finalTotal)}</span>
                        </div>
                    </div>
                    <div className="p-4 bg-emerald-50 border-2 border-emerald-100 rounded-2xl flex justify-between items-center text-[10px] font-black text-emerald-800">
                        <span>مبلغ تسویه شده (نقد+چک):</span>
                        <span className="font-mono">{toPersianDigits((data.cashAmount + data.checkAmount).toLocaleString())} ریال</span>
                    </div>
                </div>
            </div>

            {/* Barcode Authenticity Bar */}
            <div className={`${isPremium ? 'bg-black' : 'bg-slate-900'} text-white p-6 rounded-[2rem] mb-8 flex justify-between items-center shadow-xl`}>
                <div className="flex items-center gap-8">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase tracking-[0.4em] opacity-60 mb-2">Internal Validation Barcode</span>
                        <span className="font-barcode text-6xl leading-none text-white tracking-widest">*{trackingCode}*</span>
                    </div>
                </div>
                <div className="text-left border-r border-white/20 pr-8">
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-40 mb-1">Blockchain Security Hash</p>
                    <p className="font-mono text-[10px] opacity-80">{generateId().toUpperCase()}-{generateId().toUpperCase()}-{generateId().toUpperCase()}</p>
                </div>
            </div>

            {/* Signature Area */}
            <div className="grid grid-cols-3 gap-8 text-center mt-auto pb-4">
                <div className="space-y-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">مهر و امضای فروشنده</span>
                    <div className="h-36 bg-slate-50 rounded-[2rem] border-4 border-dashed border-slate-200 flex items-center justify-center p-6 relative">
                        {docCompany.stamp && <img src={docCompany.stamp} className="h-full object-contain mix-blend-multiply opacity-95" />}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
                            <ShieldCheck size={80} className="text-slate-950" />
                        </div>
                    </div>
                    <div className="text-[10px] font-black text-slate-900 underline underline-offset-4">{docCompany.name}</div>
                </div>
                <div className="space-y-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">واحد مالی و بازرگانی</span>
                    <div className="h-36 bg-slate-50 rounded-[2rem] border-4 border-dashed border-slate-200 flex items-center justify-center p-6 relative">
                        {data.workflowSignatures?.sales && <img src={data.workflowSignatures.sales} className="h-full object-contain mix-blend-multiply grayscale contrast-[2]" />}
                    </div>
                </div>
                <div className="space-y-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">تایید و امضای خریدار</span>
                    <div className="h-36 bg-slate-50 rounded-[2rem] border-4 border-dashed border-slate-200 flex items-center justify-center p-6 relative">
                        {data.signature && <img src={data.signature} className="h-full object-contain mix-blend-multiply grayscale contrast-[2]" />}
                        {!data.signature && <PenTool className="text-slate-200" size={40}/>}
                    </div>
                    <div className="text-[10px] font-black text-slate-950 underline underline-offset-4">{data.personName}</div>
                </div>
            </div>
            
            <DeveloperFooter />
        </div>
    );
};

const VoucherUniversalTemplate = ({ data, docCompany, trackingCode, qrCode, theme }: any) => (
    <div className="p-10 bg-white min-h-[297mm] flex flex-col text-slate-900 font-sans" dir="rtl">
        <div className="flex justify-between items-start mb-10 border-b-[6px] border-slate-900 pb-8">
            <div className="flex items-center gap-6">
                <div className="w-24 h-24 bg-slate-900 rounded-3xl flex items-center justify-center text-white shadow-xl">
                    {docCompany.logo ? <img src={docCompany.logo} className="w-full h-full object-contain p-2" /> : <Package size={48}/>}
                </div>
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tighter">{docCompany.name}</h1>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Cargo & Warehouse Division</p>
                </div>
            </div>
            <div className="text-left flex flex-col items-end">
                <div className="bg-slate-900 text-white px-6 py-2 rounded-xl text-lg font-black mb-3">حواله {data.type === 'IN' ? 'ورود' : 'خروج'} کالا</div>
                <div className="font-mono text-base font-black text-slate-900 tracking-wider mb-2">{trackingCode}</div>
                <img src={qrCode} className="w-16 h-16 border-2 border-slate-100 p-1 rounded-xl" alt="QR" />
            </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-100">
                <div className="text-xs font-black text-slate-400 uppercase mb-2">اطلاعات تحویل‌گیرنده / فرستنده:</div>
                <div className="text-xl font-black text-slate-900">{data.personName}</div>
            </div>
            <div className="bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-100 grid grid-cols-2 gap-4">
                <div><span className="text-[9px] font-black text-slate-400 block uppercase">تاریخ:</span><span className="text-sm font-mono font-black">{toPersianDigits(data.date)}</span></div>
                <div><span className="text-[9px] font-black text-slate-400 block uppercase">شماره:</span><span className="text-sm font-mono font-black">#{toPersianDigits(data.number)}</span></div>
            </div>
        </div>

        <div className="flex-1 bg-white border-2 border-slate-200 rounded-3xl overflow-hidden mb-8">
            <table className="w-full text-right">
                <thead className="bg-slate-900 text-white text-[10px] font-black uppercase">
                    <tr><th className="p-4">ردیف</th><th className="p-4">شرح کالا / قطعات</th><th className="p-4 text-center">تعداد</th><th className="p-4 text-center">قفسه</th><th className="p-4">ملاحظات</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {data.items?.map((item: any, i: number) => (
                        <tr key={i}>
                            <td className="p-4 font-mono text-xs text-slate-400">{toPersianDigits(i + 1)}</td>
                            <td className="p-4 font-black text-slate-900">{item.productName}</td>
                            <td className="p-4 text-center font-black text-slate-950 text-base">{toPersianDigits(item.quantity)}</td>
                            <td className="p-4 text-center font-mono font-black text-indigo-600">{toPersianDigits(item.shelfLocation || '---')}</td>
                            <td className="p-4 text-xs font-bold text-slate-500">{item.description || '---'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        <div className="mb-8 p-6 bg-slate-50 rounded-[2rem] border-2 border-slate-200">
            <h4 className="text-[10px] font-black text-slate-400 uppercase mb-2">توضیحات حواله:</h4>
            <p className="text-xs font-bold text-slate-700 leading-7">{data.notes || '---'}</p>
        </div>

        <div className="grid grid-cols-3 gap-8 text-center pb-8">
            <div className="space-y-4">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">تایید انباردار</span>
                <div className="h-28 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center p-4">
                    {docCompany.stamp && <img src={docCompany.stamp} className="h-full object-contain mix-blend-multiply grayscale opacity-70" />}
                </div>
            </div>
            <div className="space-y-4">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">امضای راننده / مباشر</span>
                <div className="h-28 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center p-4">
                    {data.supervisorSignature && <img src={data.supervisorSignature} className="h-full object-contain mix-blend-multiply grayscale" />}
                </div>
                <div className="text-[9px] font-black">{data.supervisor || '---'}</div>
            </div>
            <div className="space-y-4">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">امضای تحویل‌گیرنده</span>
                <div className="h-28 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center p-4">
                    {data.signature && <img src={data.signature} className="h-full object-contain mix-blend-multiply grayscale" />}
                </div>
                <div className="text-[9px] font-black">{data.personName}</div>
            </div>
        </div>
        <DeveloperFooter />
    </div>
);

const CheckTransferTemplate = ({ data, docCompany, trackingCode, qrCode }: any) => (
    <div className="p-12 bg-white min-h-[297mm] flex flex-col text-slate-900" dir="rtl">
        <div className="flex justify-between items-start mb-12 border-b-8 border-slate-900 pb-8">
            <div className="flex items-center gap-6">
                <div className="w-24 h-24 bg-slate-900 rounded-3xl flex items-center justify-center text-white shadow-lg">
                    {docCompany.logo ? <img src={docCompany.logo} className="w-full h-full object-contain p-2" /> : <Landmark size={48}/>}
                </div>
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter">{docCompany.name}</h1>
                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mt-1">Official Check Assignment Hub</p>
                </div>
            </div>
            <div className="text-left flex items-center gap-6">
                <div className="text-right">
                    <div className="text-[10px] font-black text-slate-400 uppercase">سند واگذاری چک</div>
                    <div className="font-mono text-xl font-black text-slate-950">{trackingCode}</div>
                </div>
                <img src={qrCode} className="w-20 h-20 border-2 border-slate-100 p-1 rounded-2xl" alt="QR" />
            </div>
        </div>

        <div className="mb-10 p-8 bg-slate-50 rounded-[2.5rem] border-2 border-slate-100">
            <div className="grid grid-cols-2 gap-8">
                <div><span className="text-[10px] text-slate-500 font-black uppercase mb-1 block">واگذارکننده:</span><div className="text-2xl font-black text-slate-950">{docCompany.name}</div></div>
                <div>
                    <span className="text-[10px] text-slate-500 font-black uppercase mb-1 block">تحویل‌گیرنده:</span>
                    <div className="text-2xl font-black text-slate-950">{data.personName}</div>
                    {data.nationalId && <div className="text-xs font-mono text-indigo-600 font-black mt-2 bg-indigo-50 px-3 py-1 rounded-lg w-fit">شناسه تایید شده: {toPersianDigits(data.nationalId)}</div>}
                </div>
            </div>
        </div>

        <div className="flex-1">
            <h3 className="text-xl font-black mb-8 flex items-center gap-3 text-slate-950"><CreditCard className="text-indigo-600" size={24}/> لیست اسناد واگذار شده</h3>
            <div className="rounded-[2rem] border-2 border-slate-100 overflow-hidden shadow-sm">
                <table className="w-full text-right border-collapse">
                    <thead className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider">
                        <tr>
                            <th className="p-4 border-l border-white/10 text-center">ردیف</th>
                            <th className="p-4 border-l border-white/10 text-center">تصویر چک</th>
                            <th className="p-4 border-l border-white/10">بانک صادرکننده</th>
                            <th className="p-4 text-center border-l border-white/10">شناسه صیادی</th>
                            <th className="p-4 text-center border-l border-white/10">تاریخ سررسید</th>
                            <th className="p-4 text-left">مبلغ (ریال)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-slate-100 text-slate-900 font-black">
                        {data.items?.map((item: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-50">
                                <td className="p-4 font-mono text-sm text-slate-400 text-center">{toPersianDigits(i + 1)}</td>
                                <td className="p-3 text-center border-l border-slate-100">
                                    {item.imageUrl ? (
                                        <img 
                                            src={item.imageUrl} 
                                            alt="تصویر چک" 
                                            className="w-14 h-9 object-cover rounded border border-slate-300 shadow-xs inline-block align-middle" 
                                        />
                                    ) : (
                                        <span className="text-slate-300 text-xs font-mono">---</span>
                                    )}
                                </td>
                                <td className="p-4 text-base">{item.bankName}</td>
                                <td className="p-4 text-center font-mono text-base tracking-widest">{toPersianDigits(item.sayadId)}</td>
                                <td className="p-4 text-center font-mono text-base text-indigo-700">{toPersianDigits(item.dueDate)}</td>
                                <td className="p-4 text-left font-mono text-lg">{formatCurrency(item.amount)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        <div className="mt-8 p-8 bg-black text-white rounded-[2.5rem] flex justify-between items-center shadow-2xl">
            <span className="text-xl font-black uppercase tracking-widest">مجموع مبلغ اسناد واگذار شده:</span>
            <span className="text-4xl font-black font-mono tracking-tighter">{formatCurrency(data.items?.reduce((s:number, i:any) => s + (i.amount || 0), 0))}</span>
        </div>

        <div className="grid grid-cols-2 gap-20 mt-16 pt-12 border-t-8 border-slate-900">
            <div className="text-center space-y-6">
                <span className="text-[11px] text-slate-400 font-black uppercase tracking-[0.2em] block">مهر و امضای واگذارکننده</span>
                <div className="h-44 bg-slate-50 rounded-[3rem] border-4 border-dashed border-slate-200 flex items-center justify-center p-8 relative">
                    {docCompany.stamp && <img src={docCompany.stamp} className="h-full object-contain mix-blend-multiply opacity-90" />}
                </div>
            </div>
            <div className="text-center space-y-6">
                <span className="text-[11px] text-slate-400 font-black uppercase tracking-[0.2em] block">امضا و اثر انگشت گیرنده</span>
                <div className="h-44 bg-slate-50 rounded-[3rem] border-4 border-dashed border-slate-200 flex items-center justify-center p-8">
                    {data.signature && <img src={data.signature} className="h-full object-contain mix-blend-multiply grayscale contrast-[2]" />}
                </div>
            </div>
        </div>
        <DeveloperFooter />
    </div>
);

const SingleCheckPrintTemplate = ({ data, docCompany, trackingCode, qrCode, theme }: any) => {
    return (
        <div className="p-10 bg-white min-h-[297mm] flex flex-col text-slate-900 font-sans" dir="rtl">
            {/* Header */}
            <div className="flex justify-between items-start mb-8 border-b-4 border-slate-900 pb-6">
                <div className="flex items-center gap-6">
                    <div className="w-24 h-24 bg-slate-900 rounded-3xl flex items-center justify-center text-white shadow-xl overflow-hidden">
                        {docCompany.logo ? <img src={docCompany.logo} className="w-full h-full object-contain p-2" /> : <ShieldCheck size={48}/>}
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-950 tracking-tight">{docCompany.name}</h1>
                        <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mt-1">سند رسمی مشخصات و رسید لاشه چک</p>
                        <div className="flex gap-4 mt-3 text-xs text-slate-600">
                            <span>تلفن: {toPersianDigits(docCompany.phone || '')}</span>
                            <span>نشانی: {docCompany.address || ''}</span>
                        </div>
                    </div>
                </div>
                <div className="text-left flex flex-col items-end">
                    <div className="bg-slate-900 text-white px-6 py-2.5 rounded-2xl text-base font-black mb-3">سند دریافت چک</div>
                    <div className="font-mono text-sm text-slate-600">کد پیگیری: {trackingCode}</div>
                    <div className="text-xs text-slate-500 mt-1">تاریخ ثبت: {toPersianDigits(data.issueDate || data.date || getPersianDate())}</div>
                </div>
            </div>

            {/* Check Details Card */}
            <div className="bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-200 mb-8 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-black block mb-1">بانک صادرکننده:</span>
                        <span className="text-lg font-black text-slate-900">{data.bankName || '---'}</span>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-black block mb-1">تاریخ سررسید:</span>
                        <span className="text-lg font-black font-mono text-indigo-700">{toPersianDigits(data.dueDate || '---')}</span>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 col-span-2">
                        <span className="text-[10px] text-slate-400 font-black block mb-1">شناسه صیادی (۱۶ رقم):</span>
                        <span className="text-xl font-black font-mono tracking-widest text-slate-950">{toPersianDigits(data.sayadId || '---')}</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-black block mb-1">صادرکننده / صاحب حساب:</span>
                        <span className="text-base font-black text-slate-900">{data.holderName || data.personName || '---'}</span>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-black block mb-1">وضعیت چک:</span>
                        <span className="text-base font-black text-emerald-600">نزد صندوق (در انتظار سررسید)</span>
                    </div>
                </div>

                <div className="p-6 bg-slate-900 text-white rounded-2xl flex justify-between items-center">
                    <span className="text-lg font-black">مبلغ چک:</span>
                    <div className="text-left font-mono">
                        <div className="text-3xl font-black tracking-tight">{formatCurrency(data.amount || 0)}</div>
                        <div className="text-xs text-amber-300 font-sans font-bold mt-1">{toPersianDigits(Math.round((data.amount || 0) / 10).toLocaleString())} تومان</div>
                    </div>
                </div>
            </div>

            {/* Check Scan Image Area */}
            <div className="mb-8">
                <h3 className="text-base font-black mb-3 text-slate-900 flex items-center gap-2">
                    <Camera size={18} className="text-indigo-600"/> تصویر اسکن شده لاشه چک
                </h3>
                <div className="p-4 bg-slate-100 rounded-3xl border-2 border-slate-200 flex items-center justify-center min-h-[220px]">
                    {data.imageUrl ? (
                        <img 
                            src={data.imageUrl} 
                            alt="اسکن لاشه چک" 
                            className="max-h-72 max-w-full object-contain rounded-2xl shadow-md border border-slate-300"
                        />
                    ) : (
                        <div className="text-center py-12 text-slate-400">
                            <Banknote size={48} className="mx-auto mb-2 opacity-30" />
                            <p className="text-xs font-bold">تصویر اسکن چک برای این سند ثبت نشده است.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Notes */}
            {data.description && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 mb-8 text-xs text-slate-600 leading-6">
                    <span className="font-black text-slate-800 ml-1">بابت / توضیحات:</span>
                    {data.description}
                </div>
            )}

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-16 mt-auto pt-8 border-t-2 border-slate-200">
                <div className="text-center space-y-3">
                    <span className="text-[10px] text-slate-500 font-black block">امضا و اثر انگشت تحویل‌دهنده چک</span>
                    <div className="h-28 bg-slate-50 rounded-2xl border border-dashed border-slate-300"></div>
                </div>
                <div className="text-center space-y-3">
                    <span className="text-[10px] text-slate-500 font-black block">مهر و امضای امور مالی و خزانه</span>
                    <div className="h-28 bg-slate-50 rounded-2xl border border-dashed border-slate-300 flex items-center justify-center">
                        {docCompany.stamp && <img src={docCompany.stamp} className="h-full object-contain mix-blend-multiply opacity-80" />}
                    </div>
                </div>
            </div>
            <DeveloperFooter />
        </div>
    );
};

const ContractPrintTemplate = ({ data, docCompany, trackingCode, qrCode }: any) => {
    const parsedDescription = React.useMemo(() => {
        if (!data || !data.description) return null;
        if (data.description.trim().startsWith('{')) {
            try {
                const parsed = JSON.parse(data.description);
                if (parsed.isTemplate) return parsed;
            } catch {}
        }
        return null;
    }, [data]);

    const getTypeLabel = (t: string) => {
        if (t === 'SERVICE') return 'خدماتی';
        if (t === 'SALE') return 'فروش';
        if (t === 'PURCHASE') return 'خرید';
        if (t === 'EMPLOYMENT') return 'استخدامی';
        if (t === 'LEASE') return 'اجاره';
        return 'سایر';
    };

    return (
        <div className="p-10 bg-white min-h-[297mm] flex flex-col text-slate-900 font-sans print-contract-page" dir="rtl">
            {/* Design a beautiful premium letterhead */}
            <div className="flex justify-between items-start mb-10 border-b-2 border-slate-300 pb-6 w-full">
                {/* Right: Company Logo & Details */}
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center text-slate-800 shrink-0">
                        {docCompany.logo ? (
                            <img src={docCompany.logo} className="w-full h-full object-contain p-1" />
                        ) : (
                            <ScrollText size={32} className="text-slate-700" />
                        )}
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900">{docCompany.name || 'سامانه اشک قلم'}</h2>
                        <p className="text-[10px] text-slate-500 mt-1 font-bold">
                            تلفن: {toPersianDigits(docCompany.phone || '۰۲۱')}
                        </p>
                        <p className="text-[10px] text-slate-500 font-bold">
                            آدرس: {docCompany.address || 'تهران، ایران'}
                        </p>
                    </div>
                </div>

                {/* Center: Title */}
                <div className="text-center self-center bg-slate-100 border border-slate-200 px-6 py-2.5 rounded-xl">
                    <h1 className="text-lg font-black text-slate-950">قرارداد {getTypeLabel(data.type)}</h1>
                    <span className="text-[9px] text-slate-500 font-bold tracking-wider">سند رسمی قرارداد تجاری</span>
                </div>

                {/* Left: Metadata & QR Code */}
                <div className="flex items-center gap-4">
                    <div className="text-right text-[10px] text-slate-600 font-bold space-y-1">
                        <div>شماره: <span className="font-mono">{toPersianDigits(data.number)}</span></div>
                        <div>تاریخ: <span className="font-mono">{toPersianDigits(data.createdAt || '')}</span></div>
                        <div>کد رهگیری: <span className="font-mono text-indigo-600">{toPersianDigits(trackingCode)}</span></div>
                        <div>پیوست: <span className="font-mono">ندارد</span></div>
                    </div>
                    <div className="bg-white border border-slate-200 p-1.5 rounded-lg flex flex-col items-center shadow-xs">
                        <img src={qrCode} className="w-12 h-12" alt="QR Verification" />
                        <span className="text-[7px] text-slate-400 mt-1 font-bold">تایید اصالت سند</span>
                    </div>
                </div>
            </div>

            {/* Parties Info */}
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-6 space-y-2 text-xs leading-7">
                <p className="font-bold text-slate-800"><span className="text-slate-500 font-normal">طرف اول (کارفرما/شرکت):</span> {docCompany.name}</p>
                <p className="font-bold text-slate-800"><span className="text-slate-500 font-normal">طرف دوم (پیمانکار/مجری):</span> {data.personName}</p>
            </div>

            {/* Body Description Content */}
            <div className="space-y-6 text-xs leading-8 text-justify text-slate-800 mb-8 flex-1">
                <h4 className="font-black text-sm border-r-4 border-indigo-600 pr-2 mb-2">ماده ۱: موضوع قرارداد</h4>
                <p className="font-bold">{data.title}</p>
                
                <h4 className="font-black text-sm border-r-4 border-indigo-600 pr-2 mb-2">ماده ۲: شرح و تعهدات قرارداد</h4>
                {parsedDescription ? (
                  <div className="space-y-4">
                    <p className="whitespace-pre-line leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100 font-medium">{parsedDescription.compiledText}</p>
                    
                    {/* Variables table */}
                    <div>
                      <p className="text-[10px] font-black text-slate-500 mb-1.5">پارامترهای اختصاصی قرارداد:</p>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        {Object.entries(parsedDescription.variables).map(([key, val]) => {
                          let label = key;
                          if (key === 'circulation') label = 'تیراژ';
                          else if (key === 'paperType') label = 'کاغذ مصرفی';
                          else if (key === 'colors') label = 'رنگ‌ها';
                          else if (key === 'coating') label = 'سلفون/پوشش';
                          else if (key === 'binding') label = 'صحافی چاپی';
                          else if (key === 'dimensions') label = 'ابعاد جعبه';
                          else if (key === 'boxPaperType') label = 'نوع مقوا';
                          else if (key === 'paperWeight') label = 'گرماژ مقوا';
                          else if (key === 'dieCut') label = 'قالب‌زنی دایکات';
                          else if (key === 'boxCoating') label = 'روکش جعبه';
                          else if (key === 'cartonDimensions') label = 'ابعاد کارتن';
                          else if (key === 'fluteType') label = 'کنگره فلوت ورق';
                          else if (key === 'cartonCirculation') label = 'تیراژ سفارش';
                          else if (key === 'cartonPrintType') label = 'چاپ کارتن';
                          else if (key === 'plasticMaterial') label = 'مواد اولیه';
                          else if (key === 'partWeight') label = 'وزن قطعه (گرم)';
                          else if (key === 'moldCavities') label = 'حفره قالب';
                          else if (key === 'moldOwnership') label = 'مالکیت قالب';
                          else if (key === 'strikePrice') label = 'هزینه هر ضرب';
                          else if (key === 'materialProvider') label = 'تامین مواد';
                          else if (key === 'prepayment') label = 'پیش‌پرداخت';

                          return (
                            <div key={key} className="bg-slate-50 border border-slate-100 p-2 rounded flex justify-between">
                              <span className="text-slate-400 font-bold">{label}:</span>
                              <span className="font-bold text-slate-800">
                                {key === 'prepayment' || key === 'strikePrice' ? toPersianDigits(Number(val).toLocaleString()) + ' ﷼' : toPersianDigits(val as string)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-line leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100 font-medium">{data.description || 'شرح ثبت نشده است.'}</p>
                )}

                <h4 className="font-black text-sm border-r-4 border-indigo-600 pr-2 mb-2">ماده ۳: مدت قرارداد</h4>
                <p>این قرارداد از تاریخ <span className="font-bold font-mono">{toPersianDigits(data.startDate)}</span> لغایت <span className="font-bold font-mono">{toPersianDigits(data.endDate || '---')}</span> معتبر خواهد بود.</p>

                <h4 className="font-black text-sm border-r-4 border-indigo-600 pr-2 mb-2">ماده ۴: ارزش کل تعهدات</h4>
                <p>مبلغ کل قرارداد برابر با <span className="font-black text-indigo-700">{formatCurrency(data.totalAmount)}</span> توافق گردید.</p>

                {data.items && data.items.length > 0 && (
                    <>
                        <h4 className="font-black text-sm border-r-4 border-indigo-600 pr-2 mb-2">ماده ۵: تعهدات پرداخت و اقساط</h4>
                        <div className="border border-slate-200 rounded-lg overflow-hidden mt-2">
                            <table className="w-full text-right text-[10px]">
                                <thead className="bg-slate-100 font-bold">
                                    <tr>
                                        <th className="p-2.5">شرح قسط/تعهد</th>
                                        <th className="p-2.5">سررسید</th>
                                        <th className="p-2.5 text-left">مبلغ (ریال)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {data.items.map((item: any) => (
                                        <tr key={item.id}>
                                            <td className="p-2.5">{item.description}</td>
                                            <td className="p-2.5 font-mono">{toPersianDigits(item.dueDate || '')}</td>
                                            <td className="p-2.5 text-left font-mono font-bold">{formatCurrency(item.amount).replace(' ریال','')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 border-t-2 border-slate-200 pt-8 mt-6">
                <div className="text-center">
                    <p className="text-[10px] font-black text-slate-500 mb-2">محل امضا و مهر کارفرما (شرکت)</p>
                    <div className="h-28 bg-slate-50 border border-dashed border-slate-200 rounded-xl flex items-center justify-center p-3 relative">
                      {/* Company/Manager Signature */}
                      {(data.companySignature || docCompany.signature) ? (
                          <img src={data.companySignature || docCompany.signature} className="h-20 max-w-full object-contain mix-blend-multiply z-10" />
                      ) : null}

                      {/* Company Stamp */}
                      {docCompany.stamp ? (
                          <img src={docCompany.stamp} className="absolute right-4 bottom-2 h-16 w-16 object-contain mix-blend-multiply opacity-85 z-20" />
                      ) : !(data.companySignature || docCompany.signature) ? (
                          <span className="text-[10px] text-slate-400">فاقد امضا</span>
                      ) : null}
                    </div>
                </div>
                <div className="text-center">
                    <p className="text-[10px] font-black text-slate-500 mb-2">محل امضا و اثر انگشت طرف دوم</p>
                    <div className="h-28 bg-slate-50 border border-dashed border-slate-200 rounded-xl flex items-center justify-center p-3">
                      {data.signature ? (
                          <img src={data.signature} className="h-full object-contain mix-blend-multiply" />
                      ) : (
                          <span className="text-[10px] text-slate-400">فاقد امضا</span>
                      )}
                    </div>
                </div>
            </div>
            <DeveloperFooter />
        </div>
    );
};

const ReceiptUniversalTemplate = ({ data, docCompany, trackingCode, qrCode, theme }: any) => {
    const isDebit = Boolean(data.isDebit); // بدهکار = پرداخت به شخص / بستانکار = دریافت از شخص
    const title = data.title || (isDebit ? 'رسید رسمی پرداخت وجه / هزینه' : 'رسید رسمی دریافت وجه');

    return (
        <div className="p-10 bg-white min-h-[297mm] flex flex-col text-slate-900 font-sans" dir="rtl">
            {/* Header Area */}
            <div className="flex justify-between items-start mb-8 border-b-4 border-slate-900 pb-6">
                <div className="flex items-center gap-6">
                    <div className="w-24 h-24 bg-slate-900 rounded-3xl flex items-center justify-center text-white shadow-xl overflow-hidden">
                        {docCompany.logo ? <img src={docCompany.logo} className="w-full h-full object-contain p-2" alt="لوگو" /> : <ShieldCheck size={48}/>}
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-950 tracking-tight">{docCompany.name}</h1>
                        <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mt-1">
                            {docCompany.legalName || 'سامانه ابری مدیریت مالی و حسابداری'}
                        </p>
                        <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-600">
                            {docCompany.phone && <span>تلفن: {toPersianDigits(docCompany.phone)}</span>}
                            {docCompany.address && <span>نشانی: {docCompany.address}</span>}
                            {docCompany.economicCode && <span>کد اقتصادی: {toPersianDigits(docCompany.economicCode)}</span>}
                        </div>
                    </div>
                </div>
                <div className="text-left flex flex-col items-end">
                    <div className={`text-white px-6 py-2.5 rounded-2xl text-base font-black mb-3 ${isDebit ? 'bg-rose-700' : 'bg-emerald-700'}`}>
                        {title}
                    </div>
                    <div className="font-mono text-sm text-slate-600">شماره سند: {toPersianDigits(trackingCode)}</div>
                    <div className="text-xs text-slate-500 mt-1">
                        تاریخ: {toPersianDigits(data.date || getPersianDate())}
                        {data.time ? ` - ساعت ${toPersianDigits(data.time)}` : ''}
                    </div>
                    <div className="mt-3">
                        <img src={qrCode} className="w-16 h-16 border border-slate-200 p-1 rounded-xl bg-white" alt="QR سند" />
                    </div>
                </div>
            </div>

            {/* Entity Card */}
            <div className="bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-200 mb-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-black block mb-1">طرف حساب:</span>
                        <span className="text-lg font-black text-slate-900">{data.personName || 'نامشخص'}</span>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-black block mb-1">شماره تماس:</span>
                        <span className="text-base font-black font-mono text-slate-800">{toPersianDigits(data.personPhone || '---')}</span>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-black block mb-1">کد / شناسه طرف حساب:</span>
                        <span className="text-base font-black font-mono text-slate-800">{toPersianDigits(data.personNationalId || data.personCode || data.personId || '---')}</span>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-black block mb-1">شرح و بابت سند مالی:</span>
                    <span className="text-sm font-bold text-slate-900 leading-6">{data.description || 'تسویه حساب و واریز مالی'}</span>
                </div>
            </div>

            {/* Amount Box */}
            <div className={`p-6 rounded-[2rem] text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 ${isDebit ? 'bg-slate-900 border-2 border-rose-900' : 'bg-slate-900 border-2 border-emerald-900'}`}>
                <div>
                    <span className="text-xs text-slate-400 font-black block mb-1">
                        مبلغ قطعی {isDebit ? 'پرداختی' : 'دریافتی'}:
                    </span>
                    <span className="text-sm text-slate-300 font-bold">
                        {isDebit ? 'از حساب شرکت پرداخت گردید به نام طرف‌حساب فوق' : 'از طرف‌حساب فوق به صندوق شرکت تحویل گردید'}
                    </span>
                </div>
                <div className="text-left font-mono">
                    <div className={`text-3xl font-black tracking-tight ${isDebit ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {formatCurrency(data.amount || 0)}
                    </div>
                    <div className="text-xs text-amber-300 font-sans font-bold mt-1">
                        {toPersianDigits(Math.round((data.amount || 0) / 10).toLocaleString())} تومان
                    </div>
                </div>
            </div>

            {/* Financial Status Summary */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-black block mb-1">نوع عملیات مالی:</span>
                    <span className="text-sm font-black text-slate-800">
                        {isDebit ? 'پرداخت / خروج وجه (بدهکار طرف‌حساب)' : 'دریافت / ورود وجه (بستانکار طرف‌حساب)'}
                    </span>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-black block mb-1">فاکتور مرتبط:</span>
                    <span className="text-sm font-black text-slate-800">
                        {data.relatedInvoiceNumber ? `فاکتور شماره ${toPersianDigits(data.relatedInvoiceNumber)}` : 'بدون فاکتور مستقیم'}
                    </span>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 col-span-2 md:col-span-1">
                    <span className="text-[10px] text-slate-400 font-black block mb-1">مانده حساب پس از سند:</span>
                    <span className="text-sm font-black font-mono text-slate-900">
                        {data.balanceAfter !== undefined ? (
                            <>
                                {formatCurrency(Math.abs(data.balanceAfter))}
                                <span className="text-xs mr-1 text-slate-500 font-sans">
                                    {data.balanceAfter > 0 ? '(بدهکار)' : data.balanceAfter < 0 ? '(بستانکار)' : '(تسویه)'}
                                </span>
                            </>
                        ) : '---'}
                    </span>
                </div>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 border-t-2 border-slate-200 pt-8 mt-auto">
                <div className="text-center">
                    <p className="text-[10px] font-black text-slate-500 mb-2">مهر و امضای صندوق‌دار / مدیریت شرکت</p>
                    <div className="h-28 bg-slate-50 border border-dashed border-slate-200 rounded-xl flex items-center justify-center p-3 relative">
                        {docCompany.signature && (
                            <img src={docCompany.signature} className="h-20 max-w-full object-contain mix-blend-multiply z-10" alt="امضای شرکت" />
                        )}
                        {docCompany.stamp && (
                            <img src={docCompany.stamp} className="absolute right-4 bottom-2 h-16 w-16 object-contain mix-blend-multiply opacity-85 z-20" alt="مهر شرکت" />
                        )}
                        {!docCompany.signature && !docCompany.stamp && (
                            <span className="text-[10px] text-slate-400">امضا و مهر رسمی</span>
                        )}
                    </div>
                </div>
                <div className="text-center">
                    <p className="text-[10px] font-black text-slate-500 mb-2">امضا و تایید طرف‌حساب ({data.personName || 'دریافت‌کننده/پرداخت‌کننده'})</p>
                    <div className="h-28 bg-slate-50 border border-dashed border-slate-200 rounded-xl flex items-center justify-center p-3">
                        {data.signature ? (
                            <img src={data.signature} className="h-full object-contain mix-blend-multiply" alt="امضای شخص" />
                        ) : (
                            <span className="text-[10px] text-slate-400">امضا و اثر انگشت</span>
                        )}
                    </div>
                </div>
            </div>

            <DeveloperFooter />
        </div>
    );
};
