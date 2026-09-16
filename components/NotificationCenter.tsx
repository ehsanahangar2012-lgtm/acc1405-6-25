import React, { useEffect, useState } from 'react';
import { Bell, CheckCircle2, AlertCircle, Clock, X } from 'lucide-react';
import { notificationService } from '../services/notificationService';

interface Notification {
    id: string;
    type: 'reminder' | 'warning' | 'info';
    title: string;
    message: string;
    timestamp: number;
    read: boolean;
}

export const NotificationCenter = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [show, setShow] = useState(false);
    const unreadCount = notifications.filter(n => !n.read).length;

    useEffect(() => {
        // بررسی سررسید چکها
        const checkReminders = () => {
            const checks = JSON.parse(localStorage.getItem('checks') || '[]');
            const today = new Date().getTime();
            
            checks.forEach((check: any) => {
                if (check.dueDate) {
                    const dueDate = new Date(check.dueDate).getTime();
                    const daysUntil = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));
                    
                    if (daysUntil <= 3 && daysUntil >= 0) {
                        notificationService.addCenterNotification(
                            'reminder',
                            'یادآوری سررسید چک',
                            `چک ${check.number} ${daysUntil} روز دیگر سررسید میشود`
                        );
                    }
                }
            });
        };

        checkReminders();
        const interval = setInterval(checkReminders, 3600000); // هر ساعت
        
        // اشتراک در تغییرات
        const unsubscribe = notificationService.subscribe(setNotifications);
        setNotifications(notificationService.getCenterNotifications());
        
        return () => {
            clearInterval(interval);
            unsubscribe();
        };
    }, []);

    const markAsRead = (id: string) => {
        notificationService.markAsRead(id);
    };

    const deleteNotif = (id: string) => {
        notificationService.deleteCenterNotification(id);
    };

    return (
        <>
            <button 
                onClick={() => setShow(!show)}
                className="relative p-2 hover:bg-white/5 rounded-xl transition-colors"
            >
                <Bell size={20} className="text-slate-400" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                        {unreadCount}
                    </span>
                )}
            </button>

            {show && (
                <div className="absolute top-16 left-4 w-80 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl z-50 max-h-96 overflow-y-auto">
                    <div className="p-4 border-b border-white/10 flex justify-between items-center">
                        <h3 className="text-white font-bold">اعلانها</h3>
                        <button onClick={() => setShow(false)} className="text-slate-400 hover:text-white">
                            <X size={18} />
                        </button>
                    </div>
                    
                    {notifications.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 text-sm">
                            اعلانی وجود ندارد
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {notifications.map(notif => (
                                <div 
                                    key={notif.id}
                                    className={`p-4 hover:bg-white/5 transition-colors ${!notif.read ? 'bg-indigo-500/5' : ''}`}
                                    onClick={() => markAsRead(notif.id)}
                                >
                                    <div className="flex gap-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                            notif.type === 'reminder' ? 'bg-blue-500/20 text-blue-400' :
                                            notif.type === 'warning' ? 'bg-orange-500/20 text-orange-400' :
                                            'bg-slate-500/20 text-slate-400'
                                        }`}>
                                            {notif.type === 'reminder' ? <Clock size={16} /> :
                                             notif.type === 'warning' ? <AlertCircle size={16} /> :
                                             <CheckCircle2 size={16} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-white text-sm font-bold mb-1">{notif.title}</h4>
                                            <p className="text-slate-400 text-xs">{notif.message}</p>
                                            <span className="text-slate-600 text-[10px] mt-1 block">
                                                {new Date(notif.timestamp).toLocaleString('fa-IR')}
                                            </span>
                                        </div>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); deleteNotif(notif.id); }}
                                            className="text-slate-600 hover:text-rose-400"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </>
    );
};
