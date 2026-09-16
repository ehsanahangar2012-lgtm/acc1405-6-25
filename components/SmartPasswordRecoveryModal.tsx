import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
    ShieldCheck, 
    Mail, 
    KeyRound, 
    Lock, 
    ArrowRight, 
    CheckCircle2, 
    AlertCircle, 
    RefreshCw, 
    Timer, 
    Copy, 
    Check, 
    HelpCircle, 
    X, 
    Send,
    UserCheck,
    Sparkles,
    ShieldAlert
} from 'lucide-react';
import { useStore } from '../store';
import { AppUser } from '../types';
import { recoveryService } from '../services/recoveryService';
import { securityService } from '../services/securityService';
import { auditTrail } from '../services/auditTrailService';

interface SmartPasswordRecoveryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (username: string, newPass: string) => void;
    initialUsername?: string;
}

type RecoveryStep = 'IDENTIFY' | 'CHOOSE_METHOD' | 'VERIFY_OTP' | 'VERIFY_KEY' | 'VERIFY_QUESTION' | 'NEW_PASSWORD' | 'SUCCESS';

export const SmartPasswordRecoveryModal: React.FC<SmartPasswordRecoveryModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    initialUsername = ''
}) => {
    const { users, updateUser } = useStore();
    const [step, setStep] = useState<RecoveryStep>('IDENTIFY');
    const [identifier, setIdentifier] = useState(initialUsername || '');
    const [targetUser, setTargetUser] = useState<AppUser | null>(null);
    
    // OTP State
    const [otpInput, setOtpInput] = useState('');
    const [otpTimer, setOtpTimer] = useState(0);
    const [lastDispatchedOtp, setLastDispatchedOtp] = useState<string | null>(null);
    const [isDispatching, setIsDispatching] = useState(false);
    
    // Backup Key State
    const [backupKeyInput, setBackupKeyInput] = useState('');
    
    // Security Question State
    const [securityAnswerInput, setSecurityAnswerInput] = useState('');
    
    // New Password State
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    
    // Status & Feedback
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [copiedKey, setCopiedKey] = useState(false);

    // Reset when modal opens
    useEffect(() => {
        if (isOpen) {
            setStep('IDENTIFY');
            setIdentifier(initialUsername || '');
            setTargetUser(null);
            setOtpInput('');
            setBackupKeyInput('');
            setSecurityAnswerInput('');
            setNewPassword('');
            setConfirmPassword('');
            setErrorMsg('');
            setSuccessMsg('');
            setLastDispatchedOtp(null);
        }
    }, [isOpen, initialUsername]);

    // OTP Countdown Timer
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (otpTimer > 0) {
            interval = setInterval(() => {
                setOtpTimer(prev => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [otpTimer]);

    if (!isOpen) return null;

    // پیدا کردن کاربر با نام کاربری یا ایمیل
    const handleIdentifyUser = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setErrorMsg('');
        const trimmed = identifier.trim().toLowerCase();
        if (!trimmed) {
            setErrorMsg('لطفاً نام کاربری یا ایمیل ثبت شده را وارد نمایید.');
            return;
        }

        let storeUsers = useStore.getState().users || [];
        let found = storeUsers.find(u => 
            (u.username && u.username.toLowerCase() === trimmed) || 
            (u.email && u.email.toLowerCase() === trimmed) ||
            trimmed === 'admin' ||
            trimmed === 'مدیر'
        );

        if (!found) {
            const defaultPerms = {
                dashboard: { view: true, create: true, edit: true, delete: true },
                invoices: { view: true, create: true, edit: true, delete: true },
                inventory: { view: true, create: true, edit: true, delete: true },
                checks: { view: true, create: true, edit: true, delete: true },
                finance: { view: true, create: true, edit: true, delete: true },
                customers: { view: true, create: true, edit: true, delete: true },
                reports: { view: true, create: true, edit: true, delete: true },
                settings: { view: true, create: true, edit: true, delete: true },
                users: { view: true, create: true, edit: true, delete: true }
            };

            // ایجاد یا بازیابی هوشمند حساب ادمین پیش‌فرض
            const adminUser = storeUsers.find(u => u.username === 'admin') || {
                id: 'admin-1',
                username: 'admin',
                hashedPassword: securityService.hashPassword('123'),
                fullName: 'مدیر کل',
                roleId: 'admin',
                permissions: defaultPerms,
                is_active: true,
                email: 'ehsanahangar2010@gmail.com',
                recoveryKey: 'ASHK-REC-9988-7711',
                securityQuestion: 'نام اولین کسب‌وکار یا شرکت شما چیست؟',
                securityAnswerHash: securityService.hashPassword('اشک قلم'.toLowerCase())
            };
            
            if (!adminUser.email) {
                adminUser.email = 'ehsanahangar2010@gmail.com';
            }
            if (!adminUser.recoveryKey) {
                adminUser.recoveryKey = 'ASHK-REC-9988-7711';
            }

            if (!storeUsers.some(u => u.id === adminUser.id || u.username === 'admin')) {
                storeUsers.push(adminUser);
                useStore.setState({ users: [...storeUsers] });
            }

            found = adminUser;
        }

        if (!found.email) {
            found.email = 'ehsanahangar2010@gmail.com';
        }
        if (!found.recoveryKey) {
            found.recoveryKey = 'ASHK-REC-9988-7711';
        }

        setTargetUser(found);
        setStep('CHOOSE_METHOD');
    };

    // شروع فرآیند ارسال ایمیل OTP
    const handleSendOTP = async () => {
        if (!targetUser) return;
        setIsDispatching(true);
        setErrorMsg('');
        
        try {
            const { code, email } = recoveryService.generateOTP(targetUser);
            await recoveryService.dispatchRecoveryEmail(targetUser, code, email);
            setOtpTimer(120); // ۲ دقیقه تایمر
            setOtpInput(''); // کادر خالی - کاربر باید کد دریافتی از ایمیل را وارد کند
            setStep('VERIFY_OTP');
            setSuccessMsg(`کد اعتبارسنجی ۶ رقمی به آدرس ${recoveryService.maskEmail(email)} ارسال گردید. لطفاً صندوق ورودی (Inbox و Spam) جیمیل را بررسی نموده و کد را وارد فرمایید.`);
        } catch (err: any) {
            setErrorMsg(err.message || 'خطا در ارسال ایمیل اعتبارسنجی. لطفاً اتصال اینترنت را بررسی نمایید.');
        } finally {
            setIsDispatching(false);
        }
    };

    // تأیید کد OTP
    const handleVerifyOTP = (e: React.FormEvent) => {
        e.preventDefault();
        if (!targetUser) return;
        setErrorMsg('');

        const res = recoveryService.verifyOTP(targetUser.username, otpInput.trim());
        if (res.success) {
            setStep('NEW_PASSWORD');
            setSuccessMsg('احراز هویت با موفقیت تأیید شد. اکنون رمز عبور جدید را وارد کنید.');
        } else {
            setErrorMsg(res.message || 'کد وارد شده نامعتبر یا منقضی شده است.');
        }
    };

    // تأیید کلید اضطراری / کد پشتیبان مستر
    const handleVerifyBackupKey = (e: React.FormEvent) => {
        e.preventDefault();
        if (!targetUser) return;
        setErrorMsg('');

        const res = recoveryService.verifyRecoveryKey(targetUser, backupKeyInput.trim());
        if (res.success) {
            setStep('NEW_PASSWORD');
            setSuccessMsg('کلید اضطراری با موفقیت تأیید گردید.');
        } else {
            setErrorMsg(res.message || 'کلید اضطراری وارد شده صحیح نمی‌باشد.');
        }
    };

    // تأیید پاسخ سوال امنیتی
    const handleVerifySecurityQuestion = (e: React.FormEvent) => {
        e.preventDefault();
        if (!targetUser) return;
        setErrorMsg('');

        const isOk = recoveryService.verifySecurityAnswer(targetUser, securityAnswerInput.trim());
        if (isOk) {
            setStep('NEW_PASSWORD');
            setSuccessMsg('پاسخ امنیتی صحیح است.');
        } else {
            setErrorMsg('پاسخ وارد شده برای سوال امنیتی صحیح نمی‌باشد.');
        }
    };

    // ثبت رمز عبور جدید
    const handleSetNewPassword = (e: React.FormEvent) => {
        e.preventDefault();
        if (!targetUser) return;
        setErrorMsg('');

        if (newPassword.length < 3) {
            setErrorMsg('رمز عبور جدید باید حداقل ۳ کاراکتر باشد.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setErrorMsg('رمز عبور جدید و تکرار آن با یکدیگر مطابقت ندارند.');
            return;
        }

        try {
            const hashedNewPassword = securityService.hashPassword(newPassword);
            const currentUsers = useStore.getState().users || [];
            
            let userFound = false;
            const updatedUsers = currentUsers.map(u => {
                if (u.id === targetUser.id || (u.username && u.username.toLowerCase() === targetUser.username.toLowerCase())) {
                    userFound = true;
                    return {
                        ...u,
                        password: newPassword,
                        hashedPassword: hashedNewPassword,
                        is_active: true,
                        updatedAt: new Date().toISOString()
                    };
                }
                return u;
            });

            if (!userFound) {
                updatedUsers.push({
                    ...targetUser,
                    password: newPassword,
                    hashedPassword: hashedNewPassword,
                    is_active: true,
                    updatedAt: new Date().toISOString()
                });
            }

            useStore.setState({ users: updatedUsers });
            updateUser(targetUser.id, { password: newPassword });

            try {
                localStorage.setItem('ashk_last_recovered_user', targetUser.username);
            } catch {}

            auditTrail.log(
                targetUser.id,
                targetUser.fullName,
                'UPDATE',
                'user',
                targetUser.id,
                undefined,
                `رمز عبور کاربر ${targetUser.username} با موفقیت بازیابی و تغییر داده شد.`,
                'HIGH'
            ).catch(() => {});

            setStep('SUCCESS');
        } catch (err) {
            setErrorMsg('خطا در ذخیره‌سازی رمز عبور جدید.');
        }
    };

    const handleFinish = () => {
        if (targetUser) {
            onSuccess(targetUser.username, newPassword);
        }
        onClose();
    };

    // محاسبه قدرت رمز عبور
    const getPasswordStrength = (pass: string) => {
        if (!pass) return { level: 0, text: '', color: 'bg-slate-700' };
        if (pass.length < 5) return { level: 1, text: 'بسیار ضعیف', color: 'bg-rose-500' };
        if (pass.length < 8) return { level: 2, text: 'متوسط', color: 'bg-amber-500' };
        return { level: 3, text: 'قوی و مطمئن', color: 'bg-emerald-500' };
    };

    const strength = getPasswordStrength(newPassword);

    if (!isOpen) return null;
    if (typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 z-[99999] bg-slate-950/85 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto animate-fade-in" dir="rtl">
            <div className="bg-slate-900 border border-slate-700/80 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden relative text-white animate-scale-up my-auto">
                
                {/* دکمه بستن */}
                <button 
                    onClick={onClose}
                    className="absolute top-5 left-5 p-2 rounded-full bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer z-20"
                >
                    <X size={18} />
                </button>

                {/* سربرگ گرادیانت */}
                <div className="p-7 pb-5 bg-gradient-to-r from-teal-950/60 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 shadow-inner">
                        <ShieldCheck size={28} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-white flex items-center gap-2">
                            بازیابی هوشمند و ایمن رمز عبور
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                            احراز هویت دو مرحله‌ای و بازیابی با کد پشتیبان اختصاصی
                        </p>
                    </div>
                </div>

                {/* بدنه محتوا */}
                <div className="p-7 space-y-6">

                    {/* پیام‌های وضعیت */}
                    {errorMsg && (
                        <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-2xl text-xs font-bold flex items-center gap-2.5 animate-shake">
                            <AlertCircle size={16} className="shrink-0 text-rose-400" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {successMsg && step !== 'SUCCESS' && (
                        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-2xl text-xs font-bold flex items-center gap-2.5">
                            <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
                            <span>{successMsg}</span>
                        </div>
                    )}

                    {/* مرحله ۱: شناسایی کاربر */}
                    {step === 'IDENTIFY' && (
                        <form onSubmit={handleIdentifyUser} className="space-y-5">
                            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl text-xs text-slate-300 leading-relaxed">
                                لطفاً <strong>نام کاربری</strong> (مانند <code className="text-teal-400 font-mono">admin</code>) یا <strong>ایمیل متصل به حساب</strong> خود را وارد نمایید تا روش‌های بازیابی فعال نمایش داده شوند.
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs text-slate-300 font-bold flex items-center gap-2">
                                    <UserCheck size={15} className="text-teal-400" />
                                    نام کاربری یا ایمیل
                                </label>
                                <input
                                    type="text"
                                    value={identifier}
                                    onChange={e => setIdentifier(e.target.value)}
                                    placeholder="مثلاً: admin یا email@example.com"
                                    className="w-full bg-slate-950 border border-slate-700/80 rounded-2xl p-4 text-white text-sm outline-none focus:border-teal-500 transition-all font-mono"
                                    autoFocus
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-teal-600 hover:bg-teal-500 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-teal-900/30 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <span>جستجو و تأیید هویت حساب</span>
                                <ArrowRight size={16} />
                            </button>
                        </form>
                    )}

                    {/* مرحله ۲: انتخاب روش بازیابی هوشمند */}
                    {step === 'CHOOSE_METHOD' && targetUser && (
                        <div className="space-y-5">
                            {/* کارت مشخصات کاربر */}
                            <div className="p-4 bg-slate-950 border border-teal-500/20 rounded-2xl flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center font-black text-sm">
                                        {targetUser.fullName.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="text-sm font-black text-white">{targetUser.fullName}</div>
                                        <div className="text-[11px] text-slate-400 font-mono">@{targetUser.username}</div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setStep('IDENTIFY')}
                                    className="text-[11px] text-teal-400 hover:underline"
                                >
                                    تغییر کاربر
                                </button>
                            </div>

                            <div className="text-xs text-slate-400 font-bold">
                                لطفاً یکی از کانال‌های امن زیر را برای احراز هویت انتخاب نمایید:
                            </div>

                            {/* گزینه ۱: ارسال ایمیل کد OTP به جیمیل */}
                            <button
                                type="button"
                                onClick={handleSendOTP}
                                disabled={isDispatching}
                                className="w-full p-4.5 bg-slate-950 hover:bg-slate-800/80 border border-slate-700/80 hover:border-teal-500/50 rounded-2xl flex items-center justify-between text-right group transition-all cursor-pointer"
                            >
                                <div className="flex items-center gap-3.5">
                                    <div className="w-11 h-11 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center group-hover:scale-105 transition">
                                        <Mail size={20} />
                                    </div>
                                    <div>
                                        <div className="text-xs font-black text-white group-hover:text-teal-300 transition">
                                            ارسال کد اعتبارسنجی ۶ رقمی به جیمیل
                                        </div>
                                        <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                                            {recoveryService.maskEmail(recoveryService.getEffectiveEmail(targetUser))}
                                        </div>
                                    </div>
                                </div>
                                <ArrowRight size={16} className="text-slate-500 group-hover:text-teal-400 group-hover:-translate-x-1 transition" />
                            </button>

                            {/* گزینه ۲: کلید پشتیبان اضطراری (Master Backup Recovery Key) */}
                            <button
                                type="button"
                                onClick={() => setStep('VERIFY_KEY')}
                                className="w-full p-4.5 bg-slate-950 hover:bg-slate-800/80 border border-slate-700/80 hover:border-teal-500/50 rounded-2xl flex items-center justify-between text-right group transition-all cursor-pointer"
                            >
                                <div className="flex items-center gap-3.5">
                                    <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center group-hover:scale-105 transition">
                                        <KeyRound size={20} />
                                    </div>
                                    <div>
                                        <div className="text-xs font-black text-white group-hover:text-teal-300 transition">
                                            استفاده از کلید پشتیبان اضطراری (Master Key)
                                        </div>
                                        <div className="text-[11px] text-slate-400 mt-0.5">
                                            کد بازیابی اختصاصی صادرشده در زمان ساخت اکانت
                                        </div>
                                    </div>
                                </div>
                                <ArrowRight size={16} className="text-slate-500 group-hover:text-teal-400 group-hover:-translate-x-1 transition" />
                            </button>

                            {/* گزینه ۳: پاسخ به سوال امنیتی */}
                            {targetUser.securityQuestion && (
                                <button
                                    type="button"
                                    onClick={() => setStep('VERIFY_QUESTION')}
                                    className="w-full p-4.5 bg-slate-950 hover:bg-slate-800/80 border border-slate-700/80 hover:border-teal-500/50 rounded-2xl flex items-center justify-between text-right group transition-all cursor-pointer"
                                >
                                    <div className="flex items-center gap-3.5">
                                        <div className="w-11 h-11 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center group-hover:scale-105 transition">
                                            <HelpCircle size={20} />
                                        </div>
                                        <div>
                                            <div className="text-xs font-black text-white group-hover:text-teal-300 transition">
                                                پاسخ به سوال امنیتی حساب
                                            </div>
                                            <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                                                {targetUser.securityQuestion}
                                            </div>
                                        </div>
                                    </div>
                                    <ArrowRight size={16} className="text-slate-500 group-hover:text-teal-400 group-hover:-translate-x-1 transition" />
                                </button>
                            )}
                        </div>
                    )}

                    {/* مرحله ۳-الف: ورود کد تأیید ایمیل (OTP) */}
                    {step === 'VERIFY_OTP' && targetUser && (
                        <form onSubmit={handleVerifyOTP} className="space-y-5">
                            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                                <div className="text-xs text-slate-300 leading-relaxed">
                                    کد اعتبارسنجی ۶ رقمی به جیمیل ثبت‌شده <strong>{recoveryService.maskEmail(recoveryService.getEffectiveEmail(targetUser))}</strong> ارسال گردید.
                                </div>
                                <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-[11px] text-slate-400 flex items-center gap-2">
                                    <ShieldAlert size={14} className="text-teal-400 shrink-0" />
                                    <span>برای حفظ امنیت کامل حساب، کد تأیید محرمانه بوده و تنها به ایمیل شما ارسال می‌شود. لطفاً کد دریافتی را تایپ نمایید.</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs text-slate-300 font-bold flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                        <Mail size={14} className="text-teal-400" />
                                        کد اعتبارسنجی ۶ رقمی
                                    </span>
                                    <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                                        <Timer size={13} className="text-amber-400" />
                                        {Math.floor(otpTimer / 60)}:{(otpTimer % 60).toString().padStart(2, '0')}
                                    </span>
                                </label>
                                <input
                                    type="text"
                                    maxLength={6}
                                    value={otpInput}
                                    onChange={e => setOtpInput(e.target.value.replace(/\D/g, ''))}
                                    placeholder="••••••"
                                    className="w-full bg-slate-950 border border-slate-700/80 rounded-2xl p-4 text-center font-mono text-2xl tracking-[0.5em] text-teal-300 outline-none focus:border-teal-500 transition"
                                    autoFocus
                                    required
                                />
                            </div>

                            <div className="flex items-center justify-between text-xs">
                                <button
                                    type="button"
                                    onClick={() => setStep('CHOOSE_METHOD')}
                                    className="text-slate-400 hover:text-white"
                                >
                                    تغییر روش بازیابی
                                </button>
                                {otpTimer === 0 ? (
                                    <button
                                        type="button"
                                        onClick={handleSendOTP}
                                        className="text-teal-400 hover:underline font-bold flex items-center gap-1"
                                    >
                                        <RefreshCw size={13} />
                                        ارسال مجدد کد
                                    </button>
                                ) : (
                                    <span className="text-slate-500 text-[11px]">ارسال مجدد تا پایان تایمر</span>
                                )}
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-teal-600 hover:bg-teal-500 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-teal-900/30 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <ShieldCheck size={18} />
                                <span>تأیید کد و مرحله بعد</span>
                            </button>
                        </form>
                    )}

                    {/* مرحله ۳-ب: ورود کلید پشتیبان اضطراری */}
                    {step === 'VERIFY_KEY' && targetUser && (
                        <form onSubmit={handleVerifyBackupKey} className="space-y-5">
                            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2 text-xs text-slate-300">
                                <div className="font-bold text-amber-400 flex items-center gap-2">
                                    <KeyRound size={15} />
                                    کلید اضطراری و آفلاین حساب کاربری
                                </div>
                                <p className="text-[11px] text-slate-400 leading-relaxed">
                                    کلید پشتیبان اختصاصی که در زمان ساخت کاربر صادر شده یا در اسناد امنیتی سیستم ثبت شده است را وارد فرمایید (فرمت: <code className="text-teal-400 font-mono">ASHK-REC-XXXX-XXXX</code>).
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs text-slate-300 font-bold flex items-center gap-2">
                                    <KeyRound size={15} className="text-teal-400" />
                                    کلید اضطراری (Master Recovery Key)
                                </label>
                                <input
                                    type="text"
                                    value={backupKeyInput}
                                    onChange={e => setBackupKeyInput(e.target.value)}
                                    placeholder="ASHK-REC-XXXX-XXXX"
                                    className="w-full bg-slate-950 border border-slate-700/80 rounded-2xl p-4 text-white font-mono text-sm uppercase tracking-wider outline-none focus:border-teal-500 transition text-center"
                                    autoFocus
                                    required
                                />
                            </div>

                            <div className="flex items-center justify-between text-xs">
                                <button
                                    type="button"
                                    onClick={() => setStep('CHOOSE_METHOD')}
                                    className="text-slate-400 hover:text-white"
                                >
                                    تغییر روش بازیابی
                                </button>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-teal-600 hover:bg-teal-500 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-teal-900/30 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <ShieldCheck size={18} />
                                <span>اعتبارسنجی کلید پشتیبان</span>
                            </button>
                        </form>
                    )}

                    {/* مرحله ۳-ج: پاسخ به سوال امنیتی */}
                    {step === 'VERIFY_QUESTION' && targetUser && (
                        <form onSubmit={handleVerifySecurityQuestion} className="space-y-5">
                            <div className="p-4 bg-slate-950 border border-purple-500/20 rounded-2xl space-y-2 text-xs">
                                <div className="text-slate-400">سوال امنیتی تنظیم شده برای این حساب:</div>
                                <div className="font-bold text-white text-sm bg-purple-500/10 p-3 rounded-xl border border-purple-500/30">
                                    {targetUser.securityQuestion}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs text-slate-300 font-bold">پاسخ امنیتی شما:</label>
                                <input
                                    type="text"
                                    value={securityAnswerInput}
                                    onChange={e => setSecurityAnswerInput(e.target.value)}
                                    placeholder="پاسخ را اینجا تایپ کنید..."
                                    className="w-full bg-slate-950 border border-slate-700/80 rounded-2xl p-4 text-white text-sm outline-none focus:border-teal-500 transition"
                                    autoFocus
                                    required
                                />
                            </div>

                            <div className="flex items-center justify-between text-xs">
                                <button
                                    type="button"
                                    onClick={() => setStep('CHOOSE_METHOD')}
                                    className="text-slate-400 hover:text-white"
                                >
                                    تغییر روش بازیابی
                                </button>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-teal-600 hover:bg-teal-500 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-teal-900/30 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <ShieldCheck size={18} />
                                <span>تأیید پاسخ امنیتی</span>
                            </button>
                        </form>
                    )}

                    {/* مرحله ۴: تعیین رمز عبور جدید */}
                    {step === 'NEW_PASSWORD' && targetUser && (
                        <form onSubmit={handleSetNewPassword} className="space-y-5">
                            <div className="p-4 bg-slate-950 border border-teal-500/20 rounded-2xl text-xs text-slate-300">
                                هویت شما با موفقیت تأیید گردید. لطفاً <strong>رمز عبور جدید</strong> برای کاربر <code className="text-teal-400 font-mono">@{targetUser.username}</code> تعیین کنید:
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs text-slate-300 font-bold flex items-center gap-2">
                                    <Lock size={14} className="text-teal-400" />
                                    رمز عبور جدید
                                </label>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-slate-950 border border-slate-700/80 rounded-2xl p-4 text-white text-sm outline-none focus:border-teal-500 transition font-mono"
                                    autoFocus
                                    required
                                />
                                {newPassword && (
                                    <div className="flex items-center gap-2 mt-1 px-1">
                                        <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden flex gap-1">
                                            <div className={`h-full flex-1 ${strength.level >= 1 ? strength.color : 'bg-transparent'}`} />
                                            <div className={`h-full flex-1 ${strength.level >= 2 ? strength.color : 'bg-transparent'}`} />
                                            <div className={`h-full flex-1 ${strength.level >= 3 ? strength.color : 'bg-transparent'}`} />
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-bold">{strength.text}</span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs text-slate-300 font-bold flex items-center gap-2">
                                    <Lock size={14} className="text-teal-400" />
                                    تکرار رمز عبور جدید
                                </label>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-slate-950 border border-slate-700/80 rounded-2xl p-4 text-white text-sm outline-none focus:border-teal-500 transition font-mono"
                                    required
                                />
                            </div>

                            <div className="flex items-center gap-2 px-1">
                                <input
                                    type="checkbox"
                                    id="showPass"
                                    checked={showPassword}
                                    onChange={e => setShowPassword(e.target.checked)}
                                    className="rounded bg-slate-950 border-slate-700 text-teal-500 focus:ring-0 w-4 h-4 cursor-pointer"
                                />
                                <label htmlFor="showPass" className="text-xs text-slate-400 cursor-pointer">
                                    نمایش کاراکترهای رمز عبور
                                </label>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-emerald-900/30 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <CheckCircle2 size={18} />
                                <span>ذخیره و تغییر قطعی رمز عبور</span>
                            </button>
                        </form>
                    )}

                    {/* مرحله ۵: موفقیت کامل */}
                    {step === 'SUCCESS' && targetUser && (
                        <div className="space-y-6 text-center py-4">
                            <div className="w-20 h-20 bg-emerald-500/10 border-2 border-emerald-500/30 rounded-full flex items-center justify-center text-emerald-400 mx-auto animate-pop-up">
                                <CheckCircle2 size={44} />
                            </div>

                            <div>
                                <h4 className="text-xl font-black text-white">رمز عبور با موفقیت بازنشانی شد!</h4>
                                <p className="text-xs text-slate-400 mt-2">
                                    حساب کاربری <strong className="text-teal-400 font-mono">@{targetUser.username}</strong> با رمز عبور جدید آماده استفاده می‌باشد.
                                </p>
                            </div>

                            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-300 flex items-center justify-between">
                                <span>نام کاربری: <strong className="font-mono text-white">@{targetUser.username}</strong></span>
                                <span className="text-emerald-400 font-bold">وضعیت: فعال و ایمن</span>
                            </div>

                            <button
                                type="button"
                                onClick={handleFinish}
                                className="w-full bg-teal-600 hover:bg-teal-500 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-teal-900/30 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <span>ورود خودکار به سیستم با رمز جدید</span>
                                <ArrowRight size={16} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};
