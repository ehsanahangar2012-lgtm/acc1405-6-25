import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { simpleSignatureService } from '../services/simpleSignatureService';
import { CheckCircle2, X, PenTool, FileText, Download, Shield, Package, User, Scale, Camera } from 'lucide-react';
import { PrintTemplate } from '../components/PrintTemplates';
import { FullScreenSignatureModal } from '../components/Shared';
import html2canvas from 'html2canvas';
import { generatePdfBlob, downloadPdfBlob } from '../utils';
import SmartSectionGuide from '../components/SmartSectionGuide';

export const SimpleSignaturePage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [request, setRequest] = useState<Record<string, any> | null>(null);
  const [step, setStep] = useState<'preview' | 'terms' | 'info' | 'sign' | 'complete'>('preview');
  const [signerName, setSignerName] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [fullDocument, setFullDocument] = useState<Record<string, any> | null>(null);
  const [barcodeUrl, setBarcodeUrl] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadRequest = async () => {
      if (token) {
        console.log('Loading request for token:', token);
        try {
          const req = await simpleSignatureService.getRequest(token);
          console.log('Request loaded:', req);
          if (req) {
            setRequest(req);
            // بارگذاری سند کامل از documentPreview
            if (req.documentPreview) {
              try {
                console.log('Parsing documentPreview:', req.documentPreview.substring(0, 100));
                const doc = JSON.parse(req.documentPreview);
                console.log('Document parsed:', doc);
                setFullDocument(doc);
                
                const customerName = doc.personName || (doc.person && doc.person.name) || (typeof doc.person === 'string' ? doc.person : '');
                if (customerName) {
                  setSignerName(prev => prev || customerName);
                }
                
                if (doc.number) {
                  try {
                    const QRCode = await import('qrcode');
                    const cleanDate = (doc.date || doc.createdAt || '').replace(/\//g, '');
                    const barcodeData = doc.type === 'voucher' 
                      ? `VCH-${doc.number}-${cleanDate}` 
                      : (doc.type === 'CHECK_TRANSFER' || req.documentType === 'CHECK_TRANSFER' || req.documentType === 'رسید واگذاری')
                      ? `TRF-${doc.number}-${cleanDate}`
                      : (doc.type === 'contract' || req.documentType === 'قرارداد')
                      ? `CON-${doc.number}-${cleanDate}`
                      : `INV-${doc.number}-${cleanDate}`;
                    const barcode = await QRCode.default.toDataURL(barcodeData, { width: 200, margin: 1 });
                    setBarcodeUrl(barcode);
                  } catch (barcodeError) {
                    console.error('خطا در تولید بارکد:', barcodeError);
                  }
                }
              } catch (e) {
                const errorMessage = e instanceof Error ? e.message : 'خطای نامشخص';
                console.error('خطا در پارس سند:', errorMessage, e);
                setError(`خطا در بارگذاری سند: ${errorMessage}`);
              }
            } else {
              console.error('documentPreview is empty');
              setError('اطلاعات سند موجود نیست');
            }
          } else {
            console.error('Request not found or expired');
            setError('لینک نامعتبر یا منقضی شده است');
          }
        } catch (err) {
          console.error('Error loading request:', err);
          setError('خطا در بارگذاری درخواست امضا');
        }
      } else {
        setError('توکن نامعتبر است');
      }
    };
    loadRequest();
  }, [token]);

  useEffect(() => {
    if (step === 'sign' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000';
      }
    }
  }, [step]);

  const handleAcceptTerms = () => {
    if (!accepted) {
      setError('لطفاً قوانین را بپذیرید');
      return;
    }
    setStep('info');
    setError('');
  };

  const handleSign = () => {
    if (!signerName.trim()) {
      setError('لطفاً نام خود را وارد کنید');
      return;
    }
    setStep('sign');
    setError('');
  };

  const handleComplete = async (signatureData: string) => {
    if (!token) return;
    
    const success = await simpleSignatureService.signRequest(token, signerName, signatureData, request.documentId);
    
    if (success) {
      // بروزرسانی سند با امضای جدید برای نمایش در پیش‌نمایش مخفی
      setFullDocument((prev: Record<string, any> | null) => ({ ...prev, signature: signatureData }));
      setStep('complete');
    } else {
      setError('خطا در ثبت امضا');
    }
  };

  const downloadPreviewAsImage = async () => {
    if (!previewRef.current) return;
    
    try {
      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        width: previewRef.current.scrollWidth,
        height: previewRef.current.scrollHeight
      });
      
      const isContract = fullDocument?.type === 'contract' || request?.documentType === 'قرارداد';
      const docTypeName = isContract ? 'قرارداد' : (fullDocument?.type === 'voucher' ? 'حواله' : 'فاکتور');
      const link = document.createElement('a');
      link.download = `${docTypeName}-${fullDocument?.number}-${signerName}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('خطا در تولید تصویر:', error);
      alert('خطا در دانلود تصویر');
    }
  };

  const downloadPreviewAsPDF = async () => {
    if (!previewRef.current) return;
    
    try {
      const isContract = fullDocument?.type === 'contract' || request?.documentType === 'قرارداد';
      const docTypeName = isContract ? 'قرارداد' : (fullDocument?.type === 'voucher' ? 'حواله' : 'فاکتور');
      const pdfBlob = await generatePdfBlob(previewRef.current);
      const filename = `${docTypeName}-${fullDocument?.number}-${signerName}.pdf`;
      downloadPdfBlob(pdfBlob, filename);
    } catch (error) {
      console.error('خطا در تولید PDF:', error);
      alert('خطا در دانلود PDF');
    }
  };

  const downloadCertificate = () => {
    const cert = `
