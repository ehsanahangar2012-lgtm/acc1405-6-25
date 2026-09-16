import React, { useState, useEffect } from 'react';
import { Smartphone, Send, CheckCircle2, Clock, Trash2, RefreshCw, X, Radio, ArrowLeftRight, HelpCircle } from 'lucide-react';
import { SmsRelayBridgeService, SmsRelayJob } from '../services/smsRelayBridgeService';
import { isAndroidApp, toPersianDigits, getAppPlatform } from '../utils';

interface AndroidSmsRelayModalProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export const AndroidSmsRelayModal: React.FC<AndroidSmsRelayModalProps> = ({ isOpen: propsIsOpen, onClose: propsOnClose }) => {
    const [internalOpen, setInternalOpen] = useState(false);
    const isOpen = propsIsOpen ?? internalOpen;
    const onClose = propsOnClose || (() => setInternalOpen(false));

    const [jobs, setJobs] = useState<SmsRelayJob[]>([]);
    const [loading, setLoading] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const isAndroid = isAndroidApp();
    const platform = getAppPlatform();

    const loadJobs = async () => {
        setLoading(true);
        try {
            const list = await SmsRelayBridgeService.getJobs();
            setJobs(list);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const handleOpen = () => setInternalOpen(true);
        window.addEventListener('open-android-sms-relay', handleOpen);
        return () => window.removeEventListener('open-android-sms-relay', handleOpen);
    }, []);

    useEffect(() => {
        if (isOpen) {
            loadJobs();
        }
        const handleUpdate = () => loadJobs();
        window.addEventListener('ashk_sms_relay_updated', handleUpdate);
        return () => window.removeEventListener('ashk_sms_relay_updated', handleUpdate);
    }, [isOpen]);

    if (!isOpen) return null;

    const pendingJobs = jobs.filter(j => j.status === 'PENDING');
    const sentJobs = jobs.filter(j => j.status === 'SENT');

    const handleSendOnDevice = async (jobId: string) => {
        await SmsRelayBridgeService.dispatchJobOnAndroid(jobId);
        loadJobs();
    };

    const handleClear = async () => {
        if (window.confirm('آیا از پاکسازی تاریخچه صف پیامک اطمینان دارید؟')) {
            await SmsRelayBridgeService.clearAllJobs();
            setJobs([]);
        }
    };

    return (
        <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" dir="rtl">
            <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-2xl w-full shadow-2xl p-6 space-y-5 overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center border border-emerald-500/30">
                            <Radio size={22} className="animate-pulse" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-black text-white">پل پیامک بی‌سیم اندروید (SMS Relay)</h3>
                                <button 
                                    onClick={() => setShowHelp(!showHelp)}
                                    className="p-1 text-slate-400 hover:text-teal-300 transition cursor-pointer"
                                    title="راهنمای هوشمند"
                                >
                                    <HelpCircle size={16} />
                                </button>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                                ارسال مستقیم پیامک‌های ثبت‌شده در ویندوز/وب از طریق سیم‌کارت گوشی همراه
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={loadJobs}
                            disabled={loading}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition cursor-pointer"
                            title="بروزرسانی صف"
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Smart Help Drawer */}
                {showHelp && (
                    <div className="bg-slate-950/80 p-4 rounded-2xl border border-teal-500/30 text-xs text-slate-300 space-y-2 animate-slide-down">
                        <h4 className="font-bold text-teal-400 flex items-center gap-1.5">
                            💡 راهنمای کاربری پل پیامک بی‌سیم:
                        </h4>
                        <p className="leading-relaxed">
                            ۱. در سیستم ویندوز یا وب، هنگام صدور فاکتور روی «ارسال پیامک با پل اندروید» کلیک کنید تا دستور در صف ابری قرار گیرد.
                        </p>
                        <p className="leading-relaxed">
                            ۲. در اپلیکیشن موبایل اندروید، این صف به صورت خودکار دریافت شده و با لمس دکمه «ارسال با سیم‌کارت»، پیامک بدون هزینه پنل از خط تلفن همراه شما ارسال می‌شود.
                        </p>
                    </div>
                )}

                {/* Status Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
                        <span className="text-xs text-slate-400">در انتظار ارسال:</span>
                        <span className="text-sm font-black text-amber-400">{toPersianDigits(pendingJobs.length)}</span>
                    </div>
                    <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
                        <span className="text-xs text-slate-400">ارسال‌شده:</span>
                        <span className="text-sm font-black text-emerald-400">{toPersianDigits(sentJobs.length)}</span>
                    </div>
                    <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 flex items-center justify-between col-span-2 sm:col-span-1">
                        <span className="text-xs text-slate-400">دستگاه فعلی:</span>
                        <span className="text-xs font-bold text-teal-300">{isAndroid ? 'موبایل اندروید' : 'ویندوز/وب'}</span>
                    </div>
                </div>

                {/* Jobs List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
                    {jobs.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 text-xs space-y-2">
                            <Clock size={32} className="mx-auto text-slate-600 opacity-60" />
                            <p>هیچ پیامکی در صف ارسال قرار ندارد.</p>
                        </div>
                    ) : (
                        jobs.map(job => (
                            <div 
                                key={job.id}
                                className={`p-4 rounded-2xl border transition-all space-y-3 ${
                                    job.status === 'PENDING'
                                        ? 'bg-amber-500/5 border-amber-500/30'
                                        : 'bg-slate-950/60 border-slate-800/80 opacity-80'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className={`w-2.5 h-2.5 rounded-full ${job.status === 'PENDING' ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
                                        <span className="font-bold text-xs text-white">
                                            {job.recipientName || 'طرف‌حساب'} — {toPersianDigits(job.targetPhone)}
                                        </span>
                                        {job.invoiceNumber && (
                                            <span className="text-[10px] bg-slate-800 text-teal-300 px-2 py-0.5 rounded-md font-mono">
                                                فاکتور: {toPersianDigits(job.invoiceNumber)}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-mono">
                                        {job.createdAt}
                                    </span>
                                </div>

                                <p className="text-xs text-slate-300 bg-slate-900/90 p-3 rounded-xl border border-white/5 font-mono leading-relaxed">
                                    {job.messageText}
                                </p>

                                <div className="flex items-center justify-between pt-1">
                                    <span className="text-[11px] text-slate-400">
                                        ثبت‌شده از: <strong className="text-slate-200">{job.sourcePlatform === 'windows' ? 'ویندوز دسکتاپ' : 'وب سرور'}</strong>
                                    </span>

                                    {job.status === 'PENDING' ? (
                                        <button
                                            type="button"
                                            onClick={() => handleSendOnDevice(job.id)}
                                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg shadow-emerald-900/30 transition cursor-pointer"
                                        >
                                            <Smartphone size={14} />
                                            <span>ارسال با سیم‌کارت گوشی</span>
                                        </button>
                                    ) : (
                                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                                            <CheckCircle2 size={14} /> ارسال شده در {job.sentAt}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-slate-800 pt-4 shrink-0">
                    <button
                        type="button"
                        onClick={handleClear}
                        disabled={jobs.length === 0}
                        className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 px-3 py-2 rounded-xl hover:bg-rose-500/10 transition disabled:opacity-40 cursor-pointer"
                    >
                        <Trash2 size={14} />
                        <span>پاکسازی تاریخچه</span>
                    </button>

                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                        بستن
                    </button>
                </div>
            </div>
        </div>
    );
};
