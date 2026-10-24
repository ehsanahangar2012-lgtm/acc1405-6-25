import { useState } from 'react';
import { useFinancialStore } from '../store-financial';
import { FileText, Calculator, Download } from 'lucide-react';
import { JalaliDatePicker } from '../components/Shared';

export default function TaxManagement() {
  const { taxConfigs, taxReports, addTaxReport } = useFinancialStore();
  const [showAddReport, setShowAddReport] = useState(false);

  const [newReport, setNewReport] = useState({
    id: '',
    period: '',
    startDate: '',
    endDate: '',
    totalSales: 0,
    totalPurchases: 0,
    taxableAmount: 0,
    taxAmount: 0,
    status: 'DRAFT' as const
  });

  const calculateTax = () => {
    const vat = taxConfigs.find(t => t.type === 'VAT');
    if (vat) {
      const taxable = newReport.totalSales - newReport.totalPurchases;
      const tax = taxable * (vat.rate / 100);
      setNewReport({
        ...newReport,
        taxableAmount: taxable,
        taxAmount: tax
      });
    }
  };

  const handleAddReport = () => {
    if (newReport.period && newReport.startDate && newReport.endDate) {
      addTaxReport({ ...newReport, id: Date.now().toString() });
      setNewReport({
        id: '',
        period: '',
        startDate: '',
        endDate: '',
        totalSales: 0,
        totalPurchases: 0,
        taxableAmount: 0,
        taxAmount: 0,
        status: 'DRAFT'
      });
      setShowAddReport(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calculator className="w-8 h-8 text-purple-500" />
          <h1 className="text-2xl font-bold">مدیریت مالیاتی</h1>
        </div>
        <button
          onClick={() => setShowAddReport(true)}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          گزارش جدید
        </button>
      </div>

      {/* تنظیمات مالیاتی */}
      <div className="bg-slate-900/40 border border-white/5 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 text-slate-100">تنظیمات مالیاتی</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {taxConfigs.map(config => (
            <div key={config.id} className="border border-white/10 rounded-lg p-4 bg-slate-800/30">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-slate-200">{config.name}</h3>
                <span className={`px-2 py-1 rounded text-xs ${
                  config.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {config.isActive ? 'فعال' : 'غیرفعال'}
                </span>
              </div>
              <div className="text-2xl font-bold text-purple-600">{config.rate}%</div>
              <div className="text-sm text-slate-400 mt-1">
                {config.type === 'VAT' ? 'مالیات بر ارزش افزوده' :
                 config.type === 'INCOME' ? 'مالیات بر درآمد' : 'مالیات تکلیفی'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* گزارشات مالیاتی */}
      <div className="bg-slate-900/40 border border-white/5 rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4 text-slate-100">گزارشات مالیاتی</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="px-4 py-2 text-right text-slate-200">دوره</th>
                <th className="px-4 py-2 text-right text-slate-200">از تاریخ</th>
                <th className="px-4 py-2 text-right text-slate-200">تا تاریخ</th>
                <th className="px-4 py-2 text-right text-slate-200">فروش</th>
                <th className="px-4 py-2 text-right text-slate-200">خرید</th>
                <th className="px-4 py-2 text-right text-slate-200">مبلغ مشمول</th>
                <th className="px-4 py-2 text-right text-slate-200">مالیات</th>
                <th className="px-4 py-2 text-right text-slate-200">وضعیت</th>
                <th className="px-4 py-2 text-right text-slate-200">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {taxReports.map(report => (
                <tr key={report.id} className="border-b border-white/5 hover:bg-slate-800/30 text-slate-200">
                  <td className="px-4 py-2 font-bold">{report.period}</td>
                  <td className="px-4 py-2">{report.startDate}</td>
                  <td className="px-4 py-2">{report.endDate}</td>
                  <td className="px-4 py-2">{report.totalSales.toLocaleString()}</td>
                  <td className="px-4 py-2">{report.totalPurchases.toLocaleString()}</td>
                  <td className="px-4 py-2">{report.taxableAmount.toLocaleString()}</td>
                  <td className="px-4 py-2 font-bold text-purple-600">
                    {report.taxAmount.toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      report.status === 'PAID' ? 'bg-green-100 text-green-800' :
                      report.status === 'SUBMITTED' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {report.status === 'PAID' ? 'پرداخت شده' :
                       report.status === 'SUBMITTED' ? 'ارسال شده' : 'پیشنویس'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <button className="text-blue-600 hover:text-blue-800">
                      <Download className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showAddReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-white/10 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 text-slate-100">گزارش مالیاتی جدید</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="دوره (مثال: فصل اول 1403)"
                value={newReport.period}
                onChange={e => setNewReport({ ...newReport, period: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded text-slate-200"
              />
              <div className="grid grid-cols-2 gap-2 text-slate-900">
                <JalaliDatePicker
                  label="از تاریخ"
                  value={newReport.startDate}
                  onChange={(v: string) => setNewReport({ ...newReport, startDate: v })}
                />
                <JalaliDatePicker
                  label="تا تاریخ"
                  value={newReport.endDate}
                  onChange={(v: string) => setNewReport({ ...newReport, endDate: v })}
                />
              </div>
              <input
                type="number"
                placeholder="مجموع فروش"
                value={newReport.totalSales || ''}
                onChange={e => setNewReport({ ...newReport, totalSales: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded text-slate-200"
              />
              <input
                type="number"
                placeholder="مجموع خرید"
                value={newReport.totalPurchases || ''}
                onChange={e => setNewReport({ ...newReport, totalPurchases: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded text-slate-200"
              />
              <button
                onClick={calculateTax}
                className="w-full px-4 py-2 bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
              >
                محاسبه مالیات
              </button>
              {newReport.taxAmount > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded p-3">
                  <div className="flex justify-between mb-1">
                    <span>مبلغ مشمول:</span>
                    <span className="font-bold">{newReport.taxableAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>مالیات:</span>
                    <span className="font-bold text-purple-600">{newReport.taxAmount.toLocaleString()}</span>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleAddReport}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  ثبت
                </button>
                <button
                  onClick={() => setShowAddReport(false)}
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
