import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DocumentViewer } from '../components/DocumentViewer';
import { SignatureInterface } from '../components/RemoteSignatureInterface';
import { remoteSignatureService } from '../services/remoteSignatureService';
import type { SignatureRequest } from '../types-signature';
import { CheckCircle, XCircle, Clock, Shield } from 'lucide-react';

export const RemoteSignaturePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [request, setRequest] = useState<SignatureRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'otp' | 'view' | 'sign' | 'success' | 'rejected'>('otp');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadRequest();
    } else {
      setError('لینک نامعتبر است');
      setLoading(false);
    }
  }, [token]);

  const loadRequest = async () => {
    try {
      const data = await remoteSignatureService.getRequestByToken(token!);
      if (!data) {
        setError('درخواست یافت نشد یا منقضی شده است');
      } else if (data.status === 'signed') {
        setError('این سند قبلاً امضا شده است');
      } else if (data.status === 'expired') {
        setError('مهلت امضای این سند به پایان رسیده است');
      } else if (new Date(data.expiresAt) < new Date()) {
        setError('مهلت امضای این سند به پایان رسیده است');
      } else {
        setRequest(data);
        setStep(data.authMethod === 'link' ? 'view' : 'otp');
      }
    } catch (err) {
      setError('خطا در بارگذاری اطلاعات');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async () => {
    if (!request) return;
    
    try {
      setOtpError(null);
      const otpMethod = request.authMethod === 'otp_email' ? 'email' : 'sms';
      await remoteSignatureService.sendOTP(request.id, otpMethod, request.signatureToken);
      setOtpSent(true);
    } catch (err) {
      setOtpError('خطا در ارسال کد تأیید');
    }
  };

  const handleVerifyOTP = async () => {
    if (!request || !otpCode) return;

    try {
      setOtpError(null);
      const result = await remoteSignatureService.verifyOTP(request.id, otpCode, request.signatureToken);
      if (result.success && result.sessionToken) {
        setSessionToken(result.sessionToken);
        setStep('view');
      } else {
        setOtpError('کد تأیید نادرست است');
      }
    } catch (err) {
      setOtpError('خطا در تأیید کد');
    }
  };

  const handleProceedToSign = () => {
    setStep('sign');
  };

  const handleSign = async (signatureData: string, signatureImage: string) => {
    if (!request) return;

    try {
      await remoteSignatureService.signDocument({
        requestId: request.id,
        signatureToken: request.signatureToken,
        sessionToken: sessionToken ?? undefined,
        signatureData,
        signatureImage,
      });
      setStep('success');
    } catch (err) {
      alert('ثبت امضا توسط سرور تأیید نشد. لطفاً دوباره تلاش کنید.');
    }
  };

  const handleReject = async () => {
    if (!request) return;
    
    const reason = prompt('لطفاً دلیل رد امضا را وارد کنید:');
    if (reason) {
      try {
        await remoteSignatureService.rejectSignature(request.id, reason, request.signatureToken, sessionToken ?? undefined);
        setStep('rejected');
      } catch (err) {
        alert('خطا در ثبت رد امضا');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <XCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">خطا</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!request) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold">سیستم امضای دیجیتال اشکه قلم</h1>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">سند:</span>
              <span className="font-semibold mr-2">{request.documentTitle}</span>
            </div>
            <div>
              <span className="text-gray-600">امضاکننده:</span>
              <span className="font-semibold mr-2">{request.signerName}</span>
            </div>
            <div>
              <span className="text-gray-600">درخواست کننده:</span>
              <span className="font-semibold mr-2">{request.requesterName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-600" />
              <span className="text-gray-600">انقضا:</span>
              <span className="font-semibold mr-2">
                {new Date(request.expiresAt).toLocaleDateString('fa-IR')}
              </span>
            </div>
          </div>
        </div>

        {/* OTP Step */}
        {step === 'otp' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">احراز هویت</h2>
            <p className="text-gray-600 mb-4">
              برای امضای این سند، ابتدا باید هویت خود را تأیید کنید.
            </p>
            
            {!otpSent ? (
              <button
                onClick={handleSendOTP}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition"
              >
                {request.authMethod === 'otp_email'
                  ? `ارسال کد تأیید به ایمیل ${request.signerEmail || ''}`
                  : `ارسال کد تأیید به شماره ${request.signerPhone || ''}`}
              </button>
            ) : (
              <div>
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="کد تأیید 6 رقمی"
                  className="w-full border rounded-lg px-4 py-3 mb-3 text-center text-2xl tracking-widest"
                  maxLength={6}
                />
                <button
                  onClick={handleVerifyOTP}
                  disabled={otpCode.length !== 6}
                  className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-300 transition"
                >
                  تأیید کد
                </button>
                {otpError && (
                  <p className="text-red-600 text-sm mt-2 text-center">{otpError}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* View Document Step */}
        {step === 'view' && (
          <div>
            <DocumentViewer
              documentUrl={request.documentUrl}
              title={request.documentTitle}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleProceedToSign}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition"
              >
                ادامه برای امضا
              </button>
              <button
                onClick={handleReject}
                className="flex-1 bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 transition"
              >
                رد امضا
              </button>
            </div>
          </div>
        )}

        {step === 'sign' && (
          <SignatureInterface
            signerName={request.signerName}
            documentTitle={request.documentTitle}
            onSign={handleSign}
            onCancel={() => setStep('view')}
          />
        )}

        {/* Success Step */}
        {step === 'success' && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <CheckCircle className="w-20 h-20 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">امضا با موفقیت ثبت شد</h2>
            <p className="text-gray-600 mb-4">
              امضای دیجیتال شما با موفقیت ثبت و رمزنگاری شد.
            </p>
            <p className="text-sm text-gray-500">
              این صفحه را میتوانید ببندید.
            </p>
          </div>
        )}

        {/* Rejected Step */}
        {step === 'rejected' && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <XCircle className="w-20 h-20 text-red-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">امضا رد شد</h2>
            <p className="text-gray-600">
              درخواست امضا با موفقیت رد شد.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RemoteSignaturePage;
