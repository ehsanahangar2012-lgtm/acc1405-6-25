import React, { useState } from 'react';
import { Send, Copy, QrCode, Mail, MessageSquare } from 'lucide-react';
import QRCodeLib from 'qrcode';
import { remoteSignatureService } from '../services/remoteSignatureService';
import type { DocumentType } from '../types-signature';

interface RequestSignatureModalProps {
  documentId: string;
  documentType: DocumentType;
  documentTitle: string;
  documentUrl: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export const RequestSignatureModal: React.FC<RequestSignatureModalProps> = ({
  documentId,
  documentType,
  documentTitle,
  documentUrl,
  onClose,
  onSuccess,
}) => {
  const [signerName, setSignerName] = useState('');
  const [signerNationalId, setSignerNationalId] = useState('');
  const [signerPhone, setSignerPhone] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [authMethod, setAuthMethod] = useState<'otp_sms' | 'otp_email' | 'link'>('otp_sms');
  const [loading, setLoading] = useState(false);
  const [signatureLink, setSignatureLink] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const request = await remoteSignatureService.createSignatureRequest({
        documentId,
        documentType,
        documentTitle,
        documentUrl,
        signerName,
        signerNationalId,
        signerPhone,
        signerEmail,
        authMethod,
      });

      const link = remoteSignatureService.generateSignatureLink(request.signatureToken);
      setSignatureLink(link);

      // تولید QR Code
      const qr = await QRCodeLib.toDataURL(link, {
        width: 300,
        margin: 2,
      });
      setQrCode(qr);

      onSuccess?.();
    } catch (error) {
      alert('خطا در ایجاد درخواست امضا');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (signatureLink) {
      if (navigator.clipboard && window.isSecureContext) {
          try {
              await navigator.clipboard.writeText(signatureLink);
              alert('لینک کپی شد');
          } catch (copyErr) {
              prompt('مرورگر اجازه کپی نداد. لینک را دستی کپی کنید:', signatureLink);
          }
      } else {
          prompt('لینک امضا (دستی کپی کنید):', signatureLink);
      }
    }
  };

  const shareViaSMS = () => {
    if (signatureLink) {
      const message = `لطفاً سند "${documentTitle}" را امضا کنید:\n${signatureLink}`;
      window.open(`sms:${signerPhone}?body=${encodeURIComponent(message)}`);
    }
  };

  const shareViaEmail = () => {
    if (signatureLink) {
      const subject = `درخواست امضای سند: ${documentTitle}`;
      const body = `سلام ${signerName} عزیز،\n\nلطفاً سند "${documentTitle}" را با استفاده از لینک زیر مشاهده و امضا کنید:\n\n${signatureLink}\n\nتوجه: این لینک تا 48 ساعت اعتبار دارد.\n\nبا تشکر`;
      window.open(`mailto:${signerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    }
  };

  if (signatureLink) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
          <h2 className="text-2xl font-bold mb-4">درخواست امضا ایجاد شد</h2>
          
          <div className="mb-6">
            <p className="text-gray-600 mb-4">
              لینک امضا برای <strong>{signerName}</strong> آماده است. این لینک تا 48 ساعت اعتبار دارد.
            </p>

            {/* QR Code */}
            {qrCode && (
              <div className="flex justify-center mb-4">
                <img src={qrCode} alt="QR Code" className="border-2 border-gray-300 rounded-lg" />
              </div>
            )}

            {/* Link */}
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <p className="text-sm text-gray-600 mb-2">لینک امضا:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={signatureLink}
                  readOnly
                  className="flex-1 px-3 py-2 border rounded-lg text-sm"
                />
                <button
                  onClick={copyToClipboard}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  کپی
                </button>
              </div>
            </div>

            {/* Share Options */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={shareViaSMS}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <MessageSquare className="w-5 h-5" />
                ارسال پیامک
              </button>
              <button
                onClick={shareViaEmail}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <Mail className="w-5 h-5" />
                ارسال ایمیل
              </button>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
          >
            بستن
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
        <h2 className="text-2xl font-bold mb-4">درخواست امضای دیجیتال</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>سند:</strong> {documentTitle}
            </p>
            <p className="text-sm text-gray-700">
              <strong>نوع:</strong> {documentType}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">نام امضاکننده *</label>
              <input
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="نام و نام خانوادگی"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">کد ملی *</label>
              <input
                type="text"
                value={signerNationalId}
                onChange={(e) => setSignerNationalId(e.target.value)}
                required
                maxLength={10}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="کد ملی 10 رقمی"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">شماره موبایل *</label>
              <input
                type="tel"
                value={signerPhone}
                onChange={(e) => setSignerPhone(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="09123456789"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">ایمیل (اختیاری)</label>
              <input
                type="email"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="email@example.com"
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">روش احراز هویت</label>
            <div className="grid grid-cols-3 gap-3">
              <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  value="otp_sms"
                  checked={authMethod === 'otp_sms'}
                  onChange={(e) => setAuthMethod(e.target.value as any)}
                />
                <span className="text-sm">کد پیامکی</span>
              </label>
              <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  value="otp_email"
                  checked={authMethod === 'otp_email'}
                  onChange={(e) => setAuthMethod(e.target.value as any)}
                />
                <span className="text-sm">کد ایمیل</span>
              </label>
              <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  value="link"
                  checked={authMethod === 'link'}
                  onChange={(e) => setAuthMethod(e.target.value as any)}
                />
                <span className="text-sm">فقط لینک</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
            >
              <Send className="w-5 h-5" />
              {loading ? 'در حال ایجاد...' : 'ایجاد درخواست'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
            >
              انصراف
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
