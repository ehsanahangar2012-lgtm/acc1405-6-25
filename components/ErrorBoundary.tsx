import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    
    // Check if error is a chunk/module loading error
    const isChunkError = error?.message?.includes('Failed to fetch dynamically imported module') ||
                         error?.message?.includes('Loading chunk') ||
                         error?.message?.includes('Importing a module script failed');
    
    if (isChunkError) {
      const hasReloaded = sessionStorage.getItem('eb_chunk_reload');
      if (!hasReloaded) {
        sessionStorage.setItem('eb_chunk_reload', 'true');
        window.location.reload();
      }
    }
  }

  public render() {
    if (this.state.hasError) {
      const isChunkError = this.state.error?.message?.includes('Failed to fetch dynamically imported module') ||
                           this.state.error?.message?.includes('Loading chunk');

      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-6 text-center" dir="rtl">
          <div className="w-24 h-24 bg-rose-500/10 rounded-3xl flex items-center justify-center text-rose-500 mb-6">
            <AlertTriangle size={48} />
          </div>
          <h1 className="text-3xl font-black mb-4">
            {isChunkError ? 'به‌روزرسانی ماژول‌های سامانه' : 'متاسفانه خطایی رخ داده است'}
          </h1>
          <p className="text-slate-400 max-w-md mb-8 leading-7">
            {isChunkError 
              ? 'نسخه جدیدی از ماژول‌های برنامه بارگذاری شده است. لطفاً برای دریافت آخرین اطلاعات، روی دکمه بازنشانی کلیک نمایید.'
              : 'سیستم با یک خطای غیرمنتظره مواجه شد. لطفاً صفحه را بازنشانی کنید یا با پشتیبانی تماس بگیرید.'}
          </p>
          <div className="bg-black/30 p-4 rounded-xl border border-white/5 mb-8 text-left w-full max-w-lg overflow-auto">
             <code className="text-rose-400 text-xs font-mono">{this.state.error?.message}</code>
          </div>
          <button 
            onClick={() => {
              sessionStorage.clear();
              window.location.reload();
            }} 
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-2xl font-black shadow-xl flex items-center gap-3 transition-all active:scale-95 cursor-pointer"
          >
            <RefreshCw size={20} /> بازنشانی و بارگذاری مجدد
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;