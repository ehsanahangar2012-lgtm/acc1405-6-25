import { useState } from 'react';
import { useFinancialStore } from '../store-financial';
import { TrendingUp, TrendingDown, DollarSign, AlertCircle } from 'lucide-react';
import { JalaliDatePicker } from '../components/Shared';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function CashFlowManagement() {
  const { cashFlowEntries, addCashFlowEntry, getCashFlowForecast } = useFinancialStore();
  const [showAdd, setShowAdd] = useState(false);
  const [forecastDays, setForecastDays] = useState(30);

  const [newEntry, setNewEntry] = useState({
    date: '',
    category: 'OPERATING' as const,
    type: 'INFLOW' as const,
    amount: 0,
    description: ''
  });

  const handleAdd = () => {
    if (newEntry.amount > 0) {
      addCashFlowEntry(newEntry);
      setNewEntry({ date: '', category: 'OPERATING', type: 'INFLOW', amount: 0, description: '' });
      setShowAdd(false);
    }
  };

  const totalInflow = cashFlowEntries
    .filter(e => e.type === 'INFLOW')
    .reduce((sum, e) => sum + e.amount, 0);

  const totalOutflow = cashFlowEntries
    .filter(e => e.type === 'OUTFLOW')
    .reduce((sum, e) => sum + e.amount, 0);

  const netCashFlow = totalInflow - totalOutflow;

  const chartData = cashFlowEntries
    .slice(-30)
    .map(e => ({
      date: e.date,
      inflow: e.type === 'INFLOW' ? e.amount : 0,
      outflow: e.type === 'OUTFLOW' ? e.amount : 0
    }));

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <DollarSign className="w-8 h-8 text-green-500" />
          <h1 className="text-2xl font-bold">مدیریت جریان نقدینگی</h1>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          ثبت تراکنش
        </button>
      </div>

      {/* کارتهای خلاصه */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm opacity-90">ورودی نقدی</span>
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="text-3xl font-bold">{totalInflow.toLocaleString()}</div>
          <div className="text-xs opacity-75 mt-1">ریال</div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm opacity-90">خروجی نقدی</span>
            <TrendingDown className="w-5 h-5" />
          </div>
          <div className="text-3xl font-bold">{totalOutflow.toLocaleString()}</div>
          <div className="text-xs opacity-75 mt-1">ریال</div>
        </div>

        <div className={`bg-gradient-to-br ${netCashFlow >= 0 ? 'from-blue-500 to-blue-600' : 'from-orange-500 to-orange-600'} text-white rounded-lg p-6`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm opacity-90">خالص جریان نقدی</span>
            <DollarSign className="w-5 h-5" />
          </div>
          <div className="text-3xl font-bold">{netCashFlow.toLocaleString()}</div>
          <div className="text-xs opacity-75 mt-1">ریال</div>
        </div>
      </div>

      {/* نمودار جریان نقدی */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">نمودار جریان نقدی</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="inflow" stroke="#10b981" name="ورودی" />
            <Line type="monotone" dataKey="outflow" stroke="#ef4444" name="خروجی" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* هشدارهای نقدینگی */}
      {netCashFlow < 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
          <div>
            <h3 className="font-bold text-orange-900">هشدار کمبود نقدینگی</h3>
            <p className="text-sm text-orange-700 mt-1">
              جریان نقدی منفی است. توصیه میشود برنامهریزی برای تامین نقدینگی انجام شود.
            </p>
          </div>
        </div>
      )}

      {/* جدول تراکنشها */}
      <div className="bg-slate-900/40 border border-white/5 rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4 text-slate-100">تراکنشهای نقدی</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="px-4 py-2 text-right text-slate-200">تاریخ</th>
                <th className="px-4 py-2 text-right text-slate-200">دسته</th>
                <th className="px-4 py-2 text-right text-slate-200">نوع</th>
                <th className="px-4 py-2 text-right text-slate-200">شرح</th>
                <th className="px-4 py-2 text-right text-slate-200">مبلغ</th>
              </tr>
            </thead>
            <tbody>
              {cashFlowEntries.map(entry => (
                <tr key={entry.id} className="border-b border-white/5 hover:bg-slate-800/30 text-slate-200">
                  <td className="px-4 py-2">{entry.date}</td>
                  <td className="px-4 py-2">
                    {entry.category === 'OPERATING' ? 'عملیاتی' :
                     entry.category === 'INVESTING' ? 'سرمایهگذاری' : 'تامین مالی'}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      entry.type === 'INFLOW' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {entry.type === 'INFLOW' ? 'ورودی' : 'خروجی'}
                    </span>
                  </td>
                  <td className="px-4 py-2">{entry.description}</td>
                  <td className="px-4 py-2 font-bold">{entry.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-white/10 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 text-slate-100">ثبت تراکنش نقدی</h3>
            <div className="space-y-4">
              <JalaliDatePicker
                label="تاریخ تراکنش"
                value={newEntry.date}
                onChange={(v: string) => setNewEntry({ ...newEntry, date: v })}
              />
              <select
                value={newEntry.category}
                onChange={e => setNewEntry({ ...newEntry, category: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded text-slate-200"
              >
                <option value="OPERATING">عملیاتی</option>
                <option value="INVESTING">سرمایهگذاری</option>
                <option value="FINANCING">تامین مالی</option>
              </select>
              <select
                value={newEntry.type}
                onChange={e => setNewEntry({ ...newEntry, type: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded text-slate-200"
              >
                <option value="INFLOW">ورودی نقدی</option>
                <option value="OUTFLOW">خروجی نقدی</option>
              </select>
              <input
                type="text"
                placeholder="شرح"
                value={newEntry.description}
                onChange={e => setNewEntry({ ...newEntry, description: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded text-slate-200"
              />
              <input
                type="number"
                placeholder="مبلغ"
                value={newEntry.amount || ''}
                onChange={e => setNewEntry({ ...newEntry, amount: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded text-slate-200"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  ثبت
                </button>
                <button
                  onClick={() => setShowAdd(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                >
                  انصراف
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
