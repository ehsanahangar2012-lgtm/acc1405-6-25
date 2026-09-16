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
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-6 text-center" dir="rtl">
          <div className="w-24 h-24 bg-rose-500/10 rounded-3xl flex items-center justify-center text-rose-500 mb-6">
            <AlertTriangle size={48} />
          </div>
          <h1 className="text-3xl font-black mb-4">متاسفانه خطایی رخ داده است</h1>
          <p className="text-slate-400 max-w-md mb-8 leading-7">
            سیستم با یک خطای غیرمنتظره مواجه شد. لطفاً صفحه را بازنشانی کنید یا با پشتیبانی تماس بگیرید.
          </p>
          <div className="bg-black/30 p-4 rounded-xl border border-white/5 mb-8 text-left w-full max-w-lg overflow-auto">
             <code className="text-rose-400 text-xs font-mono">{this.state.error?.message}</code>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-2xl font-black shadow-xl flex items-center gap-3 transition-all active:scale-95"
          >
            <RefreshCw size={20} /> بازنشانی برنامه
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;