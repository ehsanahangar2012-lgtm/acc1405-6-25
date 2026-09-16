import React, { useState, useEffect } from 'react';
import { remoteSignatureService } from '../services/remoteSignatureService';
import type { SignatureRequest, SignatureReport } from '../types-signature';
import { FileText, CheckCircle, XCircle, Clock, AlertCircle, Eye, Copy, BarChart3 } from 'lucide-react';

const SignatureManagementPage: React.FC = () => {
  const [requests, setRequests] = useState<SignatureRequest[]>([]);
  const [report, setReport] = useState<SignatureReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'signed' | 'rejected' | 'expired'>('all');

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [requestsData, reportData] = await Promise.all([
        remoteSignatureService.listRequests(filter === 'all' ? {} : { status: filter }),
        remoteSignatureService.getReport(),
      ]);
      setRequests(requestsData);
      setReport(reportData);
    } catch (error) {
      console.error('خطا در بارگذاری داده', error);
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async (token: string) => {
    const link = remoteSignatureService.generateSignatureLink(token);
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(link);
            alert('لینک کپی شد');
        } catch (copyErr) {
            prompt('مرورگر اجازه کپی نداد. لینک را دستی کپی کنید:', link);
        }
    } else {
        prompt('لینک امضا (دستی کپی کنید):', link);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'signed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'expired':
        return <AlertCircle className="w-5 h-5 text-orange-600" />;
      default:
        return <Clock className="w-5 h-5 text-blue-600" />;
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: 'در انتظار',
      signed: 'امضا شده',
      rejected: 'رد شده',
      expired: 'منقضی شده',
      cancelled: 'لغو شده',
    };
    return statusMap[status] || status;
  };

  const getDocumentTypeText = (type: string) => {
    const typeMap: Record<string, string> = {
      invoice: 'فاکتور',
      contract: 'قرارداد',
      financial_report: 'گزارش مالی',
      tax_declaration: 'اظهارنامه مالیاتی',
      voucher: 'سند حسابداری',
      other: 'سایر',
    };
    return typeMap[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto text-slate-100">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 text-white">مدیریت امضاهای دیجیتال</h1>
        <p className="text-slate-400">مشاهده و مدیریت درخواستهای امضای دیجیتال</p>
      </div>

      {/* Statistics */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">کل درخواستها</p>
                <p className="text-2xl font-bold text-white mt-1">{report.totalRequests}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-slate-500" />
            </div>
          </div>

          <div className="bg-slate-800/90 border border-blue-500/30 rounded-2xl p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-400 font-medium">در انتظار</p>
                <p className="text-2xl font-bold text-blue-400 mt-1">{report.pendingRequests}</p>
              </div>
              <Clock className="w-8 h-8 text-blue-500/60" />
            </div>
          </div>

          <div className="bg-slate-800/90 border border-green-500/30 rounded-2xl p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-400 font-medium">امضا شده</p>
                <p className="text-2xl font-bold text-green-400 mt-1">{report.signedRequests}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500/60" />
            </div>
          </div>

          <div className="bg-slate-800/90 border border-red-500/30 rounded-2xl p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-red-400 font-medium">رد شده</p>
                <p className="text-2xl font-bold text-red-400 mt-1">{report.rejectedRequests}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500/60" />
            </div>
          </div>

          <div className="bg-slate-800/90 border border-orange-500/30 rounded-2xl p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-orange-400 font-medium">منقضی شده</p>
                <p className="text-2xl font-bold text-orange-400 mt-1">{report.expiredRequests}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-orange-500/60" />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 mb-6 shadow-lg">
        <div className="flex gap-2 flex-wrap">
          {['all', 'pending', 'signed', 'rejected', 'expired'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === f
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {f === 'all' ? 'همه' : getStatusText(f)}
            </button>
          ))}
        </div>
      </div>

      {/* Requests List */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-slate-900/60 border-b border-slate-700 text-slate-400 text-xs font-semibold uppercase">
              <tr>
                <th className="px-6 py-4">سند</th>
                <th className="px-6 py-4">نوع</th>
                <th className="px-6 py-4">امضاکننده</th>
                <th className="px-6 py-4">تاریخ ایجاد</th>
                <th className="px-6 py-4">وضعیت</th>
                <th className="px-6 py-4">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 text-slate-200">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    درخواستی یافت نشد
                  </td>
                </tr>
              ) : (
                requests.map((request) => (
                  <tr key={request.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-slate-400" />
                        <span className="font-medium text-white">{request.documentTitle}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">
                      {getDocumentTypeText(request.documentType)}
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-white">{request.signerName}</p>
                        <p className="text-xs text-slate-400">{request.signerPhone}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">
                      {new Date(request.createdAt).toLocaleDateString('fa-IR')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(request.status)}
                        <span className="text-sm">{getStatusText(request.status)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => copyLink(request.signatureToken)}
                          className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                          title="کپی لینک"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => window.open(request.documentUrl, '_blank')}
                          className="p-2 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
                          title="مشاهده سند"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
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

export default SignatureManagementPage;
