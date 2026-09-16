import React from 'react';
import { Receipt, Package, CreditCard, TrendingUp, TrendingDown } from 'lucide-react';
import { toPersianDigits, formatCurrency } from '../utils';

export const Timeline = ({ transactions, onItemClick }: any) => {
  const getIcon = (type: string) => {
    if (type.includes('INVOICE')) return Receipt;
    if (type.includes('VOUCHER')) return Package;
    if (type.includes('CHECK')) return CreditCard;
    return TrendingUp;
  };

  return (
    <div className="relative">
      <div className="absolute right-4 top-0 bottom-0 w-0.5 bg-white/10"></div>
      {transactions.map((t: any, i: number) => {
        const Icon = getIcon(t.type);
        return (
          <div key={i} className="relative pr-12 pb-8 cursor-pointer hover:bg-white/5 rounded-xl p-2 transition-all" onClick={() => onItemClick(t)}>
            <div className={`absolute right-0 w-8 h-8 rounded-full flex items-center justify-center ${t.isDebit ? 'bg-rose-500' : 'bg-emerald-500'}`}>
              <Icon size={16} className="text-white"/>
            </div>
            <div className="text-xs text-slate-500 mb-1">{toPersianDigits(t.date)}</div>
            <div className="text-white font-bold text-sm">{t.description}</div>
            <div className={`text-xs font-mono ${t.isDebit ? 'text-rose-400' : 'text-emerald-400'}`}>{formatCurrency(t.amount)}</div>
          </div>
        );
      })}
    </div>
  );
};
