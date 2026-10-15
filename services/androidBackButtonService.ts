// AshkeGhalam Android Hardware Back Button & Gesture Handler (موتور کنترل دکمه بازگشت فیزیکی اندروید)
import { isAndroidApp } from '../utils';

type BackHandler = () => boolean; // return true if handled, false to delegate

class AndroidBackButtonService {
    private handlers: BackHandler[] = [];
    private lastBackPressTime = 0;
    private initialized = false;

    init(showExitToast?: (msg: string) => void) {
        if (typeof window === 'undefined' || this.initialized) return;
        this.initialized = true;

        // شنود رویداد بازگشت Capacitor در اندروید نیتیو
        const cap = (window as any).Capacitor;
        if (cap && cap.Plugins && cap.Plugins.App) {
            cap.Plugins.App.addListener('backButton', ({ canGoBack }: { canGoBack: boolean }) => {
                this.handleBackPress(canGoBack, showExitToast);
            });
        }

        // شنود رویداد popstate برای PWA و وب‌ویو
        window.addEventListener('popstate', (e) => {
            const handled = this.triggerTopHandler();
            if (handled) {
                // جلوگیری از ناوبری ناخواسته
                history.pushState(null, '', window.location.href);
            }
        });
    }

    registerHandler(handler: BackHandler): () => void {
        this.handlers.unshift(handler);
        return () => {
            this.handlers = this.handlers.filter(h => h !== handler);
        };
    }

    private triggerTopHandler(): boolean {
        for (const handler of this.handlers) {
            try {
                if (handler()) {
                    return true;
                }
            } catch {
                // نادیده گرفتن خطا
            }
        }
        return false;
    }

    private handleBackPress(canGoBack: boolean, showExitToast?: (msg: string) => void) {
        // ۱. بررسی هندلرهای باز (مانند مدال‌ها و دراورها)
        if (this.triggerTopHandler()) {
            return;
        }

        // ۲. اگر داخل تاریخچه ناوبری صفحه داخلی است، یک گام به عقب برود
        const currentHash = window.location.hash;
        if (currentHash && currentHash !== '#/' && currentHash !== '#') {
            window.history.back();
            return;
        }

        // ۳. اگر در صفحه اصلی است: خروج با ۲ بار فشردن متوالی دکمه
        const now = Date.now();
        if (now - this.lastBackPressTime < 2000) {
            const cap = (window as any).Capacitor;
            if (cap && cap.Plugins && cap.Plugins.App) {
                cap.Plugins.App.exitApp();
            }
        } else {
            this.lastBackPressTime = now;
            if (showExitToast) {
                showExitToast('برای خروج از برنامه اشک قلم، دوباره دکمه برگشت را لمس کنید');
            }
        }
    }
}

export const androidBackButtonService = new AndroidBackButtonService();
