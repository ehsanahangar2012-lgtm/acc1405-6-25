import React, { useState } from 'react';
import { useStore } from '../store';
import { AppUser, Role, UserPermissions, ModulePermission } from '../types';
import { generateId } from '../utils';
import { recoveryService } from '../services/recoveryService';
import { securityService } from '../services/securityService';
import { 
    Users as UsersIcon, 
    ShieldCheck, 
    UserPlus, 
    Shield, 
    Check, 
    X, 
    Eye, 
    Edit3, 
    Trash2, 
    UserCog, 
    Lock, 
    KeyRound, 
    CheckSquare, 
    Square, 
    Info, 
    AlertTriangle,
    Mail,
    Phone,
    HelpCircle,
    Sparkles,
    Copy
} from 'lucide-react';

const MODULES: (keyof UserPermissions)[] = ['dashboard', 'invoices', 'inventory', 'checks', 'finance', 'customers', 'reports', 'users', 'settings'];
const MODULE_LABELS: Record<keyof UserPermissions, string> = {
    dashboard: 'پیشخوان', invoices: 'فاکتورها', inventory: 'انبارداری', checks: 'چک‌ها',
    finance: 'امور مالی', customers: 'اشخاص', reports: 'گزارشات', users: 'کاربران', settings: 'تنظیمات'
};

const Users = () => {
    const { users, roles, addUser, updateUser, deleteUser, currentUser } = useStore();
    const [showUserModal, setShowUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState<Partial<AppUser> & { plainSecurityAnswer?: string } | null>(null);
    const [copiedKey, setCopiedKey] = useState(false);

    if (currentUser?.permissions.users.view === false) {
        return <div className="p-20 text-center text-slate-500 font-black">شما دسترسی به این بخش را ندارید.</div>;
    }

    const getEmptyPermissions = (): UserPermissions => {
        const p: any = {};
        MODULES.forEach(m => {
            p[m] = { view: false, create: false, edit: false, delete: false };
        });
        return p as UserPermissions;
    };

    const handleSaveUser = () => {
        if (!editingUser?.username || !editingUser?.fullName) return alert('اطلاعات نام کامل و نام کاربری الزامی است.');
        
        // اطمینان از وجود کلید بازیابی
        const recoveryKey = editingUser.recoveryKey && editingUser.recoveryKey.trim() 
            ? editingUser.recoveryKey.trim().toUpperCase() 
            : recoveryService.generateRecoveryKey();

        const userData: AppUser = {
            id: editingUser.id || generateId(),
            username: editingUser.username.trim(),
            fullName: editingUser.fullName.trim(),
            password: editingUser.password || (editingUser.id ? undefined : '123'),
            roleId: editingUser.roleId || 'user',
            is_active: true,
            permissions: editingUser.permissions || getEmptyPermissions(),
            email: editingUser.email ? editingUser.email.trim().toLowerCase() : undefined,
            phone: editingUser.phone ? editingUser.phone.trim() : undefined,
            recoveryKey: recoveryKey,
            securityQuestion: editingUser.securityQuestion ? editingUser.securityQuestion.trim() : undefined,
            securityAnswerHash: editingUser.plainSecurityAnswer 
                ? securityService.hashPassword(editingUser.plainSecurityAnswer.trim().toLowerCase()) 
                : editingUser.securityAnswerHash
        };

        if (editingUser.id) updateUser(editingUser.id, userData);
        else addUser(userData);
        
        setShowUserModal(false); 
        setEditingUser(null);
    };

    const togglePermission = (module: keyof UserPermissions, type: keyof ModulePermission) => {
        const currentPerms = editingUser?.permissions || getEmptyPermissions();
        const updatedModule = { ...currentPerms[module], [type]: !currentPerms[module][type] };
        
        setEditingUser({
            ...editingUser,
            permissions: { ...currentPerms, [module]: updatedModule }
        });
    };

    const handleCopyKey = (key: string) => {
        navigator.clipboard.writeText(key);
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900/40 p-8 rounded-[2.5rem] border border-white/5 shadow-2xl gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white">مدیریت کاربران و دسترسی‌ها</h1>
                    <p className="text-slate-400 text-sm mt-1">تعریف کاربران، تعیین سطوح دسترسی دقیق و پیکربندی بازیابی امن رمز عبور</p>
                </div>
                <button 
                    onClick={() => { 
                        setEditingUser({ 
                            permissions: getEmptyPermissions(),
                            recoveryKey: recoveryService.generateRecoveryKey()
                        }); 
                        setShowUserModal(true); 
                    }} 
                    className="bg-teal-600 hover:bg-teal-500 text-white px-8 py-4 rounded-2xl flex items-center gap-3 shadow-xl font-black active:scale-95 transition-all cursor-pointer"
                >
                    <UserPlus size={24} />
                    <span>افزودن کاربر جدید</span>
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {users.map(u => (
                    <div key={u.id} className="bg-slate-900/40 p-8 rounded-[3rem] border border-white/5 shadow-2xl group hover:border-teal-500/30 transition-all flex flex-col">
                        <div className="flex items-center gap-5 mb-6">
                            <div className="w-16 h-16 rounded-2xl bg-teal-500/10 flex items-center justify-center text-teal-400 border border-teal-500/20 shadow-inner">
                                <UserCog size={32}/>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-white font-black text-xl">{u.fullName}</h3>
                                <span className="text-[10px] text-slate-500 font-mono">@{u.username}</span>
                            </div>
                        </div>

                        {/* اطلاعات بازیابی حساب */}
                        <div className="mb-5 p-3.5 bg-slate-950/60 rounded-2xl border border-white/5 space-y-2 text-xs">
                            <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-400 flex items-center gap-1.5">
                                    <Mail size={13} className="text-teal-400" />
                                    ایمیل بازیابی:
                                </span>
                                <span className="font-mono text-slate-200">
                                    {u.email || (u.username === 'admin' ? 'ehsanahangar2010@gmail.com' : 'تنظیم نشده')}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-400 flex items-center gap-1.5">
                                    <KeyRound size={13} className="text-amber-400" />
                                    کلید اضطراری:
                                </span>
                                <span className="font-mono text-amber-300 font-bold">
                                    {recoveryService.getEffectiveRecoveryKey(u)}
                                </span>
                            </div>
                        </div>
                        
                        <div className="space-y-3 mb-6">
                            <div className="flex justify-between items-center text-[10px] text-slate-500 font-black uppercase tracking-tighter">
                                <span>دسترسی‌های فعال</span>
                                <span className="text-teal-400">{(Object.values(u.permissions) as ModulePermission[]).filter(p => p.view).length} بخش</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {MODULES.map(m => (u.permissions[m] as ModulePermission).view && (
                                    <span key={m} className="bg-white/5 text-slate-400 px-2 py-1 rounded-md text-[9px] font-bold border border-white/5">
                                        {MODULE_LABELS[m]}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-2 mt-auto">
                            <button onClick={() => { setEditingUser({ ...u, recoveryKey: recoveryService.getEffectiveRecoveryKey(u), email: u.email || (u.username === 'admin' ? 'admin@ashkghalam.ir' : '') }); setShowUserModal(true); }} className="flex-1 py-3 bg-white/5 text-slate-400 rounded-xl text-[10px] font-black hover:bg-white/10 border border-white/10 transition-all flex items-center justify-center gap-2 cursor-pointer">
                                <Edit3 size={14}/> ویرایش و دسترسی‌ها
                            </button>
                            <button 
                                onClick={() => {
                                    if (users.length <= 1) {
                                        alert('امکان حذف آخرین کاربر سیستم وجود ندارد. حداقل یک کاربر فعال در نرم‌افزار باید باقی بماند.');
                                        return;
                                    }
                                    const confirmMsg = u.id === currentUser?.id
                                        ? `⚠️ هشدار: شما در حال حذف حساب کاربری جاری خودتان (${u.fullName || u.username}) هستید و از سامانه خارج خواهید شد. آیا مطمئن هستید؟`
                                        : `آیا از حذف کامل کاربر "${u.fullName || u.username}" اطمینان دارید؟`;
                                    if (window.confirm(confirmMsg)) {
                                        deleteUser(u.id);
                                        if (u.id === currentUser?.id) {
                                            window.location.reload();
                                        }
                                    }
                                }} 
                                className="p-3 bg-rose-500/10 text-rose-500 rounded-xl border border-rose-500/10 hover:bg-rose-500/20 transition-all cursor-pointer"
                                title="حذف کاربر"
                            >
                                <Trash2 size={18}/>
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {showUserModal && editingUser && (
                <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-slate-900 border border-white/10 w-full max-w-5xl rounded-[3rem] shadow-2xl animate-pop-up overflow-hidden my-10">
                        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-slate-800/40">
                            <h3 className="text-2xl font-black text-white flex items-center gap-3">
                                <UserCog className="text-teal-400"/> {editingUser.id ? 'ویرایش کاربر و سطوح دسترسی' : 'تعریف کاربر جدید'}
                            </h3>
                            <button onClick={() => setShowUserModal(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 text-white cursor-pointer"><X size={24}/></button>
                        </div>
                        
                        <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh] custom-scrollbar">
                            
                            {/* مشخصات اصلی کاربر */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-slate-500 text-[10px] font-black pr-4 uppercase">نام کامل کاربر</label>
                                    <input className="w-full bg-slate-950 p-4 rounded-2xl border border-white/5 text-white font-black shadow-inner outline-none focus:border-teal-500" placeholder="مثلاً: علی رضایی" value={editingUser.fullName || ''} onChange={e => setEditingUser({...editingUser, fullName: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-slate-500 text-[10px] font-black pr-4 uppercase">نام کاربری (Login)</label>
                                    <input className="w-full bg-slate-950 p-4 rounded-2xl border border-white/5 text-white font-mono shadow-inner outline-none focus:border-teal-500" placeholder="username" value={editingUser.username || ''} onChange={e => setEditingUser({...editingUser, username: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-slate-500 text-[10px] font-black pr-4 uppercase">رمز عبور {editingUser.id && '(خالی بگذارید تا تغییر نکند)'}</label>
                                    <input className="w-full bg-slate-950 p-4 rounded-2xl border border-white/5 text-white font-mono shadow-inner outline-none focus:border-teal-500" type="password" placeholder="••••••" value={editingUser.password || ''} onChange={e => setEditingUser({...editingUser, password: e.target.value})} />
                                </div>
                            </div>

                            {/* تنظیمات بازیابی هوشمند و امنیت حساب */}
                            <div className="p-6 bg-slate-950/80 rounded-3xl border border-teal-500/20 space-y-6">
                                <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                                    <ShieldCheck className="text-teal-400" size={22} />
                                    <div>
                                        <h4 className="text-white font-black text-sm">پیکربندی بازیابی هوشمند رمز عبور (Recovery Channels)</h4>
                                        <p className="text-slate-400 text-xs">اطلاعات این بخش برای احراز هویت دو مرحله‌ای و بازیابی در صورت فراموشی رمز استفاده می‌شود.</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs text-slate-300 font-bold flex items-center gap-2">
                                            <Mail size={14} className="text-teal-400" />
                                            ایمیل بازیابی (ارسال کد تأیید OTP)
                                        </label>
                                        <input
                                            type="email"
                                            className="w-full bg-slate-900 border border-slate-700/80 rounded-2xl p-3.5 text-white font-mono text-sm outline-none focus:border-teal-500"
                                            placeholder="email@example.com"
                                            value={editingUser.email || ''}
                                            onChange={e => setEditingUser({ ...editingUser, email: e.target.value })}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs text-slate-300 font-bold flex items-center justify-between">
                                            <span className="flex items-center gap-2">
                                                <KeyRound size={14} className="text-amber-400" />
                                                کلید پشتیبان اضطراری (Master Recovery Key)
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setEditingUser({ ...editingUser, recoveryKey: recoveryService.generateRecoveryKey() })}
                                                className="text-[11px] text-teal-400 hover:text-teal-300 flex items-center gap-1 cursor-pointer font-bold"
                                            >
                                                <Sparkles size={12} />
                                                تولید کلید جدید
                                            </button>
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                className="flex-1 bg-slate-900 border border-slate-700/80 rounded-2xl p-3.5 text-amber-300 font-mono text-sm font-bold uppercase tracking-wider outline-none focus:border-teal-500 text-center"
                                                placeholder="ASHK-REC-XXXX-XXXX"
                                                value={editingUser.recoveryKey || ''}
                                                onChange={e => setEditingUser({ ...editingUser, recoveryKey: e.target.value })}
                                            />
                                            {editingUser.recoveryKey && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyKey(editingUser.recoveryKey!)}
                                                    className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl border border-white/5 flex items-center justify-center transition cursor-pointer"
                                                    title="کپی کلید"
                                                >
                                                    {copiedKey ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-xs text-slate-300 font-bold flex items-center gap-2">
                                            <HelpCircle size={14} className="text-purple-400" />
                                            پرسش امنیتی (اختیاری)
                                        </label>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <input
                                                type="text"
                                                className="w-full bg-slate-900 border border-slate-700/80 rounded-2xl p-3.5 text-white text-xs outline-none focus:border-teal-500"
                                                placeholder="مثلاً: نام اولین مدرسه یا شرکت شما چیست؟"
                                                value={editingUser.securityQuestion || ''}
                                                onChange={e => setEditingUser({ ...editingUser, securityQuestion: e.target.value })}
                                            />
                                            <input
                                                type="text"
                                                className="w-full bg-slate-900 border border-slate-700/80 rounded-2xl p-3.5 text-white text-xs outline-none focus:border-teal-500"
                                                placeholder="پاسخ امنیتی (فقط برای تأیید اعتبار)"
                                                value={editingUser.plainSecurityAnswer || ''}
                                                onChange={e => setEditingUser({ ...editingUser, plainSecurityAnswer: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ماتریس دسترسی‌ها */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                                    <ShieldCheck className="text-teal-400" size={24}/>
                                    <h4 className="text-white font-black text-lg">ماتریس سطوح دسترسی هوشمند</h4>
                                </div>
                                
                                <div className="grid grid-cols-12 gap-2 text-[10px] text-slate-500 font-black px-4 uppercase tracking-widest text-center mb-2">
                                    <div className="col-span-4 text-right">نام ماژول سیستم</div>
                                    <div className="col-span-2">نمایش (View)</div>
                                    <div className="col-span-2">ایجاد (Create)</div>
                                    <div className="col-span-2">ویرایش (Edit)</div>
                                    <div className="col-span-2">حذف (Delete)</div>
                                </div>

                                <div className="space-y-3">
                                    {MODULES.map(m => (
                                        <div key={m} className={`grid grid-cols-12 gap-2 items-center p-4 rounded-2xl border transition-all bg-black/40 border-white/5 shadow-inner`}>
                                            <div className="col-span-4 flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs bg-teal-500/10 text-teal-400`}>
                                                    <CheckSquare size={14}/>
                                                </div>
                                                <span className="font-black text-white text-sm">{MODULE_LABELS[m]}</span>
                                            </div>
                                            
                                            {(['view', 'create', 'edit', 'delete'] as const).map(type => (
                                                <div key={type} className="col-span-2 flex justify-center">
                                                    <button 
                                                        onClick={() => togglePermission(m, type)} 
                                                        className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                                                            editingUser.permissions?.[m][type] 
                                                            ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20' 
                                                            : 'bg-white/5 text-slate-700 hover:text-slate-500'
                                                        }`}
                                                    >
                                                        {editingUser.permissions?.[m][type] ? <CheckSquare size={22}/> : <Square size={22}/>}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-8 border-t border-white/5 bg-slate-950 flex gap-4 shadow-inner">
                            <button onClick={handleSaveUser} className="flex-1 bg-teal-600 hover:bg-teal-500 text-white py-5 rounded-2xl font-black text-xl shadow-xl active:scale-95 transition-all cursor-pointer">
                                ذخیره و اعمال دسترسی‌ها
                            </button>
                            <button onClick={() => setShowUserModal(false)} className="px-12 py-5 bg-slate-800 text-white rounded-2xl font-black transition-all cursor-pointer">
                                انصراف
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Users;
