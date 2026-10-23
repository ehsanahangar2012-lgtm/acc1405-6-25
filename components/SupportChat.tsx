import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  MessageCircle, X, Send, Bot, Phone, Mail, Minimize2, Maximize2, 
  CheckCircle2, Cloud, RefreshCw, Smartphone, ShieldCheck, Sparkles, User,
  Bell, BellRing, PhoneCall, Volume2, ShieldAlert
} from 'lucide-react';
import { useStore } from '../store';
import { notificationService } from '../services/notificationService';
import { adminChatNotificationService, SupportChatMessage } from '../services/adminChatNotificationService';
import { toPersianDigits } from '../utils';
import { workspaceService } from '../services/workspaceService';

interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'support' | 'system';
  senderName?: string;
  phone?: string;
  workspace_id?: string;
  timestamp: string | Date;
  synced_to_mother?: boolean;
}

const getSupportHistoryKey = () => `ashk_support_chat_history:${workspaceService.getWorkspaceId()}`;
const getSupportPhoneKey = () => `ashk_support_phone:${workspaceService.getWorkspaceId()}`;

const SupportChat: React.FC = () => {
  const currentUser = useStore(state => state.currentUser);
  const isOnline = useStore(state => state.isOnline);
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [serverOnline, setServerOnline] = useState<boolean>(true);
  const [isCheckingServer, setIsCheckingServer] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifPermissionGranted, setNotifPermissionGranted] = useState<boolean>(false);

  // بررسی وضعیت ادمین
  const isAdmin = currentUser?.roleId === 'admin' || currentUser?.username === 'admin' || currentUser?.roleId === 'MANAGER';
  const [sendAsAdmin, setSendAsAdmin] = useState<boolean>(isAdmin);
  const isMotherPortal = ['default', 'main'].includes(workspaceService.getWorkspaceId());
  const [replyWorkspaceId, setReplyWorkspaceId] = useState('');

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(getSupportHistoryKey());
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: '1',
        text: 'سلام و احترام! سیستم پشتیبانی برخط و ارتباط با وب‌سرور مادر اشک قلم آماده دریافت پیام‌ها و درخواست‌های شماست.',
        sender: 'support',
        senderName: 'پشتیبانی مرکزی',
        timestamp: new Date().toISOString(),
        synced_to_mother: true
      }
    ];
  });

  const [newMessage, setNewMessage] = useState('');
  const [userPhone, setUserPhone] = useState(() => localStorage.getItem(getSupportPhoneKey()) || '');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // اشتراک در سرویس نوتیفیکیشن ادمین
  useEffect(() => {
    const unsub = adminChatNotificationService.subscribe((count) => {
      setUnreadCount(count);
    });

    // بررسی وضعیت اولیه دسترسی به نوتیفیکیشن
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermissionGranted(Notification.permission === 'granted');
    }

    const handleNewMessage = (e: any) => {
      const newMsg = e.detail;
      if (newMsg) {
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      }
    };

    window.addEventListener('ashk_new_support_chat_received', handleNewMessage);

    return () => {
      unsub();
      window.removeEventListener('ashk_new_support_chat_received', handleNewMessage);
    };
  }, []);

  // ذخیره پیام‌ها در لوکال‌استوریج
  useEffect(() => {
    try {
      localStorage.setItem(getSupportHistoryKey(), JSON.stringify(messages));
    } catch {}
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
      // وقتی ادمین چت را باز کرد، شمارنده پیام‌های خوانده‌نشده صفر شود
      if (isAdmin) {
        adminChatNotificationService.markAllAsRead();
      }
    }
  }, [messages, isOpen, isMinimized, scrollToBottom, isAdmin]);

  // درخواست مجوز نوتیفیکیشن
  const handleRequestNotification = async () => {
    const granted = await adminChatNotificationService.requestPermission();
    setNotifPermissionGranted(granted);
    if (granted) {
      notificationService.notify('success', '🔔 نوتیفیکیشن‌های زنده پیام پشتیبانی با موفقیت فعال شدند.');
    } else {
      notificationService.notify('warning', 'مجوز ارسال نوتیفیکیشن توسط سیستم صادر نشد.');
    }
  };

  // بررسی وضعیت اتصال به وب‌سرور مادر و دریافت پیام‌های جدید
  const checkServerAndSync = useCallback(async () => {
    if (!navigator.onLine) {
      setServerOnline(false);
      return;
    }
    try {
      setIsCheckingServer(true);
      const secureHeaders = await workspaceService.getSecureHeaders();
      const res = await fetch('/host-backend/api.php?action=support_chat', {
        headers: { 'Accept': 'application/json', ...secureHeaders }
      });
      if (res.ok) {
        const data = await res.json();
        setServerOnline(data.status === 'online');
        if (data.messages && Array.isArray(data.messages)) {
          setMessages(prev => {
            const map = new Map<string, ChatMessage>();
            prev.forEach(m => map.set(m.id, m));
            data.messages.forEach((m: ChatMessage) => map.set(m.id, m));
            return Array.from(map.values());
          });
          if (isMotherPortal) {
            const latestWorkspace = [...data.messages].reverse().find((m: ChatMessage) => m.workspace_id)?.workspace_id;
            if (latestWorkspace) setReplyWorkspaceId(current => current || latestWorkspace);
          }
        }
      } else {
        setServerOnline(false);
      }
    } catch {
      setServerOnline(false);
    } finally {
      setIsCheckingServer(false);
    }
  }, [isMotherPortal]);

  // بررسی دوره‌ای سرور
  useEffect(() => {
    if (isOpen) {
      checkServerAndSync();
      const interval = setInterval(checkServerAndSync, 10000);
      return () => clearInterval(interval);
    }
  }, [isOpen, checkServerAndSync]);

  const sendMessage = async () => {
    if (!newMessage.trim() || isSending) return;

    const textToSend = newMessage.trim();
    const phoneToSave = userPhone.trim();
    if (phoneToSave) {
      localStorage.setItem(getSupportPhoneKey(), phoneToSave);
    }

    const localMsgId = 'msg_' + Date.now();
    const isSendingAsSupport = isAdmin && sendAsAdmin && isMotherPortal;
    if (isSendingAsSupport && !replyWorkspaceId) {
      notificationService.notify('warning', 'برای پاسخ‌گویی، ابتدا فضای کاری مشتری را انتخاب کنید.');
      return;
    }
    const workspaceId = workspaceService.getWorkspaceId();

    const userMsg: ChatMessage = {
      id: localMsgId,
      text: textToSend,
      sender: isSendingAsSupport ? 'support' : 'user',
      senderName: isSendingAsSupport 
        ? `${currentUser?.fullName || 'ادمین پشتیبانی'} (سرور مادر)`
        : (currentUser?.fullName || 'کاربر سیستم'),
      phone: phoneToSave,
      workspace_id: isSendingAsSupport ? replyWorkspaceId : workspaceId,
      timestamp: new Date().toISOString(),
      synced_to_mother: false
    };

    setMessages(prev => [...prev, userMsg]);
    setNewMessage('');
    setIsSending(true);

    // ارسال به وب‌سرور مادر
    try {
      const secureHeaders = await workspaceService.getSecureHeaders();
      const res = await fetch('/host-backend/api.php?action=support_chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...secureHeaders },
        body: JSON.stringify({
          workspace_id: workspaceId,
          target_workspace_id: isSendingAsSupport ? replyWorkspaceId : undefined,
          text: textToSend,
          sender: isSendingAsSupport ? 'support' : 'user',
          senderName: userMsg.senderName,
          phone: phoneToSave
        })
      });
      const result = await res.json().catch(() => null);

      if (res.ok && result?.success === true) {
        setServerOnline(true);
        setMessages(prev => prev.map(m => m.id === localMsgId ? { ...(result.newMessage || m), synced_to_mother: true } : m));
        notificationService.addCenterNotification(
          'info',
          isSendingAsSupport ? 'پاسخ ادمین ارسال شد' : 'پیام پشتیبانی ارسال شد',
          'پیام در پایگاه داده سرور مادر ثبت گردید.'
        );
      } else {
        notificationService.notify('warning', 'پیام در حافظه محلی ذخیره شد (عدم دسترسی موقت به هاست مادر)');
      }
    } catch {
      setServerOnline(false);
    } finally {
      setIsSending(false);
    }

    // پاسخ هوشمند ربات پشتیبان فقط در صورتی که پیام از سوی کاربر عادی باشد
    if (!isSendingAsSupport) {
      setTimeout(() => {
        const replyMsg: ChatMessage = {
          id: 'reply_' + Date.now(),
          text: 'پیام شما دریافت و در پایگاه هاست مرکزی ثبت گردید. کارشناسان فنی در سریع‌ترین زمان از طریق پیامک یا همین پنجره چت پاسخگو خواهند بود.',
          sender: 'support',
          senderName: 'کارشناس پشتیبانی',
          timestamp: new Date().toISOString(),
          synced_to_mother: true
        };
        setMessages(prev => [...prev, replyMsg]);
        notificationService.notify('info', '💬 پاسخ جدید در مرکز پشتیبانی دریافت شد');
      }, 1800);
    }
  };

  const quickReplies = [
    'راهنمایی در مورد صدور فاکتور',
    'وضعیت اتصال و سینک با هاست مادر',
    'ثبت لایسنس و فعال‌سازی قفل سخت‌افزاری',
    'درخواست قابلیت جدید در سیستم'
  ];

  // دکمه بازکردن چت
  if (!isOpen) {
    return (
      <div className="fixed bottom-20 left-20 sm:left-24 md:bottom-8 md:left-28 z-[190] no-print">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="relative group w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-600 hover:from-blue-600 hover:to-indigo-500 text-white shadow-[0_10px_30px_rgba(37,99,235,0.45)] hover:shadow-[0_15px_40px_rgba(37,99,235,0.6)] flex items-center justify-center border-2 border-white/20 active:scale-95 transition-all duration-300 cursor-pointer"
          title="پشتیبانی آنلاین و ارتباط با سرور مادر"
        >
          <MessageCircle size={28} className="transition-transform group-hover:scale-110" />
          
          {/* بج نوتیفیکیشن پیام‌های خوانده‌نشده برای ادمین */}
          {unreadCount > 0 && (
            <span className="absolute -top-2 -left-2 bg-rose-500 text-white font-black text-[11px] min-w-[22px] h-[22px] px-1 rounded-full flex items-center justify-center border-2 border-slate-950 shadow-lg animate-bounce">
              {toPersianDigits(unreadCount)}
            </span>
          )}

          {/* نشانگر آنلاین بودن سرور مادر */}
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              isOnline && serverOnline ? 'bg-emerald-400' : 'bg-amber-400'
            }`}></span>
            <span className={`relative inline-flex rounded-full h-4 w-4 border-2 border-slate-900 ${
              isOnline && serverOnline ? 'bg-emerald-500' : 'bg-amber-500'
            }`}></span>
          </span>

          {/* متن شناور راهنما در هاور دسکتاپ */}
          <span className="hidden md:group-hover:block absolute bottom-full mb-2 right-0 whitespace-nowrap bg-slate-900/95 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl border border-white/10 shadow-2xl backdrop-blur-md">
            {isAdmin ? `پنل پشتیبانی ادمین ${unreadCount > 0 ? `(${unreadCount} جدید)` : ''}` : 'پشتیبانی و سرور مادر'}
          </span>
        </button>
      </div>
    );
  }

  // پنجره چت باز شده
  return (
    <div 
      className={`fixed bottom-20 left-4 sm:left-8 md:bottom-8 md:left-28 w-[calc(100vw-2rem)] sm:w-96 md:w-[440px] bg-slate-950/98 backdrop-blur-2xl border border-blue-500/30 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.8)] z-[250] flex flex-col overflow-hidden animate-slide-up no-print transition-all duration-300 ${
        isMinimized ? 'h-16' : 'h-[540px] max-h-[85vh]'
      }`}
      dir="rtl"
    >
      {/* هدر چت */}
      <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-white/10 bg-gradient-to-r from-blue-900/70 via-indigo-900/60 to-slate-900 text-white shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center shrink-0">
            {isAdmin ? <ShieldCheck size={22} className="text-teal-400" /> : <Bot size={22} className="text-blue-400" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-black text-xs sm:text-sm text-white truncate">
                {isAdmin ? 'کنسول مدیریت پیام‌های کاربران (ادمین)' : 'مرکز پیام و پشتیبانی هاست مادر'}
              </h3>
              {/* تگ وضعیت آنلاین */}
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 ${
                isOnline && serverOnline 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline && serverOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                {isOnline && serverOnline ? 'آنلاین (سرور مادر)' : 'آفلاین / محلی'}
              </span>
            </div>
            <p className="text-[10px] text-slate-300 truncate mt-0.5">
              متصل به سرور مرکزی: <span className="font-mono text-teal-300 font-bold">acc.ashkghalam.ir</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={checkServerAndSync}
            disabled={isCheckingServer}
            title="بررسی مجدد اتصال به سرور"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition"
          >
            <RefreshCw size={14} className={isCheckingServer ? 'animate-spin text-teal-400' : ''} />
          </button>
          <button
            type="button"
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition"
            title={isMinimized ? 'بزرگ‌نمایی' : 'کوچک‌نمایی'}
          >
            {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition"
            title="بستن"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* نوار ویژه ادمین جهت فعال‌سازی نوتیفیکیشن‌ها و تغییر حالت ارسال */}
          {isAdmin && (
            <div className="bg-gradient-to-r from-teal-950/60 to-indigo-950/60 border-b border-white/10 px-3.5 py-2 flex items-center justify-between gap-2 text-[10px] text-slate-300 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRequestNotification}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold border transition ${
                    notifPermissionGranted 
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse'
                  }`}
                  title="فعال‌سازی نوتیفیکیشن نیتیو و اعلان‌های چت"
                >
                  {notifPermissionGranted ? <BellRing size={12} /> : <Bell size={12} />}
                  <span>{notifPermissionGranted ? 'نوتیفیکیشن فعال است' : 'فعال‌سازی نوتیفیکیشن زنده'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {isMotherPortal && (
                  <label className="flex items-center gap-1.5 whitespace-nowrap">
                    <span>مشتری:</span>
                    <select
                      value={replyWorkspaceId}
                      onChange={(e) => setReplyWorkspaceId(e.target.value)}
                      className="max-w-36 bg-slate-900 text-slate-100 border border-white/15 rounded-lg px-2 py-1"
                    >
                      <option value="">انتخاب فضای کاری</option>
                      {Array.from(new Set(messages.map(m => m.workspace_id).filter((id): id is string => Boolean(id) && id !== 'default' && id !== 'main'))).map(id => (
                        <option key={id} value={id}>{id}</option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="flex items-center gap-1.5 cursor-pointer select-none text-[10px]">
                  <input
                    type="checkbox"
                    checked={sendAsAdmin}
                    onChange={(e) => setSendAsAdmin(e.target.checked)}
                    className="accent-teal-500 rounded"
                  />
                  <span className="font-bold text-teal-300">ارسال به عنوان ادمین</span>
                </label>
              </div>
            </div>
          )}

          {/* نوار شماره تماس کاربر عادی */}
          {!isAdmin && (
            <div className="bg-slate-900/90 border-b border-white/5 px-3.5 py-2 flex items-center justify-between gap-2 text-[10px] text-slate-400 shrink-0">
              <div className="flex items-center gap-1 text-slate-300">
                <Smartphone size={13} className="text-teal-400" />
                <span>شماره تماس جهت پیگیری پشتیبان:</span>
              </div>
              <input
                type="tel"
                value={userPhone}
                onChange={(e) => setUserPhone(e.target.value)}
                placeholder="مثلاً ۰۹۱۲۳۴۵۶۷۸۹"
                className="bg-black/30 border border-white/10 text-white rounded-lg px-2 py-0.5 text-[10px] w-32 font-mono text-center focus:outline-none focus:border-teal-400"
              />
            </div>
          )}

          {/* لیست پیام‌ها */}
          <div className="flex-1 p-3.5 sm:p-4 overflow-y-auto space-y-3 custom-scrollbar">
            {messages.map((message) => {
              const isUser = message.sender === 'user';
              return (
                <div
                  key={message.id}
                  className={`flex flex-col ${isUser ? 'items-start' : 'items-end'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <span className="text-[10px] text-slate-400 font-bold">
                      {message.senderName || (isUser ? 'کاربر' : 'پشتیبانی')}
                    </span>
                    {isAdmin && message.workspace_id && (
                      <span className="text-[9px] text-cyan-300 border border-cyan-500/25 rounded px-1 py-0.5">{message.workspace_id}</span>
                    )}
                    
                    {/* نمایش شماره کاربر و دکمه تماس سریع برای ادمین */}
                    {isAdmin && message.phone && (
                      <a
                        href={`tel:${message.phone}`}
                        className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded flex items-center gap-1 hover:bg-emerald-500/30 transition"
                        title="تماس مستقیم با کاربر"
                      >
                        <PhoneCall size={9} />
                        <span className="font-mono">{message.phone}</span>
                      </a>
                    )}

                    {message.synced_to_mother && (
                      <span className="text-[9px] text-teal-400 flex items-center gap-0.5" title="ذخیره شده در سرور مادر">
                        <CheckCircle2 size={10} />
                        هاست مادر
                      </span>
                    )}
                  </div>
                  
                  <div
                    className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed shadow-md ${
                      isUser
                        ? 'bg-blue-600 text-white rounded-br-xs'
                        : 'bg-slate-800 text-slate-100 border border-white/10 rounded-bl-xs'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.text}</p>
                    <div className="flex items-center justify-between gap-3 mt-1.5 pt-1 border-t border-white/10 text-[9px] opacity-75">
                      <span>{new Date(message.timestamp).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span>{message.synced_to_mother ? '✔️ ثبت سرور' : '⏳ در صف'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* پیشنهادات سریع برای کاربران عادی */}
          {!isAdmin && messages.length <= 2 && (
            <div className="px-3 py-1.5 bg-slate-900/60 border-t border-white/5 shrink-0">
              <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-1">
                {quickReplies.map((reply, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setNewMessage(reply)}
                    className="text-[10px] px-2.5 py-1 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl whitespace-nowrap border border-white/5 transition"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* بخش ارسال پیام */}
          <div className="p-3 border-t border-white/10 bg-slate-900/90 shrink-0">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={isAdmin && sendAsAdmin ? 'پاسخ ادمین به کاربر...' : 'پیام یا درخواست پشتیبانی خود را بنویسید...'}
                className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={!newMessage.trim() || isSending}
                className="w-10 h-10 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition shrink-0 active:scale-95 cursor-pointer shadow-md"
                title="ارسال پیام"
              >
                {isSending ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
            
            <div className="flex items-center justify-between mt-2 px-1 text-[9px] text-slate-400 font-mono">
              <span className="flex items-center gap-1">
                <Cloud size={10} className="text-teal-400" />
                ذخیره روی هاست مادر (acc.ashkghalam.ir)
              </span>
              <span>تلفن پشتیبانی: ۰۹۳۵۳۱۰۸۷۶۳</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SupportChat;
