import { useState } from 'react';
import { useFinancialStore } from '../store-financial';
import { BarChart3, TrendingUp, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function AdvancedFinancialReports() {
  const { getFinancialRatios, getBalanceSheet, getIncomeStatement } = useFinancialStore();
  const [reportType, setReportType] = useState<'ratios' | 'balance' | 'income' | 'aging'>('ratios');
  const [period, setPeriod] = useState('1403');

  const ratios = getFinancialRatios(period);
  const balanceSheet = getBalanceSheet(period);
  const incomeStatement = getIncomeStatement('1403/01/01', '1403/12/29');

  const ratioData = [
    { name: 'نسبت جاری', value: ratios.currentRatio },
    { name: 'نسبت سریع', value: ratios.quickRatio },
    { name: 'بدهی به حقوق', value: ratios.debtToEquity },
    { name: 'ROA', value: ratios.returnOnAssets * 100 },
    { name: 'ROE', value: ratios.returnOnEquity * 100 },
    { name: 'حاشیه سود', value: ratios.profitMargin * 100 }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-violet-500" />
          <h1 className="text-2xl font-bold">گزارشات مالی پیشرفته</h1>
        </div>
        <button className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 flex items-center gap-2">
          <Download className="w-4 h-4" />
          صادرات PDF
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        {[
          { key: 'ratios', label: 'نسبتهای مالی' },
          { key: 'balance', label: 'ترازنامه' },
          { key: 'income', label: 'سود و زیان' },
          { key: 'aging', label: 'سنی حسابها' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setReportType(tab.key as any)}
            className={`px-4 py-2 rounded-lg transition-colors font-bold ${
              reportType === tab.key
                ? 'bg-violet-600 text-white'
                : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 hover:text-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {reportType === 'ratios' && (
        <div className="space-y-6">
          <div className="bg-slate-900/40 border border-white/5 rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4 text-slate-100">نسبتهای مالی کلیدی</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ratioData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-slate-900/40 border border-white/5 rounded-lg shadow p-6">
              <h3 className="font-bold mb-2 text-slate-200">نسبتهای نقدینگی</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-300">
                  <span>نسبت جاری:</span>
                  <span className="font-bold">{ratios.currentRatio.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>نسبت سریع:</span>
                  <span className="font-bold">{ratios.quickRatio.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/40 border border-white/5 rounded-lg shadow p-6">
              <h3 className="font-bold mb-2 text-slate-200">نسبتهای سودآوری</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-300">
                  <span>ROA:</span>
                  <span className="font-bold">{(ratios.returnOnAssets * 100).toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>ROE:</span>
                  <span className="font-bold">{(ratios.returnOnEquity * 100).toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>حاشیه سود:</span>
                  <span className="font-bold">{(ratios.profitMargin * 100).toFixed(2)}%</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/40 border border-white/5 rounded-lg shadow p-6">
              <h3 className="font-bold mb-2 text-slate-200">نسبتهای اهرمی</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-300">
                  <span>بدهی به حقوق:</span>
                  <span className="font-bold">{ratios.debtToEquity.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {reportType === 'balance' && (
        <div className="bg-slate-900/40 border border-white/5 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4 text-slate-100">ترازنامه</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-bold mb-3 text-green-700">داراییها</h3>
              <div className="space-y-2">
                <div className="flex justify-between p-2 bg-green-50 rounded">
                  <span>داراییهای جاری</span>
                  <span className="font-bold">{balanceSheet.assets.current.toLocaleString()}</span>
                </div>
                <div className="flex justify-between p-2 bg-green-50 rounded">
                  <span>داراییهای ثابت</span>
                  <span className="font-bold">{balanceSheet.assets.fixed.toLocaleString()}</span>
                </div>
                <div className="flex justify-between p-2 bg-green-100 rounded font-bold">
                  <span>جمع داراییها</span>
                  <span>{balanceSheet.assets.total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-bold mb-3 text-red-700">بدهیها و حقوق صاحبان سهام</h3>
              <div className="space-y-2">
                <div className="flex justify-between p-2 bg-red-50 rounded">
                  <span>بدهیهای جاری</span>
                  <span className="font-bold">{balanceSheet.liabilities.current.toLocaleString()}</span>
                </div>
                <div className="flex justify-between p-2 bg-blue-50 rounded">
                  <span>حقوق صاحبان سهام</span>
                  <span className="font-bold">{balanceSheet.equity.total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between p-2 bg-gray-100 rounded font-bold">
                  <span>جمع</span>
                  <span>{(balanceSheet.liabilities.total + balanceSheet.equity.total).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {reportType === 'income' && (
        <div className="bg-slate-900/40 border border-white/5 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4 text-slate-100">صورت سود و زیان</h2>
          <div className="space-y-3">
            <div className="flex justify-between p-3 bg-green-50 rounded">
              <span className="font-bold">درآمد فروش</span>
              <span className="font-bold text-green-700">{incomeStatement.revenue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between p-3 bg-red-50 rounded">
              <span>بهای تمام شده</span>
              <span className="text-red-700">{incomeStatement.costOfGoodsSold.toLocaleString()}</span>
            </div>
            <div className="flex justify-between p-3 bg-blue-50 rounded">
              <span className="font-bold">سود ناخالص</span>
              <span className="font-bold text-blue-700">{incomeStatement.grossProfit.toLocaleString()}</span>
            </div>
            <div className="flex justify-between p-3 bg-red-50 rounded">
              <span>هزینههای عملیاتی</span>
              <span className="text-red-700">{incomeStatement.operatingExpenses.toLocaleString()}</span>
            </div>
            <div className="flex justify-between p-3 bg-violet-100 rounded">
              <span className="font-bold text-lg">سود خالص</span>
              <span className="font-bold text-lg text-violet-700">{incomeStatement.netIncome.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