گواهی امضای دیجیتال
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

سند: ${request?.documentType}
شناسه سند: ${request?.documentId}
امضاکننده: ${signerName}
تاریخ: ${new Date().toLocaleDateString('fa-IR')}
زمان: ${new Date().toLocaleTimeString('fa-IR')}
شناسه درخواست: ${token}

این گواهی تأیید میکند که سند فوق توسط فرد مذکور
با استفاده از امضای الکترونیکی معتبر امضا شده است.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
سیستم اشک قلم کلود
    `;
    const blob = new Blob([cert], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `certificate-${token}.txt`;
    a.click();
  };

  if (error && !request) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 text-center max-w-md w-full shadow-2xl">
          <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <X size={32} className="text-rose-500" />
          </div>
          <h2 className="text-xl font-black text-white mb-2">خطا در بارگذاری سند</h2>
          <p className="text-slate-400 text-sm mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-3.5 px-6 rounded-2xl transition-all active:scale-95 shadow-lg"
          >
            تلاش مجدد
          </button>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4" dir="rtl">
        <div className="w-12 h-12 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin"></div>
        <div className="text-teal-400 font-bold text-sm">در حال بارگذاری اطلاعات سند امضا...</div>
      </div>
    );
  }

  const hiddenPreview = (
    <div style={{ position: 'fixed', left: '-9999px', top: '-9999px', width: '210mm' }}>
      <div ref={previewRef} className="bg-white">
        {fullDocument ? (
          <div>
            <PrintTemplate 
              data={fullDocument}
              theme="official"
              type={
                request.documentType === 'فاکتور' ? 'INVOICE' 
                : request.documentType === 'رسید' ? 'VOUCHER' 
                : (request.documentType === 'CHECK_TRANSFER' || request.documentType === 'واگذاری چک' || request.documentType === 'رسید واگذاری') ? 'CHECK_TRANSFER'
                : (request.documentType === 'قرارداد' || fullDocument?.type === 'contract') ? 'CONTRACT'
                : fullDocument.type === 'voucher' ? 'VOUCHER' : 'INVOICE'
              }
            />
            {barcodeUrl && (
              <div className="p-6 border-t-2 bg-gray-50 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">بارکد {fullDocument.type === 'voucher' ? 'حواله' : (request.documentType === 'CHECK_TRANSFER' || request.documentType === 'واگذاری چک' || request.documentType === 'رسید واگذاری') ? 'رسید واگذاری' : (fullDocument.type === 'contract' || request.documentType === 'قرارداد') ? 'قرارداد' : 'فاکتور'}</p>
                  <img src={barcodeUrl} alt="Barcode" className="h-16" />
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 mb-1">کد رهگیری</p>
                  <p className="font-mono font-bold text-lg">{fullDocument.trackingCode || `${fullDocument.type === 'voucher' ? 'VCH' : (request.documentType === 'CHECK_TRANSFER' || request.documentType === 'واگذاری چک' || request.documentType === 'رسید واگذاری') ? 'TRF' : (fullDocument.type === 'contract' || request.documentType === 'قرارداد') ? 'CON' : 'INV'}-${fullDocument.number}`}</p>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );

  if (step === 'complete') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        {hiddenPreview}
        <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-teal-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-teal-500" />
          </div>
          <h2 className="text-xl font-black text-white mb-2">امضا با موفقیت ثبت شد</h2>
          <p className="text-slate-400 mb-6">سند با موفقیت امضا شد و در سیستم ثبت گردید</p>
          
          <div className="bg-slate-800 border border-white/10 rounded-2xl p-4 mb-6 text-right">
            <div className="text-sm text-slate-300 space-y-2">
              <p><span className="text-slate-500">امضاکننده:</span> {signerName}</p>
              <p><span className="text-slate-500">تاریخ:</span> {new Date().toLocaleDateString('fa-IR')}</p>
              <p><span className="text-slate-500">زمان:</span> {new Date().toLocaleTimeString('fa-IR')}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={downloadPreviewAsImage}
              className="flex-1 bg-green-600 text-white px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-2"
            >
              <Download size={20} />
              دانلود تصویر
            </button>
            <button
              onClick={downloadPreviewAsPDF}
              className="flex-1 bg-red-600 text-white px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-2"
            >
              <Download size={20} />
              دانلود PDF
            </button>
            <button
              onClick={downloadCertificate}
              className="flex-1 bg-blue-600 text-white px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-2"
            >
              <Download size={20} />
              گواهی
            </button>
          </div>
          <button
            onClick={() => window.close()}
            className="w-full bg-slate-800 text-white px-6 py-3 rounded-2xl font-bold mt-3"
          >
            بستن
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-teal-500/10 rounded-xl flex items-center justify-center">
                <PenTool size={24} className="text-teal-400" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white">امضای دیجیتال و امن</h1>
                <p className="text-sm text-slate-400">{request.documentType}</p>
              </div>
            </div>
            <SmartSectionGuide />
          </div>
        </div>

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
              <div className="bg-linear-to-r from-blue-600 to-teal-600 p-6 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">پیشنمایش کامل سند</h2>
                    <p className="text-blue-100 text-sm">لطفاً قبل از امضا با دقت بررسی کنید</p>
                  </div>
                </div>
              </div>
              <div className="max-h-[70vh] overflow-y-auto bg-white" ref={previewRef}>
                <div className="sticky top-0 bg-white border-b-2 border-gray-200 p-4 shadow-sm z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-bold text-gray-700">سند آماده برای امضا</span>
                    </div>
                    <div className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                      امضای الکترونیکی
                    </div>
                  </div>
                </div>
                {error && !fullDocument ? (
                  <div className="bg-red-50 p-6 text-center">
                    <p className="text-red-600">{error}</p>
                  </div>
                ) : fullDocument ? (
                  <div className="bg-white">
                    <PrintTemplate 
                      data={fullDocument}
                      theme="official"
                      type={
                        request.documentType === 'فاکتور' ? 'INVOICE' 
                        : request.documentType === 'رسید' ? 'VOUCHER' 
                        : (request.documentType === 'CHECK_TRANSFER' || request.documentType === 'واگذاری چک' || request.documentType === 'رسید واگذاری') ? 'CHECK_TRANSFER'
                        : (request.documentType === 'قرارداد' || fullDocument?.type === 'contract') ? 'CONTRACT'
                        : fullDocument.type === 'voucher' ? 'VOUCHER' : 'INVOICE'
                      }
                    />
                    {barcodeUrl && (
                      <div className="p-6 border-t-2 bg-gray-50 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">بارکد {fullDocument.type === 'voucher' ? 'حواله' : (request.documentType === 'CHECK_TRANSFER' || request.documentType === 'واگذاری چک' || request.documentType === 'رسید واگذاری') ? 'رسید واگذاری' : (fullDocument.type === 'contract' || request.documentType === 'قرارداد') ? 'قرارداد' : 'فاکتور'}</p>
                          <img src={barcodeUrl} alt="Barcode" className="h-16" />
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500 mb-1">کد رهگیری</p>
                          <p className="font-mono font-bold text-lg">{fullDocument.trackingCode || `${fullDocument.type === 'voucher' ? 'VCH' : (request.documentType === 'CHECK_TRANSFER' || request.documentType === 'واگذاری چک' || request.documentType === 'رسید واگذاری') ? 'TRF' : (fullDocument.type === 'contract' || request.documentType === 'قرارداد') ? 'CON' : 'INV'}-${fullDocument.number}`}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white p-6 text-center">
                    <p className="text-gray-500">در حال بارگذاری...</p>
                  </div>
                )}
              </div>
            </div>
            <button onClick={() => setStep('terms')} className="w-full bg-teal-600 text-white py-4 rounded-2xl font-bold">
              ادامه
            </button>
          </div>
        )}

        {step === 'terms' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-white/10 rounded-3xl p-6">
              <h2 className="text-lg font-black text-white mb-4 flex items-center gap-3">
                <Shield className="text-blue-400" size={24} />
                قوانین امضای دیجیتال
              </h2>
              <div className="bg-slate-800 border border-white/10 rounded-2xl p-6 mb-6">
                <div className="text-slate-300 text-sm space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5">1</div>
                    <p>امضای الکترونیکی دارای اعتبار قانونی کامل است و منطبق با قوانین جمهوری اسلامی ایران میباشد</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5">2</div>
                    <p>محتوای سند را با دقت کامل مطالعه کرده و تمام اطلاعات آن را تأیید میکنم</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-orange-600 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5">3</div>
                    <p>امضای من غیرقابل انکار بوده و مسئولیت کامل آن را میپذیرم</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5">4</div>
                    <p>این امضا در سیستم ثبت شده و قابل پیگیری و بازیابی است</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-slate-900 border border-white/10 rounded-3xl p-6">
              <label className="flex items-start gap-4 cursor-pointer group">
                <div className="relative">
                  <input 
                    type="checkbox" 
                    checked={accepted} 
                    onChange={(e) => setAccepted(e.target.checked)}
                    className="w-6 h-6 rounded border-2 border-slate-600 bg-slate-800 checked:bg-blue-600 checked:border-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                  />
                  {accepted && (
                    <CheckCircle2 className="absolute inset-0 w-6 h-6 text-white pointer-events-none" />
                  )}
                </div>
                <div className="flex-1">
                  <span className="text-white font-bold text-lg block mb-2 group-hover:text-blue-400 transition-colors">
                    ✅ تمام قوانین فوق را مطالعه کرده و میپذیرم
                  </span>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    با انتخاب این گزینه، تأیید میکنم که تمام شرایط و قوانین امضای الکترونیکی را مطالعه کرده و کاملاً درک نمودهام و با آنها موافقم.
                  </p>
                </div>
              </label>
            </div>
            {error && <p className="text-rose-500 text-sm text-center">{error}</p>}
            <button onClick={handleAcceptTerms} className="w-full bg-teal-600 text-white py-4 rounded-2xl font-bold">
              قبول و ادامه
            </button>
          </div>
        )}

        {step === 'info' && (
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6">
            <h2 className="text-lg font-black text-white mb-4">اطلاعات امضاکننده</h2>
            <input
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white mb-4"
              placeholder="نام و نام خانوادگی"
            />
            {error && <p className="text-rose-500 text-sm mb-4">{error}</p>}
            <button onClick={handleSign} className="w-full bg-teal-600 text-white py-4 rounded-2xl font-bold">
              ادامه
            </button>
          </div>
        )}

        {step === 'sign' && (
          <FullScreenSignatureModal
            isOpen={true}
            onClose={() => setStep('info')}
            onSave={handleComplete}
            type="customer"
            docId={request.documentId}
          />
        )}
      </div>
    </div>
  );
};

export default SimpleSignaturePage;
