import React, { useMemo } from 'react';
import { useStore } from '../store';
import { professionalFeatures } from '../services/professionalFeatures';
import { formatCurrency, toPersianDigits } from '../utils';
import { TrendingUp, TrendingDown, AlertTriangle, DollarSign, Users, Package, CreditCard } from 'lucide-react';

export const ExecutiveDashboard = () => {
  const { invoices, transactions, checks, products, people } = useStore();
  
  const kpis = useMemo(() => 
    professionalFeatures.executiveKPIs(invoices, transactions, checks, products),
    [invoices, transactions, checks, products]
  );
  
  const dso = useMemo(() => 
    professionalFeatures.calculateDSO(invoices, transactions),
    [invoices, transactions]
  );
  
  const customerInsights = useMemo(() => 
    professionalFeatures.customerAnalysis(people, invoices),
    [people, invoices]
  );

  return (
    <div className="space-y-6">
      {kpis.alerts.length > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="text-rose-400" size={20}/>
            <span className="text-rose-400 font-bold text-sm">هشدارهای مدیریتی</span>
          </div>
          {kpis.alerts.map((alert: any, i: number) => (
            <p key={i} className="text-rose-300 text-xs">• {alert}</p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard 
          icon={DollarSign} 
          label="موقعیت نقدی" 
          value={formatCurrency(kpis.cashPosition)}
          color={kpis.cashPosition >= 0 ? 'emerald' : 'rose'}
        />
        <KPICard 
          icon={TrendingUp} 
          label="حاشیه سود" 
          value={`${toPersianDigits(kpis.profitMargin)}%`}
          color="blue"
        />
        <KPICard 
          icon={CreditCard} 
          label="چکهای معوق" 
          value={formatCurrency(kpis.pendingChecks)}
          color="amber"
        />
        <KPICard 
          icon={Package} 
          label="کمبود موجودی" 
          value={`${toPersianDigits(kpis.lowStockCount)} کالا`}
          color="indigo"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-md dark:shadow-none">
          <h3 className="text-slate-900 dark:text-white font-bold mb-4 flex items-center gap-2">
            <Users size={18} className="text-teal-600 dark:text-teal-400"/>
            مشتریان برتر
          </h3>
          {customerInsights.topCustomers.slice(0, 5).map((c: any, i: number) => (
            <div key={i} className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-white/5">
              <span className="text-slate-900 dark:text-white text-sm">{c.person.name}</span>
              <span className="text-teal-600 dark:text-teal-400 text-xs font-mono">{formatCurrency(c.totalPurchases)}</span>
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-md dark:shadow-none">
          <h3 className="text-slate-900 dark:text-white font-bold mb-4">شاخصهای کلیدی</h3>
          <div className="space-y-3">
            <Metric label="DSO (روز)" value={toPersianDigits(dso)} />
            <Metric label="فروش" value={formatCurrency(kpis.totalSales)} />
            <Metric label="خرید" value={formatCurrency(kpis.totalPurchases)} />
            <Metric label="سود" value={formatCurrency(kpis.profit)} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-md dark:shadow-none">
          <h3 className="text-slate-900 dark:text-white font-bold mb-4 flex items-center gap-2">
            <AlertTriangle size={18} className="text-rose-500 dark:text-rose-400"/>
            ریسک ترک مشتری
          </h3>
          {customerInsights.churnRisk.slice(0, 5).map((c: any, i: number) => (
            <div key={i} className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-white/5">
              <span className="text-slate-900 dark:text-white text-sm">{c.person.name}</span>
              <span className="text-rose-600 dark:text-rose-400 text-xs">{toPersianDigits(c.daysSinceLastPurchase)} روز</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const KPICard = ({ icon: Icon, label, value, color }: any) => (
  <div className={`bg-${color}-500/10 border border-${color}-500/30 rounded-2xl p-4 shadow-sm`}>
    <Icon className={`text-${color}-600 dark:text-${color}-400 mb-2`} size={24}/>
    <p className="text-slate-600 dark:text-slate-400 text-xs mb-1 font-medium">{label}</p>
    <p className={`text-${color}-600 dark:text-${color}-400 font-black text-lg`}>{value}</p>
  </div>
);

const Metric = ({ label, value }: any) => (
  <div className="flex justify-between items-center">
    <span className="text-slate-600 dark:text-slate-400 text-xs font-medium">{label}</span>
    <span className="text-slate-900 dark:text-white font-bold text-sm">{value}</span>
  </div>
);
