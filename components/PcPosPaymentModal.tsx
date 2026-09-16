import React, { useState } from 'react';
import { 
  CreditCard, RefreshCw, CheckCircle2, AlertTriangle, 
  X, Receipt, ShieldCheck, ArrowRight, Printer
} from 'lucide-react';
import { 
  PcPosService, PosTransactionResult, PosConfiguration 
} from '../services/pcPosService';
import { formatCurrency, toPersianDigits } from '../utils';

interface PcPosPaymentModalProps {
  isOpen: boolean;
  amount: number;
  invoiceNumber?: string;
  payerName?: string;
  onSuccess: (result: PosTransactionResult) => void;
  onClose: () => void;
}

export const PcPosPaymentModal: React.FC<PcPosPaymentModalProps> = ({
  isOpen,
  amount,
  invoiceNumber,
  payerName,
  onSuccess,
  onClose
}) => {
  const [config] = useState<PosConfiguration>(() => PcPosService.getConfig());
  const [status, setStatus] = useState<'IDLE' | 'SENDING' | 'WAITING_CARD' | 'SUCCESS' | 'FAILED'>('IDLE');
  const [transactionResult, setTransactionResult] = useState<PosTransactionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartPayment = async () => {
    setStatus('SENDING');
    setErrorMessage(null);

    try {
      const result = await PcPosService.sendPayment({
        amount,
        invoiceNumber,
        payerName,
        onWaitingCard: () => {
          setStatus('WAITING_CARD');
        }
      });

      if (result.success) {
        setTransactionResult(result);
        setStatus('SUCCESS');
        onSuccess(result);
      } else {
        setStatus('FAILED');
        setErrorMessage(result.message);
      }
    } catch (e: any) {
      setStatus('FAILED');
      setErrorMessage('خطای ارتباط با دستگاه کارتخوان: ' + (e?.message || 'پاسخی از پوز دریافت نشد.'));
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-scaleUp">
        {/* هدر مدال */}
        <div className="p-4 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-300" />
            <span className="font-bold text-sm">ارسال مبلغ به کارتخوان بانکی (PC-POS)</span>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* بدنه تراکنش */}
        <div className="p-6 text-center space-y-6">
          {status === 'IDLE' && (
            <div className="space-y-4">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl mx-auto flex items-center justify-center border border-blue-100">
                <CreditCard className="w-8 h-8" />
              </div>

              <div>
                <div className="text-xs text-slate-500 font-bold mb-1">مبلغ قابل انتقال به کارتخوان</div>
                <div className="text-2xl font-black text-slate-800 font-mono">
                  {formatCurrency(amount)} <span className="text-xs font-normal">تومان</span>
                </div>
                {invoiceNumber && (
                  <div className="text-xs text-slate-500 mt-1">
                    بابت فاکتور شماره {toPersianDigits(invoiceNumber)} {payerName ? `(${payerName})` : ''}
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex justify-between items-center">
                <span>دستگاه کارتخوان فعال:</span>
                <span className="font-bold text-blue-700 font-mono">
                  {config.provider} ({config.connectionType === 'TEST_SIMULATOR' ? 'شبیه‌ساز تستی' : config.ipAddress})
                </span>
              </div>

              <button
                onClick={handleStartPayment}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
              >
                ارسال مبلغ به نمایشگر پوز
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {(status === 'SENDING' || status === 'WAITING_CARD') && (
            <div className="py-6 space-y-4">
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
                <CreditCard className="w-8 h-8 text-blue-600" />
              </div>

              <div>
                <div className="text-base font-bold text-slate-800">
                  {status === 'SENDING' ? 'در حال ارسال دستور به کارتخوان...' : 'دستگاه آماده است؛ لطفاً کارت بکشید'}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  مشتری محترم رمز کارت بانکی خود را روی کیپد کارتخوان وارد نماید.
                </p>
              </div>

              <div className="text-xl font-black text-blue-700 font-mono bg-blue-50 py-2 rounded-xl border border-blue-200 w-3/4 mx-auto">
                {formatCurrency(amount)} تومان
              </div>
            </div>
          )}

          {status === 'SUCCESS' && transactionResult && (
            <div className="space-y-4 py-2">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl mx-auto flex items-center justify-center border border-emerald-100">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <div className="text-base font-black text-emerald-800">تراکنش با موفقیت تایید شد</div>
                <p className="text-xs text-slate-500 mt-1">سند دریافت بانکی در سیستم ثبت گردید.</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2 text-right">
                <div className="flex justify-between">
                  <span className="text-slate-500">شماره مرجع بانکی (RRN):</span>
                  <span className="font-mono font-bold text-slate-800">{transactionResult.rrn}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">کد پیگیری:</span>
                  <span className="font-mono font-bold text-slate-800">{transactionResult.traceNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">شماره کارت:</span>
                  <span className="font-mono text-slate-700">{transactionResult.maskedCardNumber}</span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition-all"
              >
                تکمیل فرایند و ثبت تسویه
              </button>
            </div>
          )}

          {status === 'FAILED' && (
            <div className="space-y-4 py-2">
              <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl mx-auto flex items-center justify-center border border-rose-100">
                <AlertTriangle className="w-10 h-10" />
              </div>

              <div>
                <div className="text-base font-bold text-rose-800">تراکنش ناموفق بود</div>
                <p className="text-xs text-rose-600 mt-1">{errorMessage}</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleStartPayment}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs"
                >
                  تلاش مجدد
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs"
                >
                  انصراف
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
