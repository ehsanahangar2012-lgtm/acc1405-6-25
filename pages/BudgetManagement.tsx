import { useState } from 'react';
import { useFinancialStore } from '../store-financial';
import { PieChart, Plus, AlertTriangle } from 'lucide-react';

export default function BudgetManagement() {
  const { budgets, budgetLines, addBudget, addBudgetLine } = useFinancialStore();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<string | null>(null);
  const [newBudget, setNewBudget] = useState({ id: '', name: '', year: '', type: 'ANNUAL' as const, status: 'DRAFT' as const });

  const handleAdd = () => {
    if (newBudget.name && newBudget.year) {
      addBudget({ ...newBudget, id: Date.now().toString() });
      setNewBudget({ id: '', name: '', year: '', type: 'ANNUAL', status: 'DRAFT' });
      setShowAdd(false);
    }
  };

  const selectedBudgetLines = budgetLines.filter(l => l.budgetId === selectedBudget);

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <PieChart className="w-8 h-8 text-teal-500" />
          <h1 className="text-2xl font-bold">بودجهبندی</h1>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          بودجه جدید
        </button>
      </div>

      <div className="grid md:grid-cols-4 gap-4 mb-6">
        {budgets.map(budget => (
          <div
            key={budget.id}
            onClick={() => setSelectedBudget(budget.id)}
            className={`bg-white rounded-lg shadow p-4 cursor-pointer transition-all ${
              selectedBudget === budget.id ? 'ring-2 ring-teal-500' : 'hover:shadow-lg'
            }`}
          >
            <h3 className="font-bold mb-2">{budget.name}</h3>
            <div className="text-sm text-gray-600">{budget.year}</div>
            <span className={`inline-block mt-2 px-2 py-1 rounded text-xs ${
              budget.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
              budget.status === 'APPROVED' ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {budget.status === 'ACTIVE' ? 'فعال' : budget.status === 'APPROVED' ? 'تایید شده' : 'پیشنویس'}
            </span>
          </div>
        ))}
      </div>

      {selectedBudget && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">ردیفهای بودجه</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-right">دوره</th>
                  <th className="px-4 py-2 text-right">برنامه</th>
                  <th className="px-4 py-2 text-right">واقعی</th>
                  <th className="px-4 py-2 text-right">انحراف</th>
                  <th className="px-4 py-2 text-right">درصد</th>
                  <th className="px-4 py-2 text-right">وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {selectedBudgetLines.map(line => (
                  <tr key={line.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2">{line.period}</td>
                    <td className="px-4 py-2">{line.plannedAmount.toLocaleString()}</td>
                    <td className="px-4 py-2">{line.actualAmount.toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <span className={line.variance >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {line.variance.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-2">{line.variancePercent.toFixed(1)}%</td>
                    <td className="px-4 py-2">
                      {Math.abs(line.variancePercent) > 10 && (
                        <AlertTriangle className="w-4 h-4 text-orange-500" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-white/10 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 text-slate-100">بودجه جدید</h3>
            <div className="space-y-4">
              <input type="text" placeholder="نام بودجه" value={newBudget.name} onChange={e => setNewBudget({ ...newBudget, name: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded text-slate-200" />
              <input type="text" placeholder="سال (1403)" value={newBudget.year} onChange={e => setNewBudget({ ...newBudget, year: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded text-slate-200" />
              <div className="flex gap-2">
                <button onClick={handleAdd} className="flex-1 px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700">ثبت</button>
                <button onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">انصراف</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
