import React from 'react';
import { Person, PrintTheme, CompanyProfile } from '../types';
import { toPersianDigits, formatCurrency } from '../utils';
import { useStore } from '../store';
import { FileText, TrendingUp, TrendingDown, Calendar, Phone, MapPin, Landmark, Award, ClipboardList, PenTool, CheckSquare } from 'lucide-react';
import { DocumentTrialWatermarkFooter } from './DocumentTrialWatermarkFooter';

interface CardexPrintProps {
    person: Person;
    entries: any[];
    summary: {
        totalDebit: number;
        totalCredit: number;
        finalBalance: number;
    };
    fromDate?: string;
    toDate?: string;
    theme?: 'modern' | 'minimal' | 'teal' | 'navy';
}

export const CardexPrint: React.FC<CardexPrintProps> = ({ 
    person, 
    entries, 
    summary, 
    fromDate, 
    toDate, 
    theme = 'modern' 
}) => {
    const { companies, checks } = useStore();
    const activeCompany = (companies.find(c => c.isActive) || companies[0] || {
        id: 'default',
        name: 'اشک قلم',
        phone: '۰۲۱',
        address: 'تهران، ایران',
        legalName: 'شرکت مهندسی اشک قلم',
        logo: null,
        stamp: null,
        signature: null,
        isActive: true
    }) as CompanyProfile;

    // Style map based on theme
    const styles = {
        modern: {
            primary: 'bg-indigo-900',
            text: 'text-indigo-900',
            border: 'border-indigo-100',
            lightBg: 'bg-indigo-50/50',
            accent: 'text-indigo-600',
            headerText: 'text-white'
        },
        minimal: {
            primary: 'bg-slate-900',
            text: 'text-slate-900',
            border: 'border-slate-200',
            lightBg: 'bg-slate-50',
            accent: 'text-slate-600',
            headerText: 'text-white'
        },
        teal: {
            primary: 'bg-teal-800',
            text: 'text-teal-800',
            border: 'border-teal-100',
            lightBg: 'bg-teal-50/50',
            accent: 'text-teal-600',
            headerText: 'text-white'
        },
        navy: {
            primary: 'bg-sky-950',
            text: 'text-sky-950',
            border: 'border-sky-100',
            lightBg: 'bg-sky-50/40',
            accent: 'text-sky-700',
            headerText: 'text-white'
        }
    }[theme];

    const balanceStatus = summary.finalBalance > 0 
        ? 'بدهکار (به شرکت)' 
        : summary.finalBalance < 0 
        ? 'بستانکار (طلبکار)' 
        : 'تسویه شده';

    const balanceColor = summary.finalBalance > 0 
        ? 'text-emerald-700' 
        : summary.finalBalance < 0 
        ? 'text-rose-700' 
        : 'text-slate-600';

    return (
        <div className="p-8 md:p-12 bg-white text-slate-800 font-sans print:p-4 print-cardex-page" dir="rtl" style={{ minHeight: '297mm', width: '100%' }}>
            {/* Canva Style Letterhead */}
            <div className="flex justify-between items-start mb-8 border-b-4 border-slate-900 pb-6">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg">
                        {activeCompany.logo ? (
                            <img src={activeCompany.logo} className="w-full h-full object-contain p-1.5" alt="Logo" />
                        ) : (
                            <Award size={36} className="text-amber-400" />
                        )}
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">{activeCompany.name}</h1>
                        <p className="text-[10px] text-slate-500 font-bold tracking-widest mt-0.5">{activeCompany.legalName || 'Official Statement of Account'}</p>
                        <div className="flex gap-4 mt-2 text-[9px] font-bold text-slate-600">
                            <span className="flex items-center gap-1"><Phone size={12}/> {toPersianDigits(activeCompany.phone)}</span>
                            <span className="flex items-center gap-1"><MapPin size={12}/> {activeCompany.address}</span>
                        </div>
                    </div>
                </div>

                <div className="text-left flex flex-col items-end">
                    <div className={`${styles.primary} ${styles.headerText} px-6 py-2.5 rounded-xl text-md font-black shadow-md uppercase tracking-wider mb-2`}>
                        صورتحساب و کاردکس مالی
                    </div>
                    <div className="text-[9px] font-bold text-slate-400 space-y-0.5 text-right">
                        <div>تاریخ گزارش: <span className="font-mono font-bold text-slate-700">{toPersianDigits(new Date().toLocaleDateString('fa-IR'))}</span></div>
                        {(fromDate || toDate) && (
                            <div>بازه گزارش: <span className="font-mono font-bold text-slate-700">
                                {fromDate ? toPersianDigits(fromDate) : 'ابتدا'} تا {toDate ? toPersianDigits(toDate) : 'اکنون'}
                            </span></div>
                        )}
                        <div>کد مشتری: <span className="font-mono font-bold text-slate-700">{toPersianDigits(person.code || '---')}</span></div>
                    </div>
                </div>
            </div>

            {/* Customer Details Box */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className={`p-5 rounded-2xl border ${styles.border} ${styles.lightBg}`}>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">مشخصات طرف حساب:</span>
                    <h2 className="text-lg font-black text-slate-900">{person.name}</h2>
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600 mt-2 font-bold">
                        <div>تلفن همراه: <span className="font-mono text-slate-800">{person.phone ? toPersianDigits(person.phone) : '---'}</span></div>
                        <div>دسته بندی: <span className="text-slate-800">{person.category || 'مشتری'}</span></div>
                        {person.nationalId && <div>کد ملی: <span className="font-mono text-slate-800">{toPersianDigits(person.nationalId)}</span></div>}
                    </div>
                </div>

                {/* Account Balances Summary Card (Canva Style Grid Panels) */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
                        <span className="text-[8px] font-black text-slate-400 block mb-1">جمع کل بدهکار (+)</span>
                        <div>
                            <span className="text-xs font-black text-slate-900 block">{formatCurrency(summary.totalDebit)}</span>
                            <span className="text-[7px] text-slate-500 font-bold block mt-1">تعهدات پرداخت شده</span>
                        </div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
                        <span className="text-[8px] font-black text-slate-400 block mb-1">جمع کل بستانکار (-)</span>
                        <div>
                            <span className="text-xs font-black text-slate-900 block">{formatCurrency(summary.totalCredit)}</span>
                            <span className="text-[7px] text-slate-500 font-bold block mt-1">دریافتی‌های مالی</span>
                        </div>
                    </div>
                    <div className={`${styles.lightBg} border ${styles.border} rounded-2xl p-4 flex flex-col justify-between shadow-xs`}>
                        <span className="text-[8px] font-black text-slate-400 block mb-1">مانده نهایی حساب</span>
                        <div>
                            <span className={`text-xs font-black block ${balanceColor}`}>{formatCurrency(Math.abs(summary.finalBalance))}</span>
                            <span className={`text-[7px] font-black block mt-1 ${balanceColor}`}>{balanceStatus}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Canvas Custom Designed Table */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm mb-12">
                <table className="w-full text-right text-[10px]">
                    <thead className={`${styles.primary} text-white`}>
                        <tr className="font-black">
                            <th className="p-3.5 text-center w-12">ردیف</th>
                            <th className="p-3.5 w-24">تاریخ سند</th>
                            <th className="p-3.5 w-28">نوع سند</th>
                            <th className="p-3.5">شرح تراکنش مالی</th>
                            <th className="p-3.5 text-center w-20">شماره سند</th>
                            <th className="p-3.5 text-left w-32">بدهکار (+)</th>
                            <th className="p-3.5 text-left w-32">بستانکار (-)</th>
                            <th className="p-3.5 text-left w-36">مانده نهایی</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-bold">
                        {entries.map((entry, index) => {
                            const isInvoice = entry.type === 'INVOICE';
                            const isVoucher = entry.type === 'VOUCHER_INFO';
                            const isCheck = entry.type === 'CHECK' || entry.type === 'CHECK_PAYMENT';
                            const isChild = entry.isChild || isVoucher;
                            const checkImg = isCheck ? (entry.imageUrl || checks.find((c: any) => c.id === entry.referenceId || c.sayadId === entry.referenceNumber)?.imageUrl) : null;
                            
                            let docTypeLabel = 'سند حسابداری';
                            if (entry.type === 'INVOICE') {
                                docTypeLabel = entry.debit > 0 ? 'فاکتور فروش (بدهکار)' : 'فاکتور خرید (بستانکار)';
                            } else if (entry.type === 'PAYMENT' || entry.type === 'TRANSACTION') {
                                docTypeLabel = entry.credit > 0 ? 'دریافت از مشتری (بستانکار)' : 'پرداخت به طرف‌حساب (بدهکار)';
                            } else if (entry.type === 'CHECK' || entry.type === 'CHECK_PAYMENT') {
                                docTypeLabel = entry.credit > 0 ? 'چک دریافتی (بستانکار)' : 'چک پرداختی (بدهکار)';
                            } else if (isVoucher) {
                                docTypeLabel = 'حواله انبار (صرفاً اطلاع)';
                            }

                            return (
                                <tr key={entry.id} className={`hover:bg-slate-50/50 transition-colors ${isVoucher ? 'bg-amber-50/20' : isChild ? 'bg-slate-50/30' : ''}`}>
                                    <td className="p-3.5 text-center font-mono text-slate-400">{toPersianDigits(index + 1)}</td>
                                    <td className="p-3.5 font-mono text-slate-500">{toPersianDigits(entry.date)}</td>
                                    <td className="p-3.5">
                                        <span className={`px-2 py-0.5 rounded text-[8px] font-black ${
                                            isVoucher 
                                            ? 'bg-amber-50 text-amber-800 border border-amber-200' 
                                            : entry.debit > 0 
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                            : entry.credit > 0 
                                            ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                            : 'bg-slate-100 text-slate-600'
                                        }`}>
                                            {docTypeLabel}
                                        </span>
                                    </td>
                                    <td className={`p-3.5 text-slate-900 font-medium ${isVoucher ? 'pr-8 text-amber-900' : isChild ? 'pr-6 text-slate-500' : ''}`}>
                                        <div className="flex items-center gap-2">
                                            {isChild && <span className="text-slate-300">└─</span>}
                                            {checkImg && (
                                                <img 
                                                    src={checkImg} 
                                                    alt="تصویر چک" 
                                                    className="w-10 h-6 object-cover rounded border border-slate-300 shrink-0 shadow-xs inline-block" 
                                                />
                                            )}
                                            <span>{entry.description}</span>
                                        </div>
                                    </td>
                                    <td className="p-3.5 text-center font-mono text-slate-400">{toPersianDigits(entry.referenceNumber || '---')}</td>
                                    <td className="p-3.5 text-left font-mono font-black text-emerald-600">
                                        {isVoucher ? (
                                            <span className="text-slate-400 font-normal text-[9px] font-sans">---</span>
                                        ) : entry.debit > 0 ? (
                                            toPersianDigits(entry.debit.toLocaleString())
                                        ) : (
                                            '۰'
                                        )}
                                    </td>
                                    <td className="p-3.5 text-left font-mono font-black text-rose-600">
                                        {isVoucher ? (
                                            <span className="text-slate-400 font-normal text-[9px] font-sans">---</span>
                                        ) : entry.credit > 0 ? (
                                            toPersianDigits(entry.credit.toLocaleString())
                                        ) : (
                                            '۰'
                                        )}
                                    </td>
                                    <td className={`p-3.5 text-left font-mono font-black ${entry.balance >= 0 ? 'text-slate-900' : 'text-orange-600'}`}>
                                        {toPersianDigits(Math.abs(entry.balance).toLocaleString())}
                                        <span className="text-[8px] mr-1 text-slate-400 font-sans font-bold">
                                            {entry.balance > 0 ? '(بدهکار)' : entry.balance < 0 ? '(بستانکار)' : '(تسویه)'}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Signature Block (Canva Style Footer) */}
            <div className="grid grid-cols-3 gap-8 pt-8 border-t border-slate-200 text-center">
                <div className="flex flex-col items-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-2">تنظیم‌کننده صورتحساب</p>
                    <div className="h-24 w-full bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl flex items-center justify-center relative">
                        <span className="text-[7px] text-slate-400 font-mono absolute top-2">ACCOUNTANT</span>
                        {activeCompany.signature && (
                            <img src={activeCompany.signature} className="h-16 object-contain mix-blend-multiply opacity-80" alt="Signature" />
                        )}
                    </div>
                </div>

                <div className="flex flex-col items-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-2">تایید و امضای مدیریت</p>
                    <div className="h-24 w-full bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl flex items-center justify-center relative">
                        <span className="text-[7px] text-slate-400 font-mono absolute top-2">MANAGEMENT APPROVAL</span>
                        {activeCompany.stamp && (
                            <img src={activeCompany.stamp} className="h-16 object-contain mix-blend-multiply opacity-85" alt="Stamp" />
                        )}
                    </div>
                </div>

                <div className="flex flex-col items-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-2">امضا و تایید طرف حساب (مشتری)</p>
                    <div className="h-24 w-full bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl flex items-center justify-center relative">
                        <span className="text-[7px] text-slate-400 font-mono absolute top-2">CUSTOMER SIGNATURE</span>
                    </div>
                </div>
            </div>

            {/* Developer footer */}
            <div className="text-center mt-12 pt-4 border-t border-slate-100 text-[8px] font-bold text-slate-400">
                این سند به صورت رسمی توسط سیستم اشک قلم صادر گردیده و به منزله تاییدیه مالی رسمی است.
            </div>
            <DocumentTrialWatermarkFooter />
        </div>
    );
};
