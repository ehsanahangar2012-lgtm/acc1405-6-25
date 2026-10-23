import React, { useCallback, useEffect, useState } from 'react';
import { useAndroidBackButtonHandler } from '../useMobile';
import { 
  AlertCircle, CheckCircle2, AlertTriangle, Info, HelpCircle, 
  Clock, ShieldAlert, LogOut, DownloadCloud, X 
} from 'lucide-react';
import { dialogService, DialogOptions } from '../services/dialogService';
import { AccountingLogo } from './AccountingLogo';

export const AppDialogModal: React.FC = () => {
  const [dialog, setDialog] = useState<DialogOptions | null>(null);

  useEffect(() => {
    dialogService.register((options) => {
      setDialog(options);
    });

    return () => {
      dialogService.unregister();
    };
  }, []);

  const handleAndroidBack = useCallback(() => {
    if (!dialog) return false;
    // A non-cancellable alert consumes Back instead of confirming or dismissing.
    if (dialog.showCancel) {
      dialog.onCancel?.();
      dialogService.close();
    }
    return true;
  }, [dialog]);

  useAndroidBackButtonHandler(handleAndroidBack, Boolean(dialog));

  if (!dialog) return null;

  const getIcon = () => {
    switch (dialog.type) {
      case 'success':
        return <CheckCircle2 className="w-10 h-10 text-emerald-400" />;
      case 'warning':
        return <AlertTriangle className="w-10 h-10 text-amber-400" />;
      case 'error':
        return <AlertCircle className="w-10 h-10 text-rose-500" />;
      case 'session_timeout':
        return <Clock className="w-10 h-10 text-amber-400 animate-pulse" />;
      case 'app_exit':
        return <LogOut className="w-10 h-10 text-teal-400" />;
      case 'question':
        return <HelpCircle className="w-10 h-10 text-cyan-400" />;
      case 'info':
      default:
        return <Info className="w-10 h-10 text-indigo-400" />;
    }
  };

  const getHeaderGradient = () => {
    switch (dialog.type) {
      case 'error':
        return 'from-rose-600/20 via-rose-500/10 to-transparent border-rose-500/30';
      case 'warning':
      case 'session_timeout':
        return 'from-amber-600/20 via-amber-500/10 to-transparent border-amber-500/30';
      case 'success':
        return 'from-emerald-600/20 via-emerald-500/10 to-transparent border-emerald-500/30';
      case 'app_exit':
        return 'from-teal-600/20 via-cyan-500/10 to-transparent border-teal-500/30';
      default:
        return 'from-slate-800 via-slate-900 to-transparent border-white/10';
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in select-none no-print"
      dir="rtl"
    >
      <div 
        className="w-full max-w-lg bg-[#0f172a] border border-white/15 rounded-3xl shadow-2xl overflow-hidden animate-scale-up text-slate-100 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar with Logo and Close */}
        <div className={`p-5 pb-4 bg-gradient-to-b ${getHeaderGradient()} border-b flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10 shrink-0 shadow-inner">
              {getIcon()}
            </div>
            <div>
              <h3 className="font-black text-base text-white">
                {dialog.title || 'پیام سیستم'}
              </h3>
              <p className="text-[10px] text-teal-400 font-bold mt-0.5">
                دپارتمان IT اشک قلم | www.ashkghalam.ir
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <AccountingLogo size="sm" />
            {dialog.showCancel && (
              <button
                onClick={() => {
                  dialog.onCancel?.();
                  dialogService.close();
                }}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                title="بستن"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Message Content */}
        <div className="p-6 text-sm text-slate-300 leading-relaxed font-medium whitespace-pre-line">
          {dialog.message}
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-slate-950/60 border-t border-white/5 flex flex-wrap items-center justify-end gap-2.5">
          {dialog.neutralText && (
            <button
              onClick={() => {
                dialog.onNeutral?.();
                dialogService.close();
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-900/60 hover:text-rose-200 border border-white/10 text-slate-300 text-xs font-black transition-all"
            >
              {dialog.neutralText}
            </button>
          )}

          {dialog.showCancel && (
            <button
              onClick={() => {
                dialog.onCancel?.();
                dialogService.close();
              }}
              className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 text-xs font-black transition-all"
            >
              {dialog.cancelText || 'انصراف'}
            </button>
          )}

          <button
            onClick={() => {
              dialog.onConfirm?.();
              dialogService.close();
            }}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-900/30 transition-all active:scale-95 flex items-center gap-2"
          >
            {dialog.type === 'app_exit' && <DownloadCloud size={14} />}
            {dialog.confirmText || 'تایید'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AppDialogModal;
