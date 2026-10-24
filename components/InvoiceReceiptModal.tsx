import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Invoice, InvoiceType, IRANIAN_BANKS } from '../types';
import { useStore } from '../store';
import { formatCurrency, toPersianDigits, getPersianDate } from '../utils';
import { X, CheckCircle, Banknote, CreditCard, Receipt, Calendar, ArrowRight, ShieldCheck, Landmark } from 'lucide-react';
import { JalaliDatePicker, NumberInput } from './Shared';

interface InvoiceReceiptModalProps {
    invoice: Invoice;
    onClose: () => void;
    onSuccess?: () => void;
}

export const InvoiceReceiptModal: React.FC<InvoiceReceiptModalProps> = ({ invoice, onClose, onSuccess }) => {
    const { addInvoicePayment } = useStore();

    const isSale = invoice.type === InvoiceType.SALE;
    const totalPaid = (invoice.cashAmount || 0) + (invoice.checkAmount || 0);
    const remainingBalance = Math.max(0, invoice.finalTotal - totalPaid);

    const [amount, setAmount] = useState<number>(remainingBalance > 0 ? remainingBalance : invoice.finalTotal);
    const [date, setDate] = useState<string>(getPersianDate());
    const [method, setMethod] = useState<'CASH' | 'POS' | 'CARD' | 'CHECK'>('CASH');
    const [trackingCode, setTrackingCode] = useState<string>('');
    const [description, setDescription] = useState<string>('');

    // Check specific fields
    const [bankName, setBankName] = useState<string>(IRANIAN_BANKS[0] || 'بانک ملی ایران');
    const [checkNumber, setCheckNumber] = useState<string>('');
    const [sayadId, setSayadId] = useState<string>('');
    const [dueDate, setDueDate] = useState<string>(getPersianDate());

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (amount <= 0) {
            alert('لطفاً مبلغ دریافتی را وارد کنید.');
            return;
        }

        if (method === 'CHECK') {
            if (!checkNumber.trim()) {
                alert('شماره چک الزامی است.');
                return;
            }
            if (sayadId && sayadId.length !== 16) {
                alert('شناسه صیادی چک باید دقیقاً ۱۶ رقم باشد.');
                return;
            }
        }

        setIsSubmitting(true);
        try {
            const checkDetails = method === 'CHECK' ? {
                bankName,
                checkNumber: checkNumber.trim(),
                sayadId: sayadId.trim(),
                dueDate
            } : undefined;

            const res = addInvoicePayment(invoice.id, {
                amount,
                date,
                method,
                description: description.trim() || undefined,
                trackingCode: trackingCode.trim() || undefined,
                checkDetails
            });

            if (res) {
                if (onSuccess) onSuccess();
                onClose();
            }
        } catch (error) {
            console.error('Error recording invoice payment:', error);
            alert('خطا در ثبت دریافتی فاکتور.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-9999 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in no-print" dir="rtl">
            <div className="bg-slate-900 border border-white/10 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
                {/* Header */}
                <div className="p-6 bg-slate-950/80 border-b border-white/10 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                            <Banknote size={24} />
                        </div>
                        <div>
                            <h2 className="text-white font-black text-lg">
                                {isSale ? 'ثبت دریافتی فاکتور فروش' : 'ثبت پرداختی فاکتور خرید'}
                            </h2>
                            <p className="text-slate-400 text-xs mt-0.5">
                                فاکتور شماره {(invoice.prefix || '') + toPersianDigits(invoice.number)} • طرف‌حساب: <span className="text-teal-400 font-bold">{invoice.personName}</span>
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/5 transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar space-y-5">
                    {/* Invoice Summary Card */}
                    <div className="grid grid-cols-3 gap-3 bg-slate-950/60 p-4 rounded-2xl border border-white/5">
                        <div>
                            <span className="text-[11px] text-slate-400 block mb-1">مبلغ کل فاکتور</span>
                            <span className="text-white font-black font-mono text-sm">{formatCurrency(invoice.finalTotal)}</span>
                        </div>
                        <div>
                            <span className="text-[11px] text-slate-400 block mb-1">مجموع وصول شده</span>
                            <span className="text-emerald-400 font-black font-mono text-sm">{formatCurrency(totalPaid)}</span>
                        </div>
                        <div>
                            <span className="text-[11px] text-slate-400 block mb-1">مانده فاکتور</span>
                            <span className={`font-black font-mono text-sm ${remainingBalance > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                                {formatCurrency(remainingBalance)}
                            </span>
                        </div>
                    </div>

                    {/* Method Selector */}
                    <div>
                        <label className="text-slate-300 text-xs font-bold block mb-2">روش دریافت / پرداخت</label>
                        <div className="grid grid-cols-4 gap-2">
                            <button
                                type="button"
                                onClick={() => setMethod('CASH')}
                                className={`py-3 px-2 rounded-xl text-xs font-black transition-all flex flex-col items-center gap-1.5 border ${
                                    method === 'CASH'
                                        ? 'bg-teal-600 text-white border-teal-500 shadow-lg shadow-teal-600/20'
                                        : 'bg-slate-950 text-slate-400 border-white/5 hover:text-white'
                                }`}
                            >
                                <Banknote size={18} />
                                <span>نقدی</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setMethod('POS')}
                                className={`py-3 px-2 rounded-xl text-xs font-black transition-all flex flex-col items-center gap-1.5 border ${
                                    method === 'POS'
                                        ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/20'
                                        : 'bg-slate-950 text-slate-400 border-white/5 hover:text-white'
                                }`}
                            >
                                <CreditCard size={18} />
                                <span>کارتخوان (POS)</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setMethod('CARD')}
                                className={`py-3 px-2 rounded-xl text-xs font-black transition-all flex flex-col items-center gap-1.5 border ${
                                    method === 'CARD'
                                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/20'
                                        : 'bg-slate-950 text-slate-400 border-white/5 hover:text-white'
                                }`}
                            >
                                <Receipt size={18} />
                                <span>کارت به کارت</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setMethod('CHECK')}
                                className={`py-3 px-2 rounded-xl text-xs font-black transition-all flex flex-col items-center gap-1.5 border ${
                                    method === 'CHECK'
                                        ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-600/20'
                                        : 'bg-slate-950 text-slate-400 border-white/5 hover:text-white'
                                }`}
                            >
                                <Landmark size={18} />
                                <span>چک صیادی</span>
                            </button>
                        </div>
                    </div>

                    {/* Amount & Quick Settlement Button */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="text-slate-300 text-xs font-bold">مبلغ دریافتی (تومان)</label>
                            {remainingBalance > 0 && amount !== remainingBalance && (
                                <button
                                    type="button"
                                    onClick={() => setAmount(remainingBalance)}
                                    className="text-[11px] text-teal-400 hover:text-teal-300 font-bold bg-teal-500/10 px-2.5 py-1 rounded-lg border border-teal-500/20 transition-colors"
                                >
                                    تسویه کامل مانده ({formatCurrency(remainingBalance)})
                                </button>
                            )}
                        </div>
                        <NumberInput
                            value={amount}
                            onChange={setAmount}
                            className="bg-slate-950 border border-white/10 text-white font-mono font-black text-lg"
                        />
                    </div>

                    {/* Date & Tracking */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <JalaliDatePicker
                            label="تاریخ دریافت"
                            value={date}
                            onChange={setDate}
                        />
                        <div className="space-y-1">
                            <label className="text-slate-400 text-xs font-bold pr-1 block">شماره پیگیری / ارجاع (اختیاری)</label>
                            <input
                                type="text"
                                className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white text-sm font-mono outline-none focus:border-teal-500"
                                placeholder="مثلاً: 12345678"
                                value={trackingCode}
                                onChange={e => setTrackingCode(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Check Specific Fields */}
                    {method === 'CHECK' && (
                        <div className="p-4 bg-purple-950/30 rounded-2xl border border-purple-500/20 space-y-3">
                            <div className="flex items-center gap-2 text-purple-300 text-xs font-black">
                                <Landmark size={16} />
                                <span>مشخصات چک صیادی</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-slate-400 text-[11px] font-bold block mb-1">نام بانک</label>
                                    <select
                                        className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-white text-xs font-bold outline-none focus:border-purple-500"
                                        value={bankName}
                                        onChange={e => setBankName(e.target.value)}
                                    >
                                        {IRANIAN_BANKS.map((b, i) => (
                                            <option key={i} value={b}>{b}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-slate-400 text-[11px] font-bold block mb-1">شماره سریال چک *</label>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-white text-xs font-mono outline-none focus:border-purple-500"
                                        placeholder="شماره چک..."
                                        value={checkNumber}
                                        onChange={e => setCheckNumber(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-slate-400 text-[11px] font-bold block mb-1">شناسه ۱۶ رقمی صیاد (اختیاری)</label>
                                    <input
                                        type="text"
                                        maxLength={16}
                                        className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-white text-xs font-mono tracking-widest text-center outline-none focus:border-purple-500"
                                        placeholder="۱۶ رقم شناسه صیادی..."
                                        value={sayadId}
                                        onChange={e => setSayadId(e.target.value.replace(/[^0-9]/g, ''))}
                                    />
                                </div>
                                <div>
                                    <JalaliDatePicker
                                        label="تاریخ سررسید چک"
                                        value={dueDate}
                                        onChange={setDueDate}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Description */}
                    <div className="space-y-1">
                        <label className="text-slate-400 text-xs font-bold pr-1 block">شرح و توضیحات سند (در کاردکس درج می‌شود)</label>
                        <input
                            type="text"
                            className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-teal-500"
                            placeholder={
                                isSale
                                    ? `دریافت بابت فاکتور فروش شماره ${invoice.number}`
                                    : `پرداخت بابت فاکتور خرید شماره ${invoice.number}`
                            }
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                        />
                    </div>

                    {/* Note about Accounting Impact */}
                    <div className="p-3 bg-teal-500/10 border border-teal-500/20 rounded-xl flex items-center gap-2 text-[11px] text-teal-300">
                        <ShieldCheck size={16} className="shrink-0 text-teal-400" />
                        <span>
                            این تراکنش به صورت خودکار مانده طرف‌حساب را در کاردکس بروزرسانی نموده و سند حسابداری مرتبط با فاکتور ثبت می‌شود.
                        </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-2 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 py-3 rounded-2xl font-bold text-sm transition-all"
                        >
                            انصراف
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-2 bg-teal-600 hover:bg-teal-500 text-white py-3 px-6 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-xl shadow-teal-600/20 active:scale-95 disabled:opacity-50"
                        >
                            <CheckCircle size={18} />
                            <span>ثبت دریافتی و کسر از مانده فاکتور</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};
