import React, { useState, useEffect } from 'react';
import { Search, Download, Eye, Calendar, User, FileText, Award } from 'lucide-react';
import { signatureCertificateService, SignatureCertificateData } from '../services/signatureCertificateService';
import SignatureCertificate from './SignatureCertificate';
import { JalaliDatePicker } from './Shared';

const CertificateManager: React.FC = () => {
  const [certificates, setCertificates] = useState<SignatureCertificateData[]>([]);
  const [filteredCertificates, setFilteredCertificates] = useState<SignatureCertificateData[]>([]);
  const [selectedCertificate, setSelectedCertificate] = useState<SignatureCertificateData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    thisMonth: 0,
    thisWeek: 0,
    today: 0
  });

  useEffect(() => {
    loadCertificates();
    loadStats();
  }, []);

  useEffect(() => {
    filterCertificates();
  }, [certificates, searchQuery, dateFilter]);

  const loadCertificates = async () => {
    try {
      setLoading(true);
      const data = await signatureCertificateService.getAllCertificates();
      setCertificates(data);
    } catch (error) {
      console.error('خطا در بارگیری گواهیها:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await signatureCertificateService.getCertificateStats();
      setStats(statsData);
    } catch (error) {
      console.error('خطا در بارگیری آمار:', error);
    }
  };

  const filterCertificates = () => {
    let filtered = certificates;

    if (searchQuery) {
      filtered = filtered.filter(cert =>
        cert.signerName.includes(searchQuery) ||
        cert.signerNationalId.includes(searchQuery) ||
        cert.documentId.includes(searchQuery) ||
        cert.certificateId.includes(searchQuery)
      );
    }

    if (dateFilter) {
      filtered = filtered.filter(cert => cert.signatureDate === dateFilter);
    }

    setFilteredCertificates(filtered);
  };

  const handleViewCertificate = (certificate: SignatureCertificateData) => {
    setSelectedCertificate(certificate);
  };

  if (selectedCertificate) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setSelectedCertificate(null)}
            className="mb-4 text-blue-600 hover:text-blue-800"
          >
            ← بازگشت به لیست گواهیها
          </button>
          <SignatureCertificate signatureData={selectedCertificate} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* هدر */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">مدیریت گواهیهای امضای دیجیتال</h1>
          <p className="text-gray-600">مشاهده و مدیریت گواهیهای صادر شده</p>
        </div>

        {/* آمار */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center">
              <Award className="w-8 h-8 text-blue-600 ml-3" />
              <div>
                <p className="text-sm text-gray-600">کل گواهیها</p>
                <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center">
              <Calendar className="w-8 h-8 text-green-600 ml-3" />
              <div>
                <p className="text-sm text-gray-600">این ماه</p>
                <p className="text-2xl font-bold text-gray-800">{stats.thisMonth}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center">
              <Calendar className="w-8 h-8 text-orange-600 ml-3" />
              <div>
                <p className="text-sm text-gray-600">این هفته</p>
                <p className="text-2xl font-bold text-gray-800">{stats.thisWeek}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center">
              <Calendar className="w-8 h-8 text-red-600 ml-3" />
              <div>
                <p className="text-sm text-gray-600">امروز</p>
                <p className="text-2xl font-bold text-gray-800">{stats.today}</p>
              </div>
            </div>
          </div>
        </div>

        {/* فیلترها */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="جستجو در گواهیها (نام، کد ملی، شناسه سند، شناسه گواهی)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <JalaliDatePicker
                label="فیلتر تاریخ امضا"
                value={dateFilter}
                onChange={(v: string) => setDateFilter(v)}
              />
            </div>
          </div>
        </div>

        {/* لیست گواهیها */}
        <div className="bg-white rounded-lg shadow-sm">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">در حال بارگیری...</p>
            </div>
          ) : filteredCertificates.length === 0 ? (
            <div className="p-8 text-center">
              <Award className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">هیچ گواهی یافت نشد</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      شناسه گواهی
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      امضاکننده
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      نوع سند
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      تاریخ امضا
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      عملیات
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCertificates.map((certificate) => (
                    <tr key={certificate.certificateId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Award className="w-5 h-5 text-blue-600 ml-2" />
                          <span className="text-sm font-medium text-gray-900">
                            {certificate.certificateId}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="flex items-center">
                            <User className="w-4 h-4 text-gray-400 ml-1" />
                            <span className="text-sm font-medium text-gray-900">
                              {certificate.signerName}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500">
                            {certificate.signerNationalId}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <FileText className="w-4 h-4 text-gray-400 ml-1" />
                          <span className="text-sm text-gray-900">
                            {certificate.documentType}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {certificate.signatureDate} - {certificate.signatureTime}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleViewCertificate(certificate)}
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-900"
                        >
                          <Eye className="w-4 h-4" />
                          مشاهده و دانلود
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CertificateManager;