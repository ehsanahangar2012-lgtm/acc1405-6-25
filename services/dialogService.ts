type DialogType = 'info' | 'success' | 'warning' | 'error' | 'question' | 'session_timeout' | 'app_exit';

export interface DialogOptions {
  title?: string;
  message: string;
  type?: DialogType;
  confirmText?: string;
  cancelText?: string;
  neutralText?: string; // e.g. for exit modal: "خروج بدون پشتیبان"
  showCancel?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  onNeutral?: () => void;
}

type DialogListener = (options: DialogOptions | null) => void;

class DialogService {
  private listener: DialogListener | null = null;

  public register(listener: DialogListener) {
    this.listener = listener;
  }

  public unregister() {
    this.listener = null;
  }

  public alert(message: string, title: string = 'اعلان سیستم', type: DialogType = 'info'): Promise<void> {
    return new Promise((resolve) => {
      if (this.listener) {
        this.listener({
          title,
          message,
          type,
          confirmText: 'متوجه شدم',
          showCancel: false,
          onConfirm: () => {
            this.close();
            resolve();
          }
        });
      } else {
        // Fallback
        window.alert(`${title}\n\n${message}`);
        resolve();
      }
    });
  }

  public confirm(options: {
    title?: string;
    message: string;
    type?: DialogType;
    confirmText?: string;
    cancelText?: string;
  }): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.listener) {
        this.listener({
          title: options.title || 'تایید عملیات',
          message: options.message,
          type: options.type || 'question',
          confirmText: options.confirmText || 'بله، تایید',
          cancelText: options.cancelText || 'انصراف',
          showCancel: true,
          onConfirm: () => {
            this.close();
            resolve(true);
          },
          onCancel: () => {
            this.close();
            resolve(false);
          }
        });
      } else {
        // Fallback
        const res = window.confirm(`${options.title || 'تایید عملیات'}\n\n${options.message}`);
        resolve(res);
      }
    });
  }

  public showSessionTimeout(onRelogin: () => void): void {
    if (this.listener) {
      this.listener({
        title: 'پایان زمان نشست امنیتی',
        message: 'به دلیل عدم فعالیت شما به مدت ۱۵ دقیقه، نشست کاری برای حفظ امنیت اطلاعات مالی مسدود گردید. جهت ادامه کار، لطفاً مجدداً وارد شوید.',
        type: 'session_timeout',
        confirmText: 'ورود مجدد به سیستم',
        showCancel: false,
        onConfirm: () => {
          this.close();
          onRelogin();
        }
      });
    } else {
      window.alert('نشست شما به دلیل عدم فعالیت به مدت ۱۵ دقیقه به پایان رسید.');
      onRelogin();
    }
  }

  public showAppExitPrompt(onExitWithBackup: () => void, onDirectExit: () => void): void {
    if (this.listener) {
      this.listener({
        title: 'خروج از سامانه حسابداری اشک قلم',
        message: 'آیا مایل به خروج از برنامه هستید؟ جهت اطمینان از سلامت و پایداری اسناد، پیشنهاد می‌شود قبل از بستن برنامه، نسخه پشتیبان تهیه گردد.',
        type: 'app_exit',
        confirmText: 'خروج و تهیه پشتیبان امن',
        neutralText: 'خروج مستقیم بدون پشتیبان',
        cancelText: 'انصراف و ادامه کار',
        showCancel: true,
        onConfirm: () => {
          this.close();
          onExitWithBackup();
        },
        onNeutral: () => {
          this.close();
          onDirectExit();
        },
        onCancel: () => {
          this.close();
        }
      });
    }
  }

  public close() {
    if (this.listener) {
      this.listener(null);
    }
  }
}

export const dialogService = new DialogService();
