import { useStore } from '../store';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface CenterNotification {
  id: string;
  type: 'reminder' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

class NotificationService {
  private notificationHistory = new Set<string>();
  private readonly DUPLICATE_WINDOW = 3000; // 3 ثانیه
  private centerNotifications: CenterNotification[] = [];
  private listeners: Set<(notifications: CenterNotification[]) => void> = new Set();

  notify(type: NotificationType, message: string, preventDuplicate = true) {
    if (preventDuplicate) {
      const key = `${type}:${message}`;
      
      if (this.notificationHistory.has(key)) {
        return;
      }
      
      this.notificationHistory.add(key);
      setTimeout(() => this.notificationHistory.delete(key), this.DUPLICATE_WINDOW);
    }

    useStore.getState().addNotification(type, message);
  }

  // نوتیفیکشن مرکز اعلان
  addCenterNotification(type: 'reminder' | 'warning' | 'info', title: string, message: string) {
    const notif: CenterNotification = {
      id: Date.now().toString(),
      type,
      title,
      message,
      timestamp: Date.now(),
      read: false
    };
    this.centerNotifications = [notif, ...this.centerNotifications].slice(0, 50);
    this.notifyListeners();
  }

  getCenterNotifications(): CenterNotification[] {
    return this.centerNotifications;
  }

  markAsRead(id: string) {
    this.centerNotifications = this.centerNotifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    );
    this.notifyListeners();
  }

  deleteCenterNotification(id: string) {
    this.centerNotifications = this.centerNotifications.filter(n => n.id !== id);
    this.notifyListeners();
  }

  subscribe(listener: (notifications: CenterNotification[]) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.centerNotifications));
  }

  // نوتیفیکشنهای سینک
  syncStarted() {
    this.notify('info', '🔄 همگامسازی شروع شد...');
  }

  syncCompleted(itemCount?: number) {
    const msg = itemCount 
      ? `✅ همگامسازی کامل شد (${itemCount} مورد)`
      : '✅ همگامسازی کامل شد';
    this.notify('success', msg);
  }

  syncFailed(error?: string) {
    const msg = error 
      ? `❌ خطا در همگامسازی: ${error}`
      : '❌ خطا در همگامسازی';
    this.notify('error', msg);
  }

  // نوتیفیکشنهای آنلاین/آفلاین
  wentOnline() {
    this.notify('success', '🌐 اتصال برقرار شد');
  }

  wentOffline() {
    this.notify('warning', '📡 اتصال قطع شد - حالت آفلاین');
  }

  // نوتیفیکشنهای بکآپ
  backupStarted() {
    this.notify('info', '💾 پشتیبانگیری شروع شد...');
  }

  backupCompleted() {
    this.notify('success', '✅ پشتیبانگیری کامل شد');
  }

  backupFailed() {
    this.notify('error', '❌ خطا در پشتیبانگیری');
  }

  // نوتیفیکشنهای داده
  dataLoaded(source: string) {
    this.notify('success', `📥 دیتا از ${source} بارگذاری شد`);
  }

  dataSaved(item: string) {
    this.notify('success', `💾 ${item} ذخیره شد`);
  }

  dataDeleted(item: string) {
    this.notify('info', `🗑️ ${item} حذف شد`);
  }

  // نوتیفیکشن عمومی
  success(message: string) {
    this.notify('success', message);
  }

  error(message: string) {
    this.notify('error', message);
  }

  info(message: string) {
    this.notify('info', message);
  }

  warning(message: string) {
    this.notify('warning', message);
  }
}

export const notificationService = new NotificationService();
