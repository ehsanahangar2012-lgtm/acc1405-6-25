// AshkeGhalam Android Hardware Back Button & Gesture Handler (موتور کنترل دکمه بازگشت فیزیکی اندروید)
import { App } from '@capacitor/app';
import { isAndroidApp } from '../utils';

type BackHandler = () => boolean; // return true if handled, false to delegate

class AndroidBackButtonService {
    private handlers: BackHandler[] = [];
    private lastBackPressTime = 0;
    private initialized = false;

    init(showExitToast?: (msg: string) => void) {
        if (typeof window === 'undefined' || this.initialized) return;
        this.initialized = true;

        // Use the official Capacitor App plugin; Capacitor 8 does not guarantee
        // the legacy window.Capacitor.Plugins registry is available.
        if (isAndroidApp()) {
            App.addListener('backButton', ({ canGoBack }) => {
                this.handleBackPress(canGoBack, showExitToast);
            }).catch((error) => {
                console.error('[AndroidBackButton] Native listener could not be registered:', error);
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

        // ۲. روی صفحه داخلی از React Router بخواه تا به عقب برگردد؛
        // این کار حتی وقتی WebView تاریخچه مرورگر ندارد به صفحه سفید ختم نمی‌شود.
        const currentHash = window.location.hash;
        if (currentHash && currentHash !== '#/' && currentHash !== '#') {
            window.dispatchEvent(new CustomEvent('ashk-app-back'));
            return;
        }

        // ۳. اگر در صفحه اصلی است: خروج با ۲ بار فشردن متوالی دکمه
        const now = Date.now();
        if (now - this.lastBackPressTime < 2000) {
            void App.exitApp().catch((error) => {
                console.error('[AndroidBackButton] App exit request failed:', error);
            });
        } else {
            this.lastBackPressTime = now;
            if (showExitToast) {
                showExitToast('برای خروج از برنامه اشک قلم، دوباره دکمه برگشت را لمس کنید');
            }
        }
    }
}

export const androidBackButtonService = new AndroidBackButtonService();
