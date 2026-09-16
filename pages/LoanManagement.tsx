import { useState } from 'react';
import { useFinancialStore } from '../store-financial';
import { CreditCard, Plus, Calendar } from 'lucide-react';

export default function LoanManagement() {
  const { loans, loanInstallments, addLoan, payLoanInstallment } = useFinancialStore();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<string | null>(null);
  const [newLoan, setNewLoan] = useState({ id: '', loanNumber: '', lenderName: '', principalAmount: 0, interestRate: 0, startDate: '', endDate: '', installmentAmount: 0, remainingBalance: 0, status: 'ACTIVE' as const });

  const handleAdd = () => {
    if (newLoan.lenderName && newLoan.principalAmount > 0) {
      addLoan({ ...newLoan, id: Date.now().toString(), remainingBalance: newLoan.principalAmount });
      setNewLoan({ id: '', loanNumber: '', lenderName: '', principalAmount: 0, interestRate: 0, startDate: '', endDate: '', installmentAmount: 0, remainingBalance: 0, status: 'ACTIVE' });
      setShowAdd(false);
    }
  };

  const selectedInstallments = loanInstallments.filter(i => i.loanId === selectedLoan);

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CreditCard className="w-8 h-8 text-rose-500" />
          <h1 className="text-2xl font-bold">مدیریت وامها و اعتبارات</h1>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          وام جدید
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {loans.map(loan => (
          <div
            key={loan.id}
            onClick={() => setSelectedLoan(loan.id)}
            className={`bg-white rounded-lg shadow p-6 cursor-pointer transition-all ${
              selectedLoan === loan.id ? 'ring-2 ring-rose-500' : 'hover:shadow-lg'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold">{loan.lenderName}</h3>
              <span className={`px-2 py-1 rounded text-xs ${
                loan.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                loan.status === 'PAID' ? 'bg-blue-100 text-blue-800' :
                'bg-red-100 text-red-800'
              }`}>
                {loan.status === 'ACTIVE' ? 'فعال' : loan.status === 'PAID' ? 'تسویه شده' : 'معوق'}
              </span>
            </div>
            <div className="text-sm text-gray-600 mb-4">شماره: {loan.loanNumber}</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>اصل وام:</span>
                <span className="font-bold">{loan.principalAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>نرخ بهره:</span>
                <span className="font-bold">{loan.interestRate}%</span>
              </div>
              <div className="flex justify-between">
                <span>مانده:</span>
                <span className="font-bold text-rose-600">{loan.remainingBalance.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>قسط:</span>
                <span>{loan.installmentAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedLoan && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">اقساط وام</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-right">سررسید</th>
                  <th className="px-4 py-2 text-right">اصل</th>
                  <th className="px-4 py-2 text-right">بهره</th>
                  <th className="px-4 py-2 text-right">جمع</th>
                  <th className="px-4 py-2 text-right">تاریخ پرداخت</th>
                  <th className="px-4 py-2 text-right">وضعیت</th>
                  <th className="px-4 py-2 text-right">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {selectedInstallments.map(inst => (
                  <tr key={inst.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2">{inst.dueDate}</td>
                    <td className="px-4 py-2">{inst.principalAmount.toLocaleString()}</td>
                    <td className="px-4 py-2">{inst.interestAmount.toLocaleString()}</td>
                    <td className="px-4 py-2 font-bold">{inst.totalAmount.toLocaleString()}</td>
                    <td className="px-4 py-2">{inst.paidDate || '-'}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        inst.status === 'PAID' ? 'bg-green-100 text-green-800' :
                        inst.status === 'OVERDUE' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {inst.status === 'PAID' ? 'پرداخت شده' :
                         inst.status === 'OVERDUE' ? 'معوق' : 'در انتظار'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {inst.status === 'PENDING' && (
                        <button
                          onClick={() => payLoanInstallment(inst.id)}
                          className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                        >
                          پرداخت
                        </button>
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
            <h3 className="text-xl font-bold mb-4 text-slate-100">وام جدید</h3>
            <div className="space-y-4">
              <input type="text" placeholder="نام وامدهنده" value={newLoan.lenderName} onChange={e => setNewLoan({ ...newLoan, lenderName: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded text-slate-200" />
              <input type="number" placeholder="مبلغ وام" value={newLoan.principalAmount || ''} onChange={e => setNewLoan({ ...newLoan, principalAmount: Number(e.target.value) })} className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded text-slate-200" />
              <input type="number" placeholder="نرخ بهره (%)" value={newLoan.interestRate || ''} onChange={e => setNewLoan({ ...newLoan, interestRate: Number(e.target.value) })} className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded text-slate-200" />
              <div className="flex gap-2">
                <button onClick={handleAdd} className="flex-1 px-4 py-2 bg-rose-600 text-white rounded hover:bg-rose-700">ثبت</button>
                <button onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">انصراف</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
