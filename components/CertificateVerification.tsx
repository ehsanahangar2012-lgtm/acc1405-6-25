import React, { useState } from 'react';
import { Shield, CheckCircle, XCircle, Search } from 'lucide-react';
import { signatureCertificateService } from '../services/signatureCertificateService';

const CertificateVerification: React.FC = () => {
  const [certificateId, setCertificateId] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationResult, setVerificationResult] = useState<{
    isValid: boolean;
    certificate?: any;
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleVerification = async () => {
    if (!certificateId.trim() || !verificationCode.trim()) {
      setVerificationResult({
        isValid: false,
        message: 'لطفاً شناسه گواهی و کد تأیید را وارد کنید'
      });
      return;
    }

    try {
      setLoading(true);
      const isValid = await signatureCertificateService.verifyCertificate(
        certificateId.trim(),
        verificationCode.trim()
      );

      if (isValid) {
        const certificate = await signatureCertificateService.getCertificate(certificateId.trim());
        setVerificationResult({
          isValid: true,
          certificate,
          message: 'گواهی معتبر است'
        });
      } else {
        setVerificationResult({
          isValid: false,
          message: 'گواهی نامعتبر است یا کد تأیید اشتباه است'
        });
      }
    } catch (error) {
      setVerificationResult({
        isValid: false,
        message: 'خطا در تأیید گواهی'
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCertificateId('');
    setVerificationCode('');
    setVerificationResult(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* هدر */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center mb-4">
            <Shield className="w-8 h-8 text-blue-600 ml-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">تأیید گواهی امضای دیجیتال</h1>
              <p className="text-gray-600">اعتبار گواهی امضای دیجیتال را بررسی کنید</p>
            </div>
          </div>
        </div>

        {/* فرم تأیید */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                شناسه گواهی
              </label>
              <input
                type="text"
                value={certificateId}
                onChange={(e) => setCertificateId(e.target.value)}
                placeholder="مثال: CERT-20241211-ABC12345"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                کد تأیید
              </label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="کد تأیید 16 رقمی"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleVerification}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <Search className="w-5 h-5" />
                )}
                {loading ? 'در حال بررسی...' : 'تأیید گواهی'}
              </button>

              <button
                onClick={resetForm}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                پاک کردن
              </button>
            </div>
          </div>
        </div>

        {/* نتیجه تأیید */}
        {verificationResult && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className={`flex items-center mb-4 ${
              verificationResult.isValid ? 'text-green-600' : 'text-red-600'
            }`}>
              {verificationResult.isValid ? (
                <CheckCircle className="w-8 h-8 ml-3" />
              ) : (
                <XCircle className="w-8 h-8 ml-3" />
              )}
              <div>
                <h3 className="text-lg font-semibold">
                  {verificationResult.isValid ? 'گواهی معتبر' : 'گواهی نامعتبر'}
                </h3>
                <p className="text-sm">{verificationResult.message}</p>
              </div>
            </div>

            {verificationResult.isValid && verificationResult.certificate && (
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">جزئیات گواهی:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded">
                    <span className="text-sm text-gray-600">امضاکننده:</span>
                    <p className="font-semibold">{verificationResult.certificate.signerName}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <span className="text-sm text-gray-600">کد ملی:</span>
                    <p className="font-semibold">{verificationResult.certificate.signerNationalId}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <span className="text-sm text-gray-600">نوع سند:</span>
                    <p className="font-semibold">{verificationResult.certificate.documentType}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <span className="text-sm text-gray-600">تاریخ امضا:</span>
                    <p className="font-semibold">{verificationResult.certificate.signatureDate}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* راهنما */}
        <div className="bg-blue-50 rounded-lg p-4 mt-6">
          <h4 className="font-semibold text-blue-800 mb-2">راهنما:</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• شناسه گواهی را از روی گواهی امضای دیجیتال کپی کنید</li>
            <li>• کد تأیید 16 رقمی را وارد کنید</li>
            <li>• در صورت معتبر بودن گواهی، جزئیات کامل نمایش داده میشود</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CertificateVerification;