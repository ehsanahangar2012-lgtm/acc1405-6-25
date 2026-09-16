import React, { useState, useRef } from 'react';
import { useStore } from '../store';
import PersonLedgerService from '../services/personLedgerService';
import { FileText, TrendingUp, TrendingDown, Calendar, Eye, Receipt, Package, CreditCard, ArrowUpRight, ArrowDownLeft, Printer, X, Download, Camera, ArrowLeft, FileSpreadsheet } from 'lucide-react';
import { formatCurrency, toPersianDigits, generatePdfBlob, downloadPdfBlob, getPersianDate } from '../utils';
import { InvoiceType } from '../types';
import { Timeline } from './Timeline';
import { JalaliDatePicker } from './Shared';
import { CardexPrint } from './CardexPrint';
import { PrintTemplate } from './PrintTemplates';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import { ExcelExportService } from '../services/excelExportService';

interface PersonLedgerProps {
    personId: string;
    hideHeader?: boolean;
}

export const PersonLedger: React.FC<PersonLedgerProps> = ({ personId, hideHeader = false }) => {
    const { people, invoices, vouchers, checks, checkTransfers, companies, transactions } = useStore();
    const person = people.find(p => p.id === personId);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');
    
    // Canva Print System States
    const [showPrintPreview, setShowPrintPreview] = useState(false);
    const [printTheme, setPrintTheme] = useState<'modern' | 'minimal' | 'teal' | 'navy'>('modern');
    const [downloadingPDF, setDownloadingPDF] = useState(false);
    const [downloadingImage, setDownloadingImage] = useState(false);
    const cardexRef = useRef<HTMLDivElement>(null);

    // Document Popup Preview Modal State
    const [activeDocPreview, setActiveDocPreview] = useState<{
        type: 'INVOICE' | 'VOUCHER' | 'CHECK' | 'CHECK_TRANSFER' | 'RECEIPT';
        data: any;
        title: string;
    } | null>(null);
    
    if (!person) return null;
    
    const report = PersonLedgerService.getReport(personId, fromDate, toDate);
    
    // Group transactions by invoice
    const groupedEntries: any[] = [];
    const processedIds = new Set();
    
    report.entries.forEach(entry => {
        if (processedIds.has(entry.id)) return;
        
        if (entry.type === 'INVOICE') {
            groupedEntries.push({ ...entry, isParent: true });
            processedIds.add(entry.id);
            
            // Find related transactions
            const related = report.entries.filter(e => 
                e.relatedInvoiceId === entry.referenceId && e.id !== entry.id
            );
            
            related.forEach(r => {
                groupedEntries.push({ ...r, isChild: true });
                processedIds.add(r.id);
            });
        } else if (!entry.relatedInvoiceId) {
            groupedEntries.push(entry);
            processedIds.add(entry.id);
        }
    });

    // اضافه کردن هرگونه تراکنش یا پرداختی که فاکتور والد آن خارج از فیلتر تاریخ بوده است
    report.entries.forEach(entry => {
        if (!processedIds.has(entry.id)) {
            groupedEntries.push(entry);
            processedIds.add(entry.id);
        }
    });
    
    const handleViewDoc = (entry: any) => {
        if (!entry) return;

        // ۱. فاکتور (INVOICE)
        if (entry.type === 'INVOICE') {
            const inv = invoices.find(i => i.id === entry.referenceId || i.id === entry.relatedInvoiceId)
                     || (entry.referenceNumber ? invoices.find(i => String(i.number) === String(entry.referenceNumber)) : null);
            if (inv) {
                setActiveDocPreview({
                    type: 'INVOICE',
                    data: inv,
                    title: `فاکتور ${inv.type === InvoiceType.PURCHASE ? 'خرید' : 'فروش'} شماره ${toPersianDigits(inv.number)}`
                });
                return;
            }
        }

        // ۲. حواله انبار (VOUCHER_INFO)
        if (entry.type === 'VOUCHER_INFO') {
            const v = vouchers.find(v => v.id === entry.referenceId || v.id === entry.relatedInvoiceId)
                   || (entry.referenceNumber ? vouchers.find(v => String(v.number) === String(entry.referenceNumber) || v.trackingCode === entry.referenceNumber) : null);
            if (v) {
                const typeLabel = v.type === 'IN' ? 'ورود به انبار' : v.type === 'OUT' ? 'خروج از انبار' : 'مرجوعی کالا';
                setActiveDocPreview({
                    type: 'VOUCHER',
                    data: v,
                    title: `حواله ${typeLabel} شماره ${toPersianDigits(v.number)}`
                });
                return;
            }
        }

        // ۳. سند یا لاشه چک (CHECK یا CHECK_PAYMENT)
        if (entry.type === 'CHECK' || entry.type === 'CHECK_PAYMENT') {
            // چک مستقل در مخزن چک‌ها
            const check = checks.find(c => c.id === entry.referenceId || c.sayadId === entry.referenceNumber || c.checkNumber === entry.referenceNumber);
            if (check) {
                setActiveDocPreview({
                    type: 'CHECK',
                    data: check,
                    title: `رسید لاشه چک صیادی - بانک ${check.bankName || ''}`
                });
                return;
            }

            // چک واگذار شده
            const transfer = checkTransfers.find(t => t.id === entry.referenceId || t.checkIds?.includes(entry.referenceId));
            if (transfer) {
                setActiveDocPreview({
                    type: 'CHECK_TRANSFER',
                    data: transfer,
                    title: `رسید واگذاری چک شماره ${toPersianDigits(transfer.number)}`
                });
                return;
            }

            // چک ثبت شده درون فاکتور
            if (entry.relatedInvoiceId || entry.referenceId) {
                const inv = invoices.find(i => i.id === entry.relatedInvoiceId || i.id === entry.referenceId);
                const invCheck = inv?.checks?.find((c: any) => c.id === entry.referenceId || c.sayadId === entry.referenceNumber || c.checkNumber === entry.referenceNumber) || inv?.checks?.[0];
                if (invCheck) {
                    setActiveDocPreview({
                        type: 'CHECK',
                        data: {
                            ...invCheck,
                            personName: person.name,
                            holderName: invCheck.holderName || person.name,
                            bankName: invCheck.bankName || 'بانک',
                            amount: invCheck.amount || entry.credit || entry.debit || 0,
                            dueDate: invCheck.dueDate || entry.date,
                            status: invCheck.status || 'IN_BOX',
                            imageUrl: invCheck.imageUrl || entry.imageUrl
                        },
                        title: `رسید لاشه چک - بانک ${invCheck.bankName || ''}`
                    });
                    return;
                }
            }

            // لاشه چک سنتز شده بر اساس ردیف کاردکس
            const synthCheck = {
                id: entry.referenceId || entry.id,
                sayadId: entry.referenceNumber || '',
                bankName: entry.description?.match(/بانک\s+([^\s()]+)/)?.[1] || 'بانک',
                amount: entry.credit || entry.debit || 0,
                dueDate: entry.date,
                issueDate: entry.date,
                personName: person.name,
                holderName: person.name,
                status: 'IN_BOX',
                imageUrl: entry.imageUrl,
                description: entry.description
            };
            setActiveDocPreview({
                type: 'CHECK',
                data: synthCheck,
                title: `رسید لاشه چک - ${synthCheck.bankName}`
            });
            return;
        }

        // ۴. تراکنش‌های مالی، دریافت و پرداخت (PAYMENT یا هر سند دیگر)
        const trans = (transactions || []).find(t => t.id === entry.referenceId);
        const relatedInv = entry.relatedInvoiceId ? invoices.find(i => i.id === entry.relatedInvoiceId) : null;
        const isDebit = typeof trans?.isDebit === 'boolean' ? trans.isDebit : (entry.debit > 0);
        const activeComp = companies.find(c => c.isActive) || companies[0];

        const receiptData = {
            id: trans?.id || entry.id,
            trackingCode: trans?.trackingCode || entry.referenceNumber || `REC-${toPersianDigits(entry.date?.replace(/\//g, '') || '0')}`,
            date: trans?.date || entry.date,
            time: trans?.metadata?.time || '',
            amount: trans?.amount || entry.credit || entry.debit || 0,
            isDebit,
            personName: person.name,
            personPhone: person.phone,
            personNationalId: person.nationalId,
            personCode: person.code,
            description: trans?.description || entry.description,
            balanceAfter: trans?.balanceAfter !== undefined ? trans.balanceAfter : entry.balance,
            signature: trans?.signature,
            relatedInvoiceNumber: relatedInv?.number,
            companyId: trans?.companyId || activeComp?.id,
            company: activeComp
        };

        setActiveDocPreview({
            type: 'RECEIPT',
            data: receiptData,
            title: `رسید رسمی ${isDebit ? 'پرداخت' : 'دریافت'} وجه`
        });
    };

    const getTransactionBadge = (entry: any) => {
        switch (entry.type) {
            case 'INVOICE':
                return entry.debit > 0 ? (
                    <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 px-2 py-1 rounded-lg text-xs font-black">
                        <TrendingUp size={12} />
                        <span>فاکتور فروش (بدهکار +)</span>
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-400 px-2 py-1 rounded-lg text-xs font-black">
                        <TrendingDown size={12} />
                        <span>فاکتور خرید (بستانکار -)</span>
                    </span>
                );
            case 'PAYMENT':
                return entry.credit > 0 ? (
                    <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-lg text-xs font-black">
                        <TrendingDown size={12} />
                        <span>دریافتی از مشتری (بستانکار -)</span>
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-400 px-2 py-1 rounded-lg text-xs font-black">
                        <TrendingUp size={12} />
                        <span>پرداختی به مشتری (بدهکار +)</span>
                    </span>
                );
            case 'CHECK':
                return entry.credit > 0 ? (
                    <span className="inline-flex items-center gap-1 bg-purple-500/10 text-purple-400 px-2 py-1 rounded-lg text-xs font-black">
                        <TrendingDown size={12} />
                        <span>چک دریافتی (بستانکار -)</span>
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-400 px-2 py-1 rounded-lg text-xs font-black">
                        <TrendingUp size={12} />
                        <span>چک پرداختی (بدهکار +)</span>
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-400 px-2 py-1 rounded-lg text-xs font-black">
                        <FileText size={12} />
                        <span>سند حسابداری</span>
                    </span>
                );
        }
    };

    // Canva Download Action Handlers
    const handleDownloadPDF = async () => {
        if (!cardexRef.current) return;
        setDownloadingPDF(true);
        try {
            const pdfBlob = await generatePdfBlob(cardexRef.current);
            downloadPdfBlob(pdfBlob, `کاردکس-${person.name}-${toPersianDigits(new Date().toLocaleDateString('fa-IR'))}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('خطا در دانلود PDF کاردکس.');
        } finally {
            setDownloadingPDF(false);
        }
    };

    const handleDownloadImage = async () => {
        if (!cardexRef.current) return;
        setDownloadingImage(true);
        try {
            const element = cardexRef.current;
            const originalShadow = element.style.boxShadow;
            element.style.boxShadow = 'none';

            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                width: element.scrollWidth,
                height: element.scrollHeight,
                scrollX: 0,
                scrollY: 0
            });
            element.style.boxShadow = originalShadow;

            const link = document.createElement('a');
            link.download = `کاردکس-${person.name}-${toPersianDigits(new Date().toLocaleDateString('fa-IR'))}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (error) {
            console.error('Error generating Image:', error);
            alert('خطا در دانلود تصویر کاردکس.');
        } finally {
            setDownloadingImage(false);
        }
    };
    
    return (
        <div className="space-y-6">
            {!hideHeader && (
                <div className="bg-slate-900 border border-white/10 rounded-3xl p-8">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-black text-white">{person.name}</h2>
                            <p className="text-slate-400 text-sm">کاردکس حساب</p>
                        </div>
                        <div className={`text-3xl font-black ${report.finalBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {formatCurrency(Math.abs(report.finalBalance))}
                            <span className="text-sm block text-slate-500">
                                {report.finalBalance >= 0 ? 'بدهکار' : 'بستانکار'}
                            </span>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
                            <div className="flex items-center gap-2 text-blue-400 mb-2">
                                <TrendingUp size={18} />
                                <span className="text-xs font-bold">بدهکار</span>
                            </div>
                            <div className="text-white font-black text-lg">{formatCurrency(report.totalDebit)}</div>
                        </div>
                        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4">
                            <div className="flex items-center gap-2 text-rose-400 mb-2">
                                <TrendingDown size={18} />
                                <span className="text-xs font-bold">بستانکار</span>
                            </div>
                            <div className="text-white font-black text-lg">{formatCurrency(report.totalCredit)}</div>
                        </div>
                        <div className="bg-slate-800 border border-white/10 rounded-2xl p-4">
                            <div className="flex items-center gap-2 text-slate-400 mb-2">
                                <FileText size={18} />
                                <span className="text-xs font-bold">تعداد اسناد</span>
                            </div>
                            <div className="text-white font-black text-lg">{toPersianDigits(report.entries.length)}</div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* View Mode controls & Date picker filters */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-slate-900/60 p-4 border border-white/5 rounded-3xl no-print text-slate-200">
                <div className="flex bg-slate-950/50 p-1 rounded-xl border border-white/5 self-start gap-1">
                    <button onClick={() => setViewMode('table')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${viewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>جدول</button>
                    <button onClick={() => setViewMode('timeline')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${viewMode === 'timeline' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>تایملاین</button>
                </div>
                
                <div className="flex flex-wrap gap-2 items-center">
                    <button 
                        onClick={() => setShowPrintPreview(true)} 
                        className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 active:scale-95 shadow-lg shadow-teal-600/10 self-start md:self-auto"
                    >
                        <Printer size={15} />
                        <span>چاپ کاردکس حساب (تم Canva)</span>
                    </button>

                    <button 
                        onClick={() => {
                            const activeCompany = companies.find(c => c.isActive) || companies[0];
                            ExcelExportService.exportPersonLedgerToExcel({
                                person,
                                company: activeCompany,
                                entries: report.entries,
                                totalDebit: report.totalDebit,
                                totalCredit: report.totalCredit,
                                finalBalance: report.finalBalance,
                                fromDate,
                                toDate
                            });
                        }}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 active:scale-95 shadow-lg shadow-emerald-600/10 self-start md:self-auto"
                        title="استخراج فایل اکسل استاندارد برای ارائه به حسابرس و اداره مالیات"
                    >
                        <FileSpreadsheet size={15} />
                        <span>خروجی اکسل استاندارد (مالیاتی)</span>
                    </button>
                </div>

                <div className="flex flex-wrap md:flex-nowrap gap-2 items-center text-slate-900 w-full md:w-auto">
                    <div className="w-[140px] md:w-[160px]">
                        <JalaliDatePicker value={fromDate} onChange={setFromDate} label="از تاریخ" />
                    </div>
                    <div className="w-[140px] md:w-[160px]">
                        <JalaliDatePicker value={toDate} onChange={setToDate} label="تا تاریخ" />
                    </div>
                    {(fromDate || toDate) && (
                        <button onClick={() => { setFromDate(''); setToDate(''); }} className="mt-5 px-3 py-3.5 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all text-xs font-bold shrink-0">حذف فیلتر</button>
                    )}
                </div>
            </div>
            
            {viewMode === 'timeline' ? (
                <div className="bg-slate-900 border border-white/10 rounded-3xl p-6">
                    <Timeline transactions={report.entries} onItemClick={handleViewDoc} />
                </div>
            ) : (
                <div className="bg-slate-900 border border-white/10 rounded-3xl overflow-hidden overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                        <thead className="bg-white/5 border-b border-white/10">
                            <tr className="text-slate-400 text-xs font-black">
                                <th className="p-4 text-right">تاریخ</th>
                                <th className="p-4 text-right">نوع سند</th>
                                <th className="p-4 text-right">شرح</th>
                                <th className="p-4 text-right">شماره سند</th>
                                <th className="p-4 text-left">بدهکار (+)</th>
                                <th className="p-4 text-left">بستانکار (-)</th>
                                <th className="p-4 text-left">مانده بروز (الباقی)</th>
                                <th className="p-4 text-center no-print">عملیات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-slate-200">
                            {groupedEntries.map(entry => (
                                <tr key={entry.id} className={`hover:bg-white/5 transition-colors ${entry.isChild ? 'bg-slate-800/50' : ''}`}>
                                    <td className="p-4 text-slate-400 text-sm font-mono">{toPersianDigits(entry.date)}</td>
                                    <td className="p-4">{getTransactionBadge(entry)}</td>
                                    <td className={`p-4 text-white text-sm font-bold ${entry.isChild ? 'pr-8' : ''}`}>
                                        {entry.isChild && <span className="text-slate-600 mr-2">└─</span>}
                                        {entry.description}
                                        {entry.type === 'VOUCHER_INFO' && <span className="text-xs text-blue-400 mr-2">(اطلاع)</span>}
                                    </td>
                                    <td className="p-4 text-slate-500 text-xs font-mono">{toPersianDigits(entry.referenceNumber || '---')}</td>
                                    <td className="p-4 text-left text-emerald-400 font-mono font-bold">
                                        {entry.debit > 0 ? `+ ${formatCurrency(entry.debit)}` : '-'}
                                    </td>
                                    <td className="p-4 text-left text-rose-400 font-mono font-bold">
                                        {entry.credit > 0 ? `- ${formatCurrency(entry.credit)}` : '-'}
                                    </td>
                                    <td className={`p-4 text-left font-black font-mono ${entry.balance >= 0 ? 'text-white' : 'text-orange-400'}`}>
                                        {formatCurrency(Math.abs(entry.balance))}
                                        <span className="text-xs mr-2 text-slate-500 font-sans font-bold">
                                            {entry.balance > 0 ? '(بدهکار)' : entry.balance < 0 ? '(بستانکار)' : '(تسویه)'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center no-print">
                                        <button 
                                            onClick={() => handleViewDoc(entry)} 
                                            className="p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-600 hover:text-white rounded-lg transition-all flex items-center justify-center mx-auto" 
                                            title="نمایش و چاپ رسید سند (پاپ‌آپ)"
                                        >
                                            {entry.type === 'INVOICE' ? <Receipt size={16}/> : entry.type === 'VOUCHER_INFO' ? <Package size={16}/> : (entry.type === 'CHECK_PAYMENT' || entry.type === 'CHECK') ? <CreditCard size={16}/> : <Eye size={16}/>}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Document Pop-up Preview Portal */}
            {activeDocPreview && createPortal(
                <div className="fixed inset-0 z-7000 bg-slate-950 flex flex-col animate-fade-in print-preview-modal print:static print:bg-white print:block print:h-auto print:overflow-visible" style={{ direction: 'rtl' }}>
                    <header className="w-full bg-slate-900 border-b border-white/10 p-4 md:p-5 flex justify-between items-center z-10 px-4 md:px-8 shadow-2xl shrink-0 no-print">
                        <div className="flex items-center gap-3 md:gap-4">
                            <button 
                                onClick={() => setActiveDocPreview(null)} 
                                className="bg-white/5 text-white p-3 rounded-2xl hover:bg-rose-600 transition-all shadow-lg active:scale-90 flex items-center justify-center shrink-0" 
                                title="بستن (Esc)"
                            >
                                <ArrowLeft size={20}/>
                            </button>
                            <div className="flex flex-col">
                                <h2 className="text-white font-black text-base md:text-lg">{activeDocPreview.title}</h2>
                                <p className="text-slate-500 text-[10px] font-black uppercase mt-0.5">مشاهده و چاپ رسید سند مالی</p>
                            </div>
                        </div>
                        <div className="flex gap-2 items-center">
                            <button 
                                onClick={() => window.print()} 
                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 md:px-8 py-2.5 md:py-3 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all flex items-center gap-2"
                            >
                                <Printer size={18}/>
                                <span>چاپ رسید</span>
                            </button>
                            <button 
                                onClick={() => setActiveDocPreview(null)} 
                                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 md:py-3 rounded-2xl font-black text-xs transition-all flex items-center gap-1.5"
                            >
                                <X size={18}/>
                                <span className="hidden sm:inline">بستن</span>
                            </button>
                        </div>
                    </header>

                    <div className="flex-1 w-full overflow-y-auto p-4 md:p-12 flex flex-col items-center bg-[#020617] custom-scrollbar print:p-0 print:bg-white print:overflow-visible print:block">
                        <div className="relative mb-24 w-full md:w-auto print-content print:mb-0" style={{ width: 'min(100%, 215mm)' }}>
                            <div className="bg-white shadow-[0_60px_150px_rgba(0,0,0,0.8)] rounded-none md:rounded-sm overflow-hidden print:shadow-none">
                                <PrintTemplate 
                                    data={activeDocPreview.data} 
                                    theme="official" 
                                    type={activeDocPreview.type} 
                                />
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Canva Print Preview Portal */}
            {showPrintPreview && createPortal(
                <div className="fixed inset-0 z-7000 bg-slate-950 flex flex-col animate-fade-in print-preview-modal print:static print:bg-white print:block print:h-auto print:overflow-visible" style={{ direction: 'rtl' }}>
                    <header className="w-full bg-slate-900 border-b border-white/10 p-5 flex justify-between items-center z-10 px-8 shadow-2xl shrink-0 no-print">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setShowPrintPreview(false)} className="bg-white/5 text-white p-3 rounded-2xl hover:bg-rose-600 transition-all shadow-lg active:scale-90 flex items-center justify-center shrink-0" title="بازگشت (Esc)"><ArrowLeft size={20}/></button>
                            <div className="flex flex-col">
                                <h2 className="text-white font-black text-lg">پیش‌نمایش و چاپ کاردکس حساب</h2>
                                <p className="text-slate-500 text-[9px] font-black uppercase mt-1">Canva Financial Statement Preview</p>
                            </div>
                        </div>
                        <div className="flex gap-2 items-center">
                            <select 
                                className="bg-slate-800 border border-white/10 rounded-2xl px-4 py-3 text-white text-[10px] font-black outline-none focus:border-teal-500 shadow-inner" 
                                value={printTheme} 
                                onChange={e => setPrintTheme(e.target.value as any)}
                            >
                                <option value="modern">🎨 تم سرمه‌ای مدرن (Canva)</option>
                                <option value="teal">🌊 تم فیروزه‌ای زیبا</option>
                                <option value="navy">🏛️ تم سورمه‌ای کلاسیک</option>
                                <option value="minimal">🖤 تم مشکی مینیمال</option>
                            </select>
                            
                            <button 
                                onClick={handleDownloadPDF} 
                                disabled={downloadingPDF}
                                className="bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white px-4 py-3 rounded-2xl font-black text-xs shadow-xl active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 border border-rose-500/10"
                            >
                                {downloadingPDF ? (
                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <FileText size={16}/>
                                )}
                                <span>دانلود PDF</span>
                            </button>
                            
                            <button 
                                onClick={handleDownloadImage} 
                                disabled={downloadingImage}
                                className="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white px-4 py-3 rounded-2xl font-black text-xs shadow-xl active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 border border-blue-500/10"
                            >
                                {downloadingImage ? (
                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <Camera size={16}/>
                                )}
                                <span>دانلود تصویر</span>
                            </button>
                            
                            <button 
                                onClick={() => window.print()} 
                                className="bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all flex items-center gap-2"
                            >
                                <Printer size={20}/>
                                <span>چاپ سند</span>
                            </button>
                        </div>
                    </header>

                    <div className="flex-1 w-full overflow-y-auto p-4 md:p-12 flex flex-col items-center bg-[#020617] custom-scrollbar print:p-0 print:bg-white print:overflow-visible print:block">
                        <div className="relative mb-24 w-full md:w-auto print-content print:mb-0" style={{ width: 'min(100%, 215mm)' }}>
                            <div ref={cardexRef} className="bg-white shadow-[0_60px_150px_rgba(0,0,0,0.8)] rounded-none md:rounded-sm overflow-visible print-content print:shadow-none">
                                <CardexPrint 
                                    person={person}
                                    entries={groupedEntries}
                                    summary={{
                                        totalDebit: report.totalDebit,
                                        totalCredit: report.totalCredit,
                                        finalBalance: report.finalBalance
                                    }}
                                    fromDate={fromDate}
                                    toDate={toDate}
                                    theme={printTheme}
                                />
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
