import { useState } from 'react';
import { useFinancialStore } from '../store-financial';
import { Building2, Plus, CheckCircle } from 'lucide-react';

export default function BankReconciliation() {
  const { bankAccounts, bankTransactions, addBankAccount, addBankTransaction, reconcileBankTransaction } = useFinancialStore();
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

  const selectedTransactions = bankTransactions.filter(t => t.bankAccountId === selectedAccount);
  const reconciledCount = selectedTransactions.filter(t => t.isReconciled).length;
  const unreconciledCount = selectedTransactions.length - reconciledCount;

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building2 className="w-8 h-8 text-cyan-500" />
          <h1 className="text-2xl font-bold">تطبیق بانکی</h1>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4 mb-6">
        {bankAccounts.map(account => (
          <div
            key={account.id}
            onClick={() => setSelectedAccount(account.id)}
            className={`bg-white rounded-lg shadow p-4 cursor-pointer transition-all ${
              selectedAccount === account.id ? 'ring-2 ring-cyan-500' : 'hover:shadow-lg'
            }`}
          >
            <h3 className="font-bold mb-1">{account.bankName}</h3>
            <div className="text-xs text-gray-600 mb-3">{account.accountNumber}</div>
            <div className="text-2xl font-bold text-cyan-600">{account.balance.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">{account.currency}</div>
          </div>
        ))}
      </div>

      {selectedAccount && (
        <>
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-sm text-blue-700 mb-1">کل تراکنشها</div>
              <div className="text-2xl font-bold text-blue-900">{selectedTransactions.length}</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-sm text-green-700 mb-1">تطبیق شده</div>
              <div className="text-2xl font-bold text-green-900">{reconciledCount}</div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="text-sm text-orange-700 mb-1">تطبیق نشده</div>
              <div className="text-2xl font-bold text-orange-900">{unreconciledCount}</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">تراکنشهای بانکی</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-right">تاریخ</th>
                    <th className="px-4 py-2 text-right">شرح</th>
                    <th className="px-4 py-2 text-right">نوع</th>
                    <th className="px-4 py-2 text-right">مبلغ</th>
                    <th className="px-4 py-2 text-right">وضعیت</th>
                    <th className="px-4 py-2 text-right">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTransactions.map(trans => (
                    <tr key={trans.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2">{trans.date}</td>
                      <td className="px-4 py-2">{trans.description}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          trans.type === 'CREDIT' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {trans.type === 'CREDIT' ? 'واریز' : 'برداشت'}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-bold">{trans.amount.toLocaleString()}</td>
                      <td className="px-4 py-2">
                        {trans.isReconciled ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <span className="text-orange-600 text-xs">تطبیق نشده</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {!trans.isReconciled && (
                          <button
                            onClick={() => reconcileBankTransaction(trans.id, 'manual')}
                            className="px-3 py-1 bg-cyan-600 text-white rounded text-xs hover:bg-cyan-700"
                          >
                            تطبیق
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
