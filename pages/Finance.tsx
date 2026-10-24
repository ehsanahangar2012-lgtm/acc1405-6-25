
import React, { useState, useRef } from 'react';
import { useStore } from '../store';
import { Transaction, InvoiceType } from '../types';
import { generateId, getPersianDate, toPersianDigits, formatCurrency } from '../utils';
import { Wallet, Briefcase, MinusCircle, PlusCircle, CreditCard, User, FileText, Send, Landmark, Trash2, PenTool, Eye, Share2, Printer, X, CheckCircle2, ArrowLeft, Image as ImageIcon, ShieldCheck, Scale, UserPlus, Camera, Upload } from 'lucide-react';
import { NumberInput, JalaliDatePicker, FullScreenSignatureModal, ConfirmModal } from '../components/Shared';
import { PrintTemplate } from '../components/PrintTemplates';
import { CameraService } from '../services/cameraService';
import { CameraGuide } from '../components/CameraGuide';
import html2canvas from 'html2canvas';

const Finance = () => {
    const { people = [], invoices = [], addSalary, addGeneralFinance, deleteTransaction, salaries = [], transactions = [], companies = [], addPerson } = useStore();
    const [activeTab, setActiveTab] = useState<'payroll' | 'cash' | 'expenses'>('payroll');
    const [view, setView] = useState<'main' | 'preview'>('main');
    
    const safePeople = Array.isArray(people) ? people.filter(p => Boolean(p && typeof p === 'object')) : [];
    const safeInvoices = Array.isArray(invoices) ? invoices.filter(inv => Boolean(inv && typeof inv === 'object')) : [];
    const safeTransactions = Array.isArray(transactions) ? transactions.filter(t => Boolean(t && typeof t === 'object')) : [];

    const defaultCompany = {
        id: 'default',
        name: 'مجموعه تجاری اشک قلم',
        phone: '۰۲۱',
        address: 'تهران، ایران',
        legalName: 'سامانه ابری اشک قلم',
        logo: null,
        stamp: null,
        signature: null,
        isActive: true
    };
    const activeComp = (Array.isArray(companies) && companies.length > 0
        ? (companies.find(c => c && c.isActive) || companies[0])
        : null) || defaultCompany;

    const [salaryEmpId, setSalaryEmpId] = useState('');
    const [salaryDate, setSalaryDate] = useState(getPersianDate());
    const [salaryBase, setSalaryBase] = useState(0);
    const [salaryBonus, setSalaryBonus] = useState(0);
    const [salaryDeduction, setSalaryDeduction] = useState(0);

    const [genAmount, setGenAmount] = useState(0);
    const [genDesc, setGenDesc] = useState('');
    const [genPersonId, setGenPersonId] = useState('');
    const [genInvoiceId, setGenInvoiceId] = useState('');
    const [showSignaturePad, setShowSignaturePad] = useState(false);
    const [signatureImage, setSignatureImage] = useState<string | null>(null);
    const [receiptImage, setReceiptImage] = useState<string | null>(null);
    const [showCameraGuide, setShowCameraGuide] = useState(false);
    const [viewReceiptModalImage, setViewReceiptModalImage] = useState<string | null>(null);

    // States for quick add person
    const [showAddPersonModal, setShowAddPersonModal] = useState(false);
    const [newPersonName, setNewPersonName] = useState('');
    const [newPersonPhone, setNewPersonPhone] = useState('');
    const [quickAddTargetType, setQuickAddTargetType] = useState<'payroll' | 'general'>('payroll');

    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const printRef = useRef<HTMLDivElement>(null);

    const handleCameraCaptureSlip = async () => {
        try {
            const b64 = await CameraService.capturePhoto({ quality: 85 });
            if (b64) setReceiptImage(b64);
        } catch (err) {
            console.error('Capture slip error:', err);
            setShowCameraGuide(true);
        }
    };

    const handleGalleryPickSlip = async () => {
        try {
            const b64 = await CameraService.pickPhotoFromGallery();
            if (b64) setReceiptImage(b64);
        } catch (err) {
            console.error('Gallery pick slip error:', err);
        }
    };

    const handleQuickAddPerson = () => {
        if (!newPersonName.trim()) return;
        const id = generateId();
        const nextCode = String(safePeople.length + 1001);
        addPerson({
            id,
            name: newPersonName,
            phone: newPersonPhone,
            balance: 0,
            code: nextCode,
            category: quickAddTargetType === 'payroll' ? 'پرسنل' : 'مشتری عادی',
            isCustomer: quickAddTargetType === 'general',
        } as any);
        if (quickAddTargetType === 'payroll') {
            setSalaryEmpId(id);
        } else {
            setGenPersonId(id);
        }
        setNewPersonName('');
        setNewPersonPhone('');
        setShowAddPersonModal(false);
    };

    const handleSalarySubmit = () => {
        const emp = safePeople.find(p => p && p.id === salaryEmpId);
        if (!emp || salaryBase <= 0) return alert('اطلاعات ناقص است.');
        addSalary({
            id: generateId(),
            employeeId: salaryEmpId,
            employeeName: emp.name || 'پرسنل',
            date: salaryDate,
            amount: salaryBase,
            bonus: salaryBonus,
            deductions: salaryDeduction,
            netAmount: salaryBase + salaryBonus - salaryDeduction
        });
        setSalaryBase(0); setSalaryBonus(0); setSalaryDeduction(0); setSalaryEmpId('');
        alert('حقوق ثبت شد.');
    };

    const handleFinanceSubmit = (type: 'INCOME' | 'EXPENSE') => {
        if (genAmount <= 0 || !genDesc) return alert('مبلغ و شرح الزامی است.');
        const trans = addGeneralFinance(
            type, 
            genAmount, 
            genDesc, 
            genPersonId || undefined, 
            signatureImage || undefined,
            genInvoiceId || undefined,
            receiptImage || undefined
        );
        setSelectedTransaction(trans);
        setView('preview');
        setGenAmount(0); 
        setGenDesc(''); 
        setGenPersonId(''); 
        setGenInvoiceId('');
        setSignatureImage(null);
        setReceiptImage(null);
    };

    const handleExportImage = async () => {
        if (!printRef.current) return;
        const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true });
        const link = document.createElement('a');
        link.download = `Sanad-${selectedTransaction?.trackingCode}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    if (view === 'preview' && selectedTransaction) {
        return (
            <div className="fixed inset-0 z-[1500] bg-slate-950 flex flex-col no-print animate-fade-in overflow-hidden">
                <header className="bg-slate-900 border-b border-white/10 p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shadow-2xl">
                    <button onClick={() => setView('main')} className="text-white flex items-center gap-2 font-bold text-sm"><ArrowLeft size={18}/> بازگشت</button>
                    <div className="flex gap-2 w-full md:w-auto">
                        <button onClick={handleExportImage} className="flex-1 md:flex-none bg-white/5 hover:bg-white/10 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-white/10"><ImageIcon size={14}/> <span className="hidden md:inline">ذخیره</span></button>
                        <button onClick={() => window.print()} className="flex-1 md:flex-none bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2"><Printer size={16}/> چاپ</button>
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto p-4 md:p-12 flex flex-col items-center bg-[#020617] custom-scrollbar">
                    <div ref={printRef} className="w-full max-w-4xl bg-white text-slate-900 p-8 md:p-16 rounded-xl shadow-2xl" dir="rtl">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-black mb-2">{activeComp?.name || 'مجموعه تجاری'}</h2>
                            <h3 className="text-xl font-bold">رسید {selectedTransaction.isDebit ? 'پرداخت' : 'دریافت'} وجه</h3>
                            <p className="text-sm text-slate-600 mt-2">شماره: {toPersianDigits(selectedTransaction.trackingCode)} | تاریخ: {toPersianDigits(selectedTransaction.date)}</p>
                        </div>
                        <div className="space-y-6 text-lg">
                            <p>مبلغ: <span className="font-black">{formatCurrency(selectedTransaction.amount)}</span></p>
                            <p>بابت: {selectedTransaction.description}</p>
                            <p>طرف حساب: {selectedTransaction.personName || 'متفرقه'}</p>
                        </div>
                        {selectedTransaction.signature && (
                            <div className="mt-8 text-center">
                                <p className="text-sm text-slate-500 mb-2">امضا:</p>
                                <img src={selectedTransaction.signature} className="h-24 mx-auto grayscale" alt="امضا" />
                            </div>
                        )}
                        {selectedTransaction.receiptImage && (
                            <div className="mt-8 border-t border-slate-200 pt-6 text-center">
                                <p className="text-sm font-black text-slate-700 mb-3 flex items-center justify-center gap-1.5">
                                    <ImageIcon size={16} className="text-indigo-600" />
                                    تصویر پیوست فیش بانکی / عکس حواله:
                                </p>
                                <img 
                                    src={selectedTransaction.receiptImage} 
                                    alt="پیوست سند" 
                                    className="max-h-72 max-w-md mx-auto rounded-xl border border-slate-300 shadow-md object-contain cursor-pointer hover:opacity-95" 
                                    onClick={() => setViewReceiptModalImage(selectedTransaction.receiptImage!)}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            <header className="bg-slate-900/40 p-4 md:p-6 rounded-2xl border border-white/5">
                <h1 className="text-xl md:text-3xl font-black text-white mb-1">مدیریت مالی</h1>
                <p className="text-slate-400 text-xs md:text-sm">ثبت حقوق، هزینه و رسید</p>
            </header>

            <div className="flex flex-col md:flex-row bg-slate-900/40 p-1.5 rounded-2xl border border-white/5 gap-1 md:gap-0">
                <button onClick={() => setActiveTab('payroll')} className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all font-bold text-sm ${activeTab === 'payroll' ? 'bg-teal-600 text-white shadow-lg' : 'text-slate-500'}`}><Briefcase size={16}/> حقوق</button>
                <button onClick={() => setActiveTab('cash')} className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all font-bold text-sm ${activeTab === 'cash' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}><PlusCircle size={16}/> دریافت</button>
                <button onClick={() => setActiveTab('expenses')} className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all font-bold text-sm ${activeTab === 'expenses' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500'}`}><MinusCircle size={16}/> هزینه</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-4">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 md:p-8 shadow-2xl">
                        {activeTab === 'payroll' ? (
                            <div className="space-y-4">
                                <h3 className="text-white font-bold text-sm flex items-center gap-2"><Briefcase className="text-teal-400" size={16}/> حقوق پرسنل</h3>
                                <div>
                                    <label className="text-xs text-slate-400 font-bold pr-2 mb-1.5 block">پرسنل</label>
                                    <div className="flex gap-2">
                                        <select className="flex-1 bg-slate-950 p-3.5 rounded-xl border border-white/5 text-white text-base font-bold outline-none" value={salaryEmpId} onChange={e => setSalaryEmpId(e.target.value)}>
                                            <option value="">انتخاب...</option>
                                            {safePeople.map(p => <option key={p.id} value={p.id}>{p?.name || 'بدون نام'}</option>)}
                                        </select>
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                setQuickAddTargetType('payroll');
                                                setShowAddPersonModal(true);
                                            }}
                                            className="shrink-0 bg-teal-600 hover:bg-teal-500 active:scale-95 text-white px-3.5 rounded-xl flex items-center justify-center transition-all shadow-lg"
                                            title="ثبت سریع پرسنل جدید"
                                        >
                                            <UserPlus size={18} />
                                        </button>
                                    </div>
                                </div>
                                <JalaliDatePicker value={salaryDate} onChange={setSalaryDate} label="تاریخ" />
                                <NumberInput label="حقوق پایه" value={salaryBase} onChange={setSalaryBase} />
                                <div className="grid grid-cols-2 gap-3">
                                    <NumberInput label="پاداش" value={salaryBonus} onChange={setSalaryBonus} />
                                    <NumberInput label="کسورات" value={salaryDeduction} onChange={setSalaryDeduction} />
                                </div>
                                <div className="bg-teal-600/10 p-4 rounded-xl border border-teal-500/20">
                                    <span className="text-xs text-teal-500 font-bold block mb-1">خالص:</span>
                                    <span className="text-lg text-teal-400 font-black font-mono">{formatCurrency(salaryBase + salaryBonus - salaryDeduction)}</span>
                                </div>
                                <button onClick={handleSalarySubmit} className="w-full bg-teal-600 text-white py-4 rounded-xl font-black active:scale-95 transition-all flex justify-center items-center gap-2"><Send size={18}/> ثبت</button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <h3 className="text-white font-bold text-sm flex items-center gap-2">
                                    {activeTab === 'cash' ? <PlusCircle className="text-indigo-400" size={16}/> : <MinusCircle className="text-rose-400" size={16}/>}
                                    {activeTab === 'cash' ? 'دریافت نقدی' : 'ثبت هزینه'}
                                </h3>
                                <div>
                                    <label className="text-xs text-slate-400 font-bold pr-2 mb-1.5 block">شرح</label>
                                    <input placeholder="توضیحات..." className="w-full bg-slate-950 p-3.5 rounded-xl border border-white/5 text-white text-base outline-none" value={genDesc} onChange={e => setGenDesc(e.target.value)} />
                                </div>
                                <NumberInput label="مبلغ" value={genAmount} onChange={setGenAmount} />
                                <div>
                                    <label className="text-xs text-slate-400 font-bold pr-2 mb-1.5 block">طرف حساب (شخص / مشتری / تامین‌کننده)</label>
                                    <div className="flex gap-2">
                                        <select 
                                            className="flex-1 bg-slate-950 p-3.5 rounded-xl border border-white/5 text-white text-base font-bold outline-none" 
                                            value={genPersonId} 
                                            onChange={e => {
                                                setGenPersonId(e.target.value);
                                                setGenInvoiceId('');
                                            }}
                                        >
                                            <option value="">بدون طرف حساب (عمومی)</option>
                                            {safePeople.map(p => (
                                                <option key={p.id} value={p.id}>
                                                    {p?.name || 'بدون نام'} {p?.balance ? `(${formatCurrency(Math.abs(p.balance))} ${p.balance > 0 ? 'بدهکار' : 'بستانکار'})` : '(تسویه)'}
                                                </option>
                                            ))}
                                        </select>
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                setQuickAddTargetType('general');
                                                setShowAddPersonModal(true);
                                            }}
                                            className="shrink-0 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white px-3.5 rounded-xl flex items-center justify-center transition-all shadow-lg"
                                            title="ثبت سریع طرف حساب جدید"
                                        >
                                            <UserPlus size={18} />
                                        </button>
                                    </div>
                                    {genPersonId && (() => {
                                        const selectedP = safePeople.find(p => p && p.id === genPersonId);
                                        if (!selectedP) return null;
                                        const personInvoices = safeInvoices.filter(inv => inv && inv.personId === genPersonId);
                                        return (
                                            <div className="mt-2.5 p-3 rounded-xl bg-slate-950/80 border border-white/5 space-y-2">
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-slate-400">مانده فعلی حساب:</span>
                                                    <span className={`font-mono font-bold ${selectedP.balance > 0 ? 'text-amber-400' : selectedP.balance < 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                                                        {selectedP.balance === 0 ? 'تسویه کامل' : `${formatCurrency(Math.abs(selectedP.balance))} (${selectedP.balance > 0 ? 'بدهکار به ما' : 'بستانکار از ما'})`}
                                                    </span>
                                                </div>
                                                {personInvoices.length > 0 && (
                                                    <div>
                                                        <label className="text-[11px] text-slate-400 font-bold block mb-1">ارتباط با فاکتور شخص (اختیاری):</label>
                                                        <select
                                                            className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-indigo-500"
                                                            value={genInvoiceId}
                                                            onChange={e => {
                                                                const invId = e.target.value;
                                                                setGenInvoiceId(invId);
                                                                const chosenInv = personInvoices.find(v => v && v.id === invId);
                                                                if (chosenInv && !genDesc) {
                                                                    setGenDesc(`تسویه بابت فاکتور ${chosenInv.type === InvoiceType.SALE ? 'فروش' : 'خرید'} شماره ${chosenInv.number}`);
                                                                }
                                                                if (chosenInv && genAmount === 0) {
                                                                    const remaining = Math.max(0, (chosenInv.finalTotal || 0) - (chosenInv.cashAmount || 0) - (chosenInv.checkAmount || 0));
                                                                    if (remaining > 0) setGenAmount(remaining);
                                                                }
                                                            }}
                                                        >
                                                            <option value="">ثبت آزاد (مستقیماً در کاردکس شخص اعمال شود)</option>
                                                            {personInvoices.map(inv => {
                                                                const total = inv.finalTotal || 0;
                                                                const paid = (inv.cashAmount || 0) + (inv.checkAmount || 0);
                                                                const rem = Math.max(0, total - paid);
                                                                return (
                                                                    <option key={inv.id} value={inv.id}>
                                                                        فاکتور {inv.type === InvoiceType.SALE ? 'فروش' : 'خرید'} #{inv.number} (کل: {formatCurrency(total)} - مانده: {formatCurrency(rem)})
                                                                    </option>
                                                                );
                                                            })}
                                                        </select>
                                                    </div>
                                                )}
                                                <div className="text-[10px] text-indigo-300/80 leading-relaxed pt-1 border-t border-white/5">
                                                    {activeTab === 'cash' 
                                                        ? '✓ ثبت دریافت وجه، حساب طرف‌حساب را بستانکار کرده و بدهی او در کاردکس کاهش می‌یابد.' 
                                                        : '✓ ثبت پرداخت وجه/هزینه، حساب طرف‌حساب را بدهکار می‌کند.'}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1.5 pr-2">
                                        <label className="text-xs text-slate-400 font-bold">تصویر فیش واریزی / عکس حواله</label>
                                        {receiptImage && (
                                            <button 
                                                type="button" 
                                                onClick={() => setReceiptImage(null)} 
                                                className="text-[10px] text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1"
                                            >
                                                <Trash2 size={12} /> حذف تصویر
                                            </button>
                                        )}
                                    </div>
                                    
                                    {receiptImage ? (
                                        <div className="relative group rounded-xl overflow-hidden border border-white/10 bg-black/40 p-2 flex items-center justify-center">
                                            <img src={receiptImage} alt="فیش حواله" className="max-h-36 rounded-lg object-contain" />
                                            <button
                                                type="button"
                                                onClick={() => setViewReceiptModalImage(receiptImage)}
                                                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 text-white text-xs font-bold transition-opacity"
                                            >
                                                <Eye size={16} /> بزرگنمایی تصویر
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-2">
                                            <button 
                                                type="button" 
                                                onClick={handleCameraCaptureSlip} 
                                                className="p-3 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 text-teal-300 flex items-center justify-center gap-1.5 transition-all active:scale-95"
                                                title="تصویربرداری مستقیم با دوربین گوشی یا سیستم"
                                            >
                                                <Camera size={18} className="text-teal-400" />
                                                <span className="text-[11px] font-bold">عکس با دوربین</span>
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={handleGalleryPickSlip} 
                                                className="p-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-white/5 text-slate-300 flex items-center justify-center gap-1.5 transition-all active:scale-95"
                                                title="انتخاب از گالری تصاویر یا فایل"
                                            >
                                                <ImageIcon size={18} className="text-indigo-400" />
                                                <span className="text-[11px] font-bold">انتخاب از گالری</span>
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="text-xs text-slate-400 font-bold pr-2 mb-1.5 block">امضا</label>
                                    <button onClick={() => setShowSignaturePad(true)} className="w-full h-24 rounded-xl bg-black/40 border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-1 text-slate-500">
                                        {signatureImage ? <img src={signatureImage} className="h-full w-full object-contain p-2 grayscale" /> : <><PenTool size={18}/><span className="text-xs font-bold">ثبت امضا</span></>}
                                    </button>
                                </div>
                                <button onClick={() => handleFinanceSubmit(activeTab === 'cash' ? 'INCOME' : 'EXPENSE')} className={`w-full py-4 rounded-xl font-black text-white active:scale-95 transition-all flex justify-center items-center gap-2 ${activeTab === 'cash' ? 'bg-indigo-600' : 'bg-rose-600'}`}>
                                    <CheckCircle2 size={20}/> صدور رسید
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-8">
                    <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 md:p-8 shadow-2xl min-h-[400px]">
                        <h3 className="text-base md:text-xl font-black text-white mb-4">تاریخچه</h3>
                        <div className="space-y-3">
                            {safeTransactions.filter(t => t && (activeTab === 'payroll' ? t.type === 'SALARY_PAYMENT' : (activeTab === 'cash' ? t.type === 'GENERAL_INCOME' : t.type === 'EXPENSE'))).map(t => (
                                <div key={t.id} className="bg-white/5 p-4 rounded-2xl border border-white/5 flex flex-col md:flex-row justify-between md:items-center gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${t.isDebit ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                            {t.isDebit ? <MinusCircle size={18}/> : <PlusCircle size={18}/>}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <div className="text-white font-bold text-sm truncate">{t.description}</div>
                                                {t.receiptImage && (
                                                    <button 
                                                        type="button"
                                                        onClick={() => setViewReceiptModalImage(t.receiptImage!)}
                                                        className="px-2 py-0.5 rounded-md bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 text-[10px] font-bold flex items-center gap-1 border border-teal-500/30 shrink-0 transition-colors"
                                                        title="مشاهده فیش پیوست"
                                                    >
                                                        <Camera size={11} />
                                                        فیش پیوست
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex gap-2 text-[10px] text-slate-500 font-mono">
                                                <span>{toPersianDigits(t.trackingCode)}</span>
                                                <span>{toPersianDigits(t.date)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between md:justify-end gap-3">
                                        <div className={`text-base font-black font-mono ${t.isDebit ? 'text-rose-400' : 'text-emerald-400'}`}>{t.isDebit ? '-' : '+'}{formatCurrency(t.amount)}</div>
                                        <div className="flex gap-1.5">
                                            <button onClick={() => { setSelectedTransaction(t); setView('preview'); }} className="p-2 bg-white/5 text-slate-400 rounded-lg hover:bg-teal-600 hover:text-white transition-all"><Eye size={16}/></button>
                                            <button onClick={() => setDeleteTarget(t.id)} className="p-2 bg-rose-500/10 text-rose-500 rounded-lg hover:bg-rose-600 hover:text-white transition-all"><Trash2 size={16}/></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => { deleteTransaction(deleteTarget!); setDeleteTarget(null); }} title="حذف سند" message="آیا مطمئن هستید؟" />
            <FullScreenSignatureModal isOpen={showSignaturePad} onClose={() => setShowSignaturePad(false)} onSave={setSignatureImage} />

            {/* --- CAMERA GUIDE MODAL --- */}
            {showCameraGuide && (
                <CameraGuide
                    title="ثبت عکس فیش بانکی یا حواله"
                    description="فیش بانکی یا رسید حواله را در کادر قرار دهید"
                    onCapture={(b64) => {
                        setReceiptImage(b64);
                        setShowCameraGuide(false);
                    }}
                    onClose={() => setShowCameraGuide(false)}
                />
            )}

            {/* --- RECEIPT IMAGE LIGHTBOX MODAL --- */}
            {viewReceiptModalImage && (
                <div className="fixed inset-0 z-[9900] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 no-print animate-fade-in" dir="rtl">
                    <div className="relative max-w-2xl w-full bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-4 flex flex-col items-center">
                        <div className="w-full flex items-center justify-between mb-3 pb-2 border-b border-white/10">
                            <span className="text-white text-xs font-bold flex items-center gap-1.5">
                                <ImageIcon size={16} className="text-teal-400" />
                                تصویر فیش بانکی / حواله
                            </span>
                            <button 
                                type="button"
                                onClick={() => setViewReceiptModalImage(null)}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <img 
                            src={viewReceiptModalImage} 
                            alt="تصویر فیش حواله" 
                            className="max-h-[70vh] w-auto max-w-full rounded-xl object-contain shadow-lg" 
                        />
                    </div>
                </div>
            )}

            {/* --- QUICK ADD PERSON/EMPLOYEE MODAL --- */}
            {showAddPersonModal && (
                <div className="fixed inset-0 z-[1400] bg-black/80 backdrop-blur-md flex items-end md:items-center justify-center p-4 animate-fade-in" dir="rtl">
                    <div className="bg-slate-900 border border-white/10 w-full max-w-sm rounded-t-[2.5rem] md:rounded-[2.5rem] p-8 shadow-2xl">
                        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 md:hidden"></div>
                        <h3 className="text-lg font-black text-white mb-6 flex items-center gap-2">
                            <UserPlus className="text-teal-400" size={20}/> 
                            {quickAddTargetType === 'payroll' ? 'تعریف سریع پرسنل' : 'تعریف سریع شخص'}
                        </h3>
                        <div className="space-y-4">
                            <input className="w-full bg-slate-950 p-4 rounded-2xl border border-white/5 text-white font-bold outline-none focus:border-teal-500" placeholder="نام کامل..." value={newPersonName} onChange={e => setNewPersonName(e.target.value)} autoFocus />
                            <input className="w-full bg-slate-950 p-4 rounded-2xl border border-white/5 text-white font-mono outline-none focus:border-teal-500" placeholder="شماره تماس (اختیاری)" value={newPersonPhone} onChange={e => setNewPersonPhone(e.target.value)} />
                            <button onClick={handleQuickAddPerson} className="w-full bg-teal-600 hover:bg-teal-500 text-white py-4 rounded-2xl font-black shadow-xl active:scale-95">ذخیره و انتخاب</button>
                            <button onClick={() => setShowAddPersonModal(false)} className="w-full bg-slate-800 text-white py-3 rounded-2xl font-bold">انصراف</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Finance;
