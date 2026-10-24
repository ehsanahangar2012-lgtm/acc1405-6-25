import React, { useState, useEffect } from 'react';
import { 
  DigitalSignatureDocument, 
  DocumentType, 
  DocumentStatus,
  SignatureRequest,
  SignatureWorkflow,
  SignatureReport
} from '../types-signature';
import { digitalSignatureService } from '../services/digitalSignatureService';

interface DigitalSignatureManagerProps {
  onDocumentSelect?: (document: DigitalSignatureDocument) => void;
  className?: string;
}

/**
 * کامپوننت مدیریت کامل امضای دیجیتال
 * شامل ایجاد، مدیریت و نظارت بر فرآیند امضای اسناد
 */
export const DigitalSignatureManager: React.FC<DigitalSignatureManagerProps> = ({
  onDocumentSelect,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'documents' | 'requests' | 'reports' | 'settings'>('documents');
  const [documents, setDocuments] = useState<DigitalSignatureDocument[]>([]);
  const [requests, setRequests] = useState<SignatureRequest[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<DigitalSignatureDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);

  // بارگذاری اولیه داده‌ها
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      // TODO: Implement getDocuments method
      setDocuments([]);
    } catch (err) {
      setError('خطا در بارگذاری اسناد');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDocument = async (formData: FormData) => {
    try {
      setLoading(true);
      // TODO: Implement createDocument method
      setShowCreateModal(false);
      alert('سند با موفقیت ایجاد شد');
    } catch (err) {
      setError('خطا در ایجاد سند');
    } finally {
      setLoading(false);
    }
  };

  const handleSendSignatureRequest = async (documentId: string, signerInfo: any) => {
    try {
      setLoading(true);
      await digitalSignatureService.createSignatureRequest(documentId, signerInfo);
      alert('درخواست امضا با موفقیت ارسال شد');
      setShowSignatureModal(false);
    } catch (err) {
      setError('خطا در ارسال درخواست امضا');
    } finally {
      setLoading(false);
    }
  };

  const getDocumentTypeLabel = (type: DocumentType): string => {
    const labels: Record<DocumentType, string> = {
      [DocumentType.INVOICE]: 'فاکتور فروش',
      [DocumentType.PURCHASE_INVOICE]: 'فاکتور خرید',
      [DocumentType.CONTRACT]: 'قرارداد',
      [DocumentType.FINANCIAL_STATEMENT]: 'صورت مالی',
      [DocumentType.TAX_DECLARATION]: 'اظهارنامه مالیاتی',
      [DocumentType.VAT_DECLARATION]: 'اظهارنامه ارزش افزوده',
      [DocumentType.ACCOUNTING_REPORT]: 'گزارش حسابداری',
      [DocumentType.BALANCE_SHEET]: 'ترازنامه',
      [DocumentType.PROFIT_LOSS]: 'سود و زیان',
      [DocumentType.CASH_FLOW]: 'گزارش جریان نقدینگی',
      [DocumentType.RECEIPT]: 'رسید',
      [DocumentType.VOUCHER]: 'سند حسابداری',
      [DocumentType.BANK_STATEMENT]: 'صورتحساب بانکی',
      [DocumentType.AUDIT_REPORT]: 'گزارش حسابرسی'
    };
    return labels[type] || type;
  };

  const getStatusColor = (status: DocumentStatus): string => {
    const colors: Record<DocumentStatus, string> = {
      [DocumentStatus.PENDING]: 'bg-yellow-100 text-yellow-800',
      [DocumentStatus.SIGNED]: 'bg-green-100 text-green-800',
      [DocumentStatus.REJECTED]: 'bg-red-100 text-red-800',
      [DocumentStatus.EXPIRED]: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: DocumentStatus): string => {
    const labels: Record<DocumentStatus, string> = {
      [DocumentStatus.PENDING]: 'در انتظار امضا',
      [DocumentStatus.SIGNED]: 'امضا شده',
      [DocumentStatus.REJECTED]: 'رد شده',
      [DocumentStatus.EXPIRED]: 'منقضی شده'
    };
    return labels[status] || status;
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg ${className}`}>
      {/* هدر و تب‌ها */}
      <div className="border-b border-gray-200">
        <div className="flex items-center justify-between p-6">
          <h2 className="text-2xl font-bold text-gray-800">مدیریت امضای دیجیتال</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 space-x-reverse"
          >
            <span>+</span>
            <span>سند جدید</span>
          </button>
        </div>

        <div className="flex space-x-8 space-x-reverse px-6">
          {[
            { key: 'documents', label: 'اسناد', icon: '📄' },
            { key: 'requests', label: 'درخواست‌ها', icon: '✉️' },
            { key: 'reports', label: 'گزارش‌ها', icon: '📊' },
            { key: 'settings', label: 'تنظیمات', icon: '⚙️' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`pb-4 px-2 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="ml-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* محتوای تب‌ها */}
      <div className="p-6">
        {error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
            {error}
            <button 
              onClick={() => setError(null)}
              className="float-left text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        )}

        {/* تب اسناد */}
        {activeTab === 'documents' && (
          <div>
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">لیست اسناد</h3>
              
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          عنوان
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          نوع
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          وضعیت
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          تاریخ ایجاد
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          عملیات
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {documents.map((document) => (
                        <tr key={document.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {document.title}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">
                              {getDocumentTypeLabel(document.type)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(document.status)}`}>
                              {getStatusLabel(document.status)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {document.metadata.iranianDate}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2 space-x-reverse">
                              <button
                                onClick={() => {
                                  setSelectedDocument(document);
                                  onDocumentSelect?.(document);
                                }}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                مشاهده
                              </button>
                              {document.status === DocumentStatus.PENDING && (
                                <button
                                  onClick={() => {
                                    setSelectedDocument(document);
                                    setShowSignatureModal(true);
                                  }}
                                  className="text-green-600 hover:text-green-900"
                                >
                                  ارسال برای امضا
                                </button>
                              )}
                              {document.status === DocumentStatus.SIGNED && (
                                <button
                                  onClick={() => alert('دانلود سند')}
                                  className="text-purple-600 hover:text-purple-900"
                                >
                                  دانلود
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* تب درخواست‌ها */}
        {activeTab === 'requests' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">درخواست‌های امضا</h3>
            <div className="text-gray-500 text-center py-8">
              این بخش در حال توسعه است...
            </div>
          </div>
        )}

        {/* تب گزارش‌ها */}
        {activeTab === 'reports' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">گزارش‌های امضای دیجیتال</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-blue-50 p-6 rounded-lg">
                <h4 className="text-lg font-semibold text-blue-800 mb-2">کل اسناد</h4>
                <p className="text-3xl font-bold text-blue-600">{documents.length}</p>
              </div>
              <div className="bg-green-50 p-6 rounded-lg">
                <h4 className="text-lg font-semibold text-green-800 mb-2">امضا شده</h4>
                <p className="text-3xl font-bold text-green-600">
                  {documents.filter(d => d.status === DocumentStatus.SIGNED).length}
                </p>
              </div>
              <div className="bg-yellow-50 p-6 rounded-lg">
                <h4 className="text-lg font-semibold text-yellow-800 mb-2">در انتظار</h4>
                <p className="text-3xl font-bold text-yellow-600">
                  {documents.filter(d => d.status === DocumentStatus.PENDING).length}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* تب تنظیمات */}
        {activeTab === 'settings' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">تنظیمات امضای دیجیتال</h3>
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-800 mb-2">تنظیمات امنیتی</h4>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input type="checkbox" className="ml-2" defaultChecked />
                    <span>الزام احراز هویت دو مرحله‌ای</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="ml-2" defaultChecked />
                    <span>رمزنگاری پیشرفته AES-256</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="ml-2" defaultChecked />
                    <span>ثبت کامل لاگ‌های حسابرسی</span>
                  </label>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-800 mb-2">انطباق با قوانین ایران</h4>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input type="checkbox" className="ml-2" defaultChecked />
                    <span>الزام کد ملی برای امضاکنندگان</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="ml-2" defaultChecked />
                    <span>استفاده از تاریخ شمسی</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="ml-2" defaultChecked />
                    <span>انطباق با قوانین امضای الکترونیکی</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* مودال ایجاد سند */}
      {showCreateModal && (
        <CreateDocumentModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateDocument}
        />
      )}

      {/* مودال ارسال درخواست امضا */}
      {showSignatureModal && selectedDocument && (
        <SignatureRequestModal
          document={selectedDocument}
          onClose={() => setShowSignatureModal(false)}
          onSubmit={(signerInfo) => handleSendSignatureRequest(selectedDocument.id, signerInfo)}
        />
      )}
    </div>
  );
};

// کامپوننت مودال ایجاد سند
const CreateDocumentModal: React.FC<{
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}> = ({ onClose, onSubmit }) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">ایجاد سند جدید</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              عنوان سند
            </label>
            <input
              type="text"
              name="title"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              نوع سند
            </label>
            <select
              name="type"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">انتخاب کنید</option>
              <option value="invoice">فاکتور فروش</option>
              <option value="purchase_invoice">فاکتور خرید</option>
              <option value="contract">قرارداد</option>
              <option value="financial_statement">صورت مالی</option>
              <option value="tax_declaration">اظهارنامه مالیاتی</option>
              <option value="accounting_report">گزارش حسابداری</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              فایل PDF
            </label>
            <input
              type="file"
              name="file"
              accept=".pdf"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex space-x-3 space-x-reverse pt-4">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              ایجاد سند
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
            >
              انصراف
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// کامپوننت مودال درخواست امضا
const SignatureRequestModal: React.FC<{
  document: DigitalSignatureDocument;
  onClose: () => void;
  onSubmit: (signerInfo: any) => void;
}> = ({ document, onClose, onSubmit }) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const signerInfo = {
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      nationalId: formData.get('nationalId')
    };
    onSubmit(signerInfo);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">ارسال درخواست امضا</h3>
        <p className="text-gray-600 mb-4">سند: {document.title}</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              نام امضاکننده
            </label>
            <input
              type="text"
              name="name"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ایمیل
            </label>
            <input
              type="email"
              name="email"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              شماره موبایل
            </label>
            <input
              type="tel"
              name="phone"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              کد ملی
            </label>
            <input
              type="text"
              name="nationalId"
              required
              maxLength={10}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex space-x-3 space-x-reverse pt-4">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              ارسال درخواست
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
            >
              انصراف
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};