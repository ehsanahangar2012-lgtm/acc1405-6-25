import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, resetError }) => {
  const handleRefresh = () => {
    if (resetError) {
      resetError();
    } else {
      window.location.reload();
    }
  };

  const handleGoHome = () => {
    window.location.hash = '#/';
    if (resetError) resetError();
  };

  return (
    <div className="min-h-screen bg-[#111827] flex items-center justify-center p-6 font-sans" dir="rtl">
      <div className="max-w-md w-full bg-slate-900/60 backdrop-blur-md p-8 rounded-[3rem] border border-white/5 shadow-2xl text-center">
        <div className="w-20 h-20 bg-rose-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="text-rose-500 w-10 h-10" />
        </div>
        
        <h1 className="text-2xl font-black text-white mb-4">خطا</h1>
        <p className="text-slate-400 text-sm mb-6">
          {error?.message || 'درخواست یافت نشد'}
        </p>
        
        <div className="space-y-3">
          <button
            onClick={handleRefresh}
            className="w-full bg-teal-600 text-white py-3 px-6 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-teal-700 transition-colors"
          >
            <RefreshCw size={16} />
            تلاش مجدد
          </button>
          
          <button
            onClick={handleGoHome}
            className="w-full bg-slate-700 text-white py-3 px-6 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-600 transition-colors"
          >
            <Home size={16} />
            بازگشت به خانه
          </button>
        </div>
        
        {error && (
          <details className="mt-6 text-left">
            <summary className="text-xs text-slate-500 cursor-pointer">جزئیات فنی</summary>
            <pre className="text-xs text-slate-600 mt-2 p-3 bg-black/20 rounded-xl overflow-auto">
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
};

export default ErrorFallback;