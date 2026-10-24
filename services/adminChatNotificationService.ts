/**
 * سرویس نوتیفیکیشن‌های زنده چت و پیام‌های پشتیبانی برای ادمین
 * اختصاصی هاست مادر acc.ashkghalam.ir و اپلیکیشن اندروید و وب
 * پشتیبانی از @capacitor/local-notifications و Web Notifications و سیستم صوتی
 */

import { LocalNotifications } from '@capacitor/local-notifications';
import { isAndroidApp } from '../utils';
import { notificationService } from './notificationService';
import { useStore } from '../store';

export interface SupportChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'support' | 'system';
  senderName?: string;
  phone?: string;
  timestamp: string;
  synced_to_mother?: boolean;
}

class AdminChatNotificationService {
  private pollingTimer: any = null;
  private isPolling = false;
  private lastProcessedTimestamp: number = 0;
  private unreadCount: number = 0;
  private listeners: Set<(unreadCount: number) => void> = new Set();
  private isPermissionGranted = false;

  constructor() {
    // بازیابی آخرین تایم‌استمپ پردازش‌شده از حافظه
    try {
      const savedTs = localStorage.getItem('ashk_admin_last_chat_ts');
      if (savedTs) {
        this.lastProcessedTimestamp = parseInt(savedTs, 10);
      } else {
        // در شروع اولیه، پیام‌های قبل از الان نوتیفیکیشن ندهند
        this.lastProcessedTimestamp = Date.now();
        localStorage.setItem('ashk_admin_last_chat_ts', this.lastProcessedTimestamp.toString());
      }

      const savedUnread = localStorage.getItem('ashk_admin_unread_chat_count');
      if (savedUnread) {
        this.unreadCount = parseInt(savedUnread, 10) || 0;
      }
    } catch {
      this.lastProcessedTimestamp = Date.now();
    }
  }

  /**
   * درخواست مجوز نوتیفیکیشن سیستم (موبایل و مرورگر)
   */
  async requestPermission(): Promise<boolean> {
    if (this.isPermissionGranted) return true;

    // ۱. در صورت اجرای نیتیو روی اندروید (Capacitor)
    if (isAndroidApp()) {
      try {
        const check = await LocalNotifications.checkPermissions();
        if (check.display === 'granted') {
          this.isPermissionGranted = true;
          return true;
        }
        const req = await LocalNotifications.requestPermissions();
        this.isPermissionGranted = req.display === 'granted';
        return this.isPermissionGranted;
      } catch (err) {
        console.warn('[AdminChat] LocalNotifications permission check failed:', err);
      }
    }

    // ۲. در صورت اجرای وب / دسکتاپ
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        this.isPermissionGranted = true;
        return true;
      }
      if (Notification.permission !== 'denied') {
        try {
          const res = await Notification.requestPermission();
          this.isPermissionGranted = res === 'granted';
          return this.isPermissionGranted;
        } catch (err) {
          console.warn('[AdminChat] Web notification permission failed:', err);
        }
      }
    }

    return false;
  }

  /**
   * پخش ملودی هشدار پیام با استفاده از Web Audio API (بدون نیاز به فایل خارجی)
   */
  private playChime() {
    try {
      if (typeof window === 'undefined') return;
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;

      const ctx = new AudioContext();
      const now = ctx.currentTime;

      // نت اول (فرکانس 587.33 Hz - D5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      // نت دوم خوش‌آهنگ (فرکانس 880 Hz - A5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.12);
      gain2.gain.setValueAtTime(0.2, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.45);
    } catch {
      // نادیده گرفتن در صورت محدودیت صوتی مرورگر
    }
  }

  /**
   * لرزش گوشی روی دستگاه‌های موبایل
   */
  private triggerVibrate() {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([180, 80, 180]);
      }
    } catch {}
  }

  /**
   * ارسال نوتیفیکیشن سیستمی برای پیام جدید
   */
  async notifyNewMessage(msg: SupportChatMessage) {
    const sender = msg.senderName || 'کاربر';
    const phoneInfo = msg.phone ? ` (${msg.phone})` : '';
    const title = `💬 پیام جدید پشتیبانی: ${sender}${phoneInfo}`;
    const body = msg.text.length > 90 ? `${msg.text.substring(0, 90)}...` : msg.text;

    // ۱. پخش صدا و لرزش
    this.playChime();
    this.triggerVibrate();

    // ۲. نوتیفیکیشن نیتیو سیستم‌عامل در اندروید
    if (isAndroidApp()) {
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              title,
              body,
              id: Math.floor(Math.random() * 1000000),
              schedule: { at: new Date(Date.now() + 50) },
              sound: 'beep.wav',
              smallIcon: 'res://drawable/ic_stat_name',
              actionTypeId: 'OPEN_CHAT'
            }
          ]
        });
      } catch (err) {
        console.warn('[AdminChat] Failed to schedule Android local notification:', err);
      }
    }

    // ۳. نوتیفیکیشن وب / دسکتاپ
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: `chat-${msg.id}`
        });
      } catch (err) {
        console.warn('[AdminChat] Web Notification failed:', err);
      }
    }

    // ۴. ثبت در مرکز اعلانات درون‌برنامه‌ای و پیام تست
    notificationService.addCenterNotification(
      'info',
      title,
      `${msg.text}\n⏰ ${msg.timestamp}`
    );
    notificationService.notify('info', `💬 پیام جدید از ${sender}: ${msg.text.slice(0, 40)}...`);

    // ۵. افزایش شمارنده پیام‌های خوانده‌نشده
    this.unreadCount += 1;
    this.saveUnreadState();
    this.notifyListeners();

    // انتشار رویداد عمومی در پنجره برای کامپوننت‌های گوش‌به‌زنگ
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ashk_new_support_chat_received', { detail: msg }));
    }
  }

  /**
   * استعلام پیام‌ها از هاست مادر acc.ashkghalam.ir یا بک‌اند داخلی
   */
  async checkNewMessages(): Promise<SupportChatMessage[]> {
    if (!navigator.onLine) return [];

    // بررسی اینکه آیا کاربر نقش ادمین دارد یا خیر
    const currentUser = useStore.getState().currentUser;
    const isAdmin = currentUser?.roleId === 'admin' || currentUser?.username === 'admin' || currentUser?.roleId === 'MANAGER';
    if (!isAdmin) {
      return [];
    }

    const endpoints = [
      '/host-backend/api.php?action=support_chat',
      'https://acc.ashkghalam.ir/host-backend/api.php?action=support_chat'
    ];

    for (const url of endpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const res = await fetch(url, {
          headers: { 'Accept': 'application/json' },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.messages)) {
            const allMessages: SupportChatMessage[] = data.messages;
            
            // فیلتر کردن پیام‌های جدیدی که از سوی کاربر عادی ارسال شده‌اند و بعد از آخرین تایم‌استمپ هستند
            const newClientMessages = allMessages.filter(m => {
              if (m.sender !== 'user') return false;
              const msgTime = new Date(m.timestamp).getTime();
              return msgTime > this.lastProcessedTimestamp;
            });

            if (newClientMessages.length > 0) {
              // به‌روزرسانی آخرین تایم‌استمپ پردازش‌شده
              const latestTime = Math.max(...newClientMessages.map(m => new Date(m.timestamp).getTime()));
              this.lastProcessedTimestamp = Math.max(this.lastProcessedTimestamp, latestTime);
              localStorage.setItem('ashk_admin_last_chat_ts', this.lastProcessedTimestamp.toString());

              // ارسال نوتیفیکیشن برای هر پیام جدید
              for (const newMsg of newClientMessages) {
                await this.notifyNewMessage(newMsg);
              }
            }

            return allMessages;
          }
        }
      } catch (e) {
        // ادامه به اندپوینت بعدی در صورت وجود خطای شبکه
      }
    }

    return [];
  }

  /**
   * آغاز پایش مداوم (Polling) پس‌زمینه
   */
  startMonitoring(intervalMs = 12000) {
    if (this.isPolling) return;
    this.isPolling = true;

    // بررسی اولیه
    this.checkNewMessages().catch(() => {});

    // زمان‌بندی بررسی دوره‌ای
    this.pollingTimer = setInterval(() => {
      this.checkNewMessages().catch(() => {});
    }, intervalMs);

    // درخواست مجوز نوتیفیکیشن در صورت دسترسی
    this.requestPermission().catch(() => {});
  }

  /**
   * توقف پایش
   */
  stopMonitoring() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    this.isPolling = false;
  }

  /**
   * علامت‌گذاری تمام پیام‌ها به عنوان خوانده‌شده توسط ادمین
   */
  markAllAsRead() {
    this.unreadCount = 0;
    this.saveUnreadState();
    this.lastProcessedTimestamp = Date.now();
    localStorage.setItem('ashk_admin_last_chat_ts', this.lastProcessedTimestamp.toString());
    this.notifyListeners();
  }

  getUnreadCount(): number {
    return this.unreadCount;
  }

  subscribe(listener: (unreadCount: number) => void) {
    this.listeners.add(listener);
    listener(this.unreadCount);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(fn => fn(this.unreadCount));
  }

  private saveUnreadState() {
    try {
      localStorage.setItem('ashk_admin_unread_chat_count', this.unreadCount.toString());
    } catch {}
  }
}

export const adminChatNotificationService = new AdminChatNotificationService();
