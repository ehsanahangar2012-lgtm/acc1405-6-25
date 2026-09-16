import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};

const ToastItem: React.FC<{ toast: Toast; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
  const [isExiting, setIsExiting] = useState(false);

  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertCircle,
    info: Info,
  };

  const colors = {
    success: 'bg-emerald-950/95 border-emerald-500/40 text-emerald-100 shadow-emerald-950/50',
    error: 'bg-rose-950/95 border-rose-500/40 text-rose-100 shadow-rose-950/50',
    warning: 'bg-amber-950/95 border-amber-500/40 text-amber-100 shadow-amber-950/50',
    info: 'bg-indigo-950/95 border-indigo-500/40 text-indigo-100 shadow-indigo-950/50',
  };

  const Icon = icons[toast.type];
  const displayDuration = toast.duration || 1000; // Exact 1-second display duration

  React.useEffect(() => {
    // Start fade out after exact 1 second (1000ms)
    const fadeTimer = setTimeout(() => {
      setIsExiting(true);
    }, displayDuration);

    // Completely unmount after fade-out transition completes (220ms)
    const removeTimer = setTimeout(() => {
      onRemove(toast.id);
    }, displayDuration + 220);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [toast.id, displayDuration, onRemove]);

  const handleManualClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onRemove(toast.id);
    }, 200);
  };

  return (
    <div
      dir="rtl"
      className={`flex items-start gap-3 p-3.5 rounded-2xl border backdrop-blur-xl shadow-2xl transition-all ${
        colors[toast.type]
      } ${isExiting ? 'animate-notif-out' : 'animate-notif-in'}`}
    >
      <Icon className="w-5 h-5 mt-0.5 shrink-0 opacity-90" />
      <div className="flex-1 min-w-0">
        <h4 className="font-black text-xs tracking-tight">{toast.title}</h4>
        {toast.message && <p className="text-[11px] mt-0.5 opacity-80 leading-relaxed font-medium">{toast.message}</p>}
      </div>
      <button
        onClick={handleManualClose}
        className="text-current opacity-60 hover:opacity-100 p-1 rounded-lg hover:bg-white/10 transition-colors"
        title="بستن"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { ...toast, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <div className="fixed top-10 right-4 z-[9999] space-y-2 max-w-sm pointer-events-auto" dir="rtl">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};