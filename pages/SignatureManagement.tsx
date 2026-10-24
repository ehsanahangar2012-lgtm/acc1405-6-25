import React, { useState, useEffect } from 'react';
import { digitalSignatureService } from '../services/digitalSignatureService';
import { DigitalSignature, SignatureStatus } from '../digital-signature-types-complete';
import { JalaliDatePicker } from '../components/Shared';

export const SignatureManagement: React.FC = () => {
  const [signatures, setSignatures] = useState<DigitalSignature[]>([]);
  const [filter, setFilter] = useState({ documentType: '', fromDate: '', toDate: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSignatures();
  }, []);

  const loadSignatures = async () => {
    setLoading(true);
    const data = await digitalSignatureService.getSignedDocuments(filter);
    setSignatures(data);
    setLoading(false);
  };

  const exportCertificate = async (signatureId: string) => {
    const response = await fetch(`/api/signature/certificate/${signatureId}`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `certificate_${signatureId}.pdf`;
    a.click();
  };

  return (
    <div className="p-6" dir="rtl" style={{ fontFamily: 'Vazir, sans-serif' }}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">مدیریت امضاهای دیجیتال</h1>
        
        {/* فیلترها */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">نوع سند</label>
              <select
                value={filter.documentType}
                onChange={(e) => setFilter({ ...filter, documentType: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">همه</option>
                <option value="فاکتور">فاکتور</option>
                <option value="قرارداد">قرارداد</option>
                <option value="اظهارنامه">اظهارنامه</option>
              </select>
            </div>
            <div>
              <JalaliDatePicker
                label="از تاریخ"
                value={filter.fromDate}
                onChange={(v: string) => setFilter({ ...filter, fromDate: v })}
              />
            </div>
            <div>
              <JalaliDatePicker
                label="تا تاریخ"
                value={filter.toDate}
                onChange={(v: string) => setFilter({ ...filter, toDate: v })}
              />
            </div>
          </div>
          <button
            onClick={loadSignatures}
            className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            جستجو
          </button>
        </div>

        {/* لیست امضاها */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">شناسه سند</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">امضاکننده</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">تاریخ امضا</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">وضعیت</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">عملیات</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center">در حال بارگذاری...</td>
                </tr>
              ) : signatures.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">امضایی یافت نشد</td>
                </tr>
              ) : (
                signatures.map((sig) => (
                  <tr key={sig.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sig.documentId}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sig.signerId}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(sig.timestamp).toLocaleDateString('fa-IR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        معتبر
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => exportCertificate(sig.id)}
                        className="text-blue-600 hover:text-blue-900 ml-4"
                      >
                        دانلود گواهی
                      </button>
                      <button className="text-gray-600 hover:text-gray-900">مشاهده جزئیات</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SignatureManagement;
