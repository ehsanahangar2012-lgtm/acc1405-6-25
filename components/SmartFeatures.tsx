import React, { useMemo } from 'react';
import { useStore } from '../store';
import { calculateDaysDiff, getPersianDate, toPersianDigits, formatCurrency } from '../utils';
import { Bell, TrendingUp, AlertTriangle, Lightbulb } from 'lucide-react';

export const CheckAlerts = () => {
  const { checks } = useStore();
  
  const upcomingChecks = useMemo(() => checks.filter(c => {
    const days = calculateDaysDiff(getPersianDate(), c.dueDate);
    return c.status === 'PENDING' && days <= 7 && days >= 0;
  }), [checks]);

  if (upcomingChecks.length === 0) return null;

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3 animate-pulse">
      <Bell className="text-amber-400" size={24}/>
      <div>
        <p className="text-amber-400 font-bold text-sm">⚠️ {toPersianDigits(upcomingChecks.length)} چک تا 7 روز آینده سررسید دارد</p>
        <p className="text-amber-300 text-xs">مبلغ کل: {formatCurrency(upcomingChecks.reduce((s,c)=>s+c.amount,0))}</p>
      </div>
    </div>
  );
};

export const AIInsights = () => {
  const { invoices } = useStore();
  
  const insights = useMemo(() => {
    const last30Days = invoices.filter(i => calculateDaysDiff(i.date, getPersianDate()) <= 30);
    const sales = last30Days.filter(i => i.type === 'فروش' || (i.type as string) === 'SALE').reduce((s,i)=>s+i.finalTotal,0);
    const purchases = last30Days.filter(i => i.type === 'خرید' || (i.type as string) === 'PURCHASE').reduce((s,i)=>s+i.finalTotal,0);
    
    let trend: 'positive' | 'negative' = 'positive';
    let message = '';

    if (purchases > 0) {
      const percentage = Math.round(((sales - purchases) / purchases) * 100);
      trend = sales >= purchases ? 'positive' : 'negative';
      message = sales >= purchases 
        ? `💡 فروش شما ${toPersianDigits(percentage)}% بیشتر از خرید است`
        : `⚠️ خریدهای شما ${toPersianDigits(Math.abs(percentage))}% بیشتر از فروش است`;
    } else if (sales > 0) {
      trend = 'positive';
      message = `💡 تمام تراکنش‌های ثبت‌شده ۳۰ روز اخیر مربوط به فروش با موازنه مثبت است`;
    } else {
      trend = 'positive';
      message = `💡 وضعیت مالی و روند تراکنش‌های اخیر آماده ثبت اسناد جدید است`;
    }

    return { trend, message };
  }, [invoices]);

  return (
    <div className={`${insights.trend === 'positive' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'} border rounded-2xl p-4 flex items-center gap-3`}>
      <Lightbulb className={insights.trend === 'positive' ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'} size={24}/>
      <p className={`${insights.trend === 'positive' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'} font-bold text-sm`}>{insights.message}</p>
    </div>
  );
};

export const CashFlowForecast = () => {
  const { checks, transactions } = useStore();
  
  const forecast = useMemo(() => {
    const upcoming = checks.filter(c => c.status === 'PENDING' && calculateDaysDiff(getPersianDate(), c.dueDate) <= 30);
    const total = upcoming.reduce((s,c)=>s+c.amount,0);
    const avgExpense = transactions.filter(t=>t.isDebit).slice(-30).reduce((s,t)=>s+t.amount,0) / 30;
    const projected = total - (avgExpense * 30);
    
    return { total, projected, warning: projected < 0 };
  }, [checks, transactions]);

  if (!forecast.warning) return null;

  return (
    <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-center gap-3">
      <AlertTriangle className="text-rose-400" size={24}/>
      <div>
        <p className="text-rose-400 font-bold text-sm">⚠️ هشدار جریان نقدی</p>
        <p className="text-rose-300 text-xs">در 30 روز آینده کمبود {formatCurrency(Math.abs(forecast.projected))} پیشبینی میشود</p>
      </div>
    </div>
  );
};
