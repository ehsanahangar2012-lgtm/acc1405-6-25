import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Share2, Copy, Check, QrCode, MessageSquare, Smartphone, Send, HelpCircle, ExternalLink } from 'lucide-react';
import { simpleSignatureService } from '../services/simpleSignatureService';
import { formatCurrency, toPersianDigits, getPersianTime, copyToClipboard, getQrCodeUrl } from '../utils';
import SmartSectionGuide from './SmartSectionGuide';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentType: string;
  documentPreview?: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, documentId, documentType, documentPreview }) => {
  const [copied, setCopied] = useState(false);
  const [token, setToken] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [showQrCode, setShowQrCode] = useState(false);
  
  React.useEffect(() => {
    if (isOpen) {
      setToken('');
      setError('');
      setShowQrCode(false);
      if (!documentPreview) {
        setError('خطا: اطلاعات سند موجود نیست');
        return;
      }
      generateToken();
    }
  }, [isOpen, documentPreview]);

  const generateToken = async () => {
    if (!documentPreview) {
      setError('خطا: اطلاعات سند موجود نیست');
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      const newToken = await simpleSignatureService.createRequest(documentId, documentType, documentPreview);
      setToken(newToken);
    } catch (err) {
      console.error('خطا در ایجاد توکن:', err);
      setError('خطا در ایجاد لینک اشتراک‌گذاری');
    } finally {
      setLoading(false);
    }
  };

  const isValidHttpUrl = (url: string | null | undefined): boolean => {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return false;
    try {
      const u = new URL(trimmed);
      return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.hostname && u.hostname.length > 1;
    } catch {
      return false;
    }
  };

  const getBaseUrlSync = () => {
    // 1. بررسی کش محلی معتبر
    try {
      const cached = localStorage.getItem('host_url_config');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && isValidHttpUrl(parsed.baseUrl)) {
          return parsed.baseUrl.replace(/\/$/, '');
        } else if (parsed && parsed.baseUrl) {
          // پاکسازی مقادیر نامعتبر مانند "asdasd" از حافظه مرورگر
          localStorage.removeItem('host_url_config');
        }
      }
    } catch {}

    // 2. بررسی متغیر محیطی فقط در صورت معتبر بودن آدرس HTTP
    const envUrl = import.meta.env.VITE_APP_BASE_URL;
    if (isValidHttpUrl(envUrl)) {
      return envUrl.trim().replace(/\/$/, '');
    }

    // 3. استفاده از مبدأ زنده برنامه در مرورگر (Live Host / App Origin)
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      const origin = window.location.origin;
      const pathname = window.location.pathname ? window.location.pathname.replace(/index.html$/, '').replace(/\/$/, '') : '';
      const live = `${origin}${pathname}`.replace(/\/$/, '');
      if (isValidHttpUrl(live)) {
        return live;
      }
    }

    return 'https://acc.ashkghalam.ir';
  };

  const [useOfficialDomain, setUseOfficialDomain] = useState<boolean>(false);
  const activeBaseUrl = useOfficialDomain ? 'https://acc.ashkghalam.ir' : getBaseUrlSync().replace(/\/$/, '');
  const signUrl = token ? `${activeBaseUrl}/#/sign/${token}` : '';
  const qrImage = token ? getQrCodeUrl(signUrl) : '';

  // پارس کردن پیش‌نمایش سند جهت نمایش اطلاعات در متن اشتراک‌گذاری
  let invoiceInfo: any = null;
  if (documentType === 'فاکتور' && documentPreview) {
    try {
      const parsed = JSON.parse(documentPreview);
      if (parsed) {
        invoiceInfo = {
          number: parsed.number || '',
          date: parsed.date || '',
          customer: parsed.personName || parsed.customer || (parsed.person ? parsed.person.name : ''),
          finalTotal: parsed.finalTotal !== undefined ? parsed.finalTotal : (parsed.total || 0),
          items: parsed.items || []
        };
      }
    } catch (e) {
      console.warn("Failed to parse invoice preview in ShareModal", e);
    }
  }

  const getShareText = () => {
    if (documentType === 'فاکتور' && invoiceInfo) {
      const itemsList = invoiceInfo.items
        .map((item: any) => {
          const name = item.productName || item.name || '';
          const qty = item.quantity || 0;
          return `🔹 ${name} (${toPersianDigits(qty)})`;
        })
        .join('\n');
        
      const formattedDate = toPersianDigits(invoiceInfo.date);
      const currentTime = toPersianDigits(getPersianTime());
      
      return `📄 فاکتور رسمی اشک قلم
━━━━━━━━━━━━━━━━━━━━
👤 خریدار / مشتری: ${invoiceInfo.customer}
🔢 شماره فاکتور: ${toPersianDigits(invoiceInfo.number)}
📅 تاریخ صدور: ${formattedDate}
⏰ ساعت صدور: ${currentTime}
━━━━━━━━━━━━━━━━━━━━
📦 اقلام فاکتور:
${itemsList}
━━━━━━━━━━━━━━━━━━━━
💰 مبلغ قابل پرداخت: ${formatCurrency(invoiceInfo.finalTotal)}
━━━━━━━━━━━━━━━━━━━━
🔗 جهت مشاهده، پرداخت و امضای دیجیتال فاکتور روی لینک زیر کلیک کنید:
${signUrl}

✍️ این فاکتور به صورت دیجیتال صادر شده و دارای امضای الکترونیک معتبر صادرکننده می‌باشد.`;
    }

    if (documentType === 'قرارداد' && documentPreview) {
      try {
        const parsed = JSON.parse(documentPreview);
        if (parsed) {
          const number = parsed.number || '';
          const title = parsed.title || '';
          const personName = parsed.personName || (parsed.person ? parsed.person.name : '');
          const totalAmount = parsed.totalAmount || 0;
          const createdAt = parsed.createdAt || '';
          
          return `📄 قرارداد رسمی شماره ${toPersianDigits(number)}
━━━━━━━━━━━━━━━━━━━━
✍️ عنوان: ${title}
👤 طرف دوم: ${personName}
📅 تاریخ: ${toPersianDigits(createdAt)}
━━━━━━━━━━━━━━━━━━━━
💰 مبلغ تعهد: ${formatCurrency(totalAmount)}
━━━━━━━━━━━━━━━━━━━━
🔗 جهت مشاهده و امضای آنلاین قرارداد روی لینک زیر کلیک کنید:
${signUrl}

✍️ دارای امضای دیجیتال و گواهی اصالت الکترونیک.`;
        }
      } catch (e) {
        console.warn("Failed to parse contract preview in ShareModal", e);
      }
    }

    return `سلام، لطفاً سند ${documentType} را از طریق لینک امن زیر مشاهده و امضا فرمایید:\n${signUrl}`;
  };

  const shareText = getShareText();
  const encodedText = encodeURIComponent(shareText);
  const encodedUrl = encodeURIComponent(signUrl);

  const shareLinks = {
    whatsapp: `https://wa.me/?text=${encodedText}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
    bale: `https://ble.ir/share/url?url=${encodedUrl}&text=${encodedText}`,
    eitaa: `https://eitaa.com/share/url?url=${encodedUrl}&text=${encodedText}`,
    rubika: `https://rubika.ir/share/url?url=${encodedUrl}&text=${encodedText}`,
    sms: `sms:?body=${encodedText}`
  };

  const [copyFeedback, setCopyFeedback] = useState<string>('');

  const handleCopy = async () => {
    const success = await copyToClipboard(shareText);
    if (success) {
      setCopied(true);
      setCopyFeedback('متن و لینک امضا با موفقیت کپی شد.');
      setTimeout(() => {
        setCopied(false);
        setCopyFeedback('');
      }, 2500);
    } else {
      setCopyFeedback('لطفاً لینک را از کادر پایین انتخاب و کپی کنید.');
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-4 animate-fade-in" onClick={onClose} dir="rtl">
      <div className="bg-slate-900 border-t md:border border-white/10 w-full max-w-lg rounded-t-[2.5rem] md:rounded-[2.5rem] p-6 shadow-2xl animate-slide-up relative max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 md:hidden"></div>
        
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-500/10 rounded-xl flex items-center justify-center">
              <Share2 size={20} className="text-teal-400" />
            </div>
            <div>
              <h3 className="text-white font-black text-lg">اشتراک‌گذاری و امضای {documentType}</h3>
              <p className="text-[11px] text-slate-400">ارسال لینک مستقیم و امن برای مشتری و مخاطب</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SmartSectionGuide />
            <button onClick={onClose} className="text-slate-400 hover:text-white p-2 hover:bg-white/5 rounded-xl transition-all">
              <X size={20} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500 mx-auto mb-3"></div>
            <p className="text-slate-400 text-sm font-bold">در حال تولید توکن و لینک امن...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-rose-500/10 rounded-xl flex items-center justify-center mx-auto mb-3">
              <X size={24} className="text-rose-500" />
            </div>
            <p className="text-rose-500 text-sm mb-4 font-bold">{error}</p>
            <button onClick={generateToken} className="text-teal-400 text-sm font-bold hover:underline">تلاش مجدد</button>
          </div>
        ) : !token ? (
          <div className="text-center py-8">
            <p className="text-slate-400 text-sm">لینک تولید نشد</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Quick Actions Bar */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                onClick={() => setShowQrCode(!showQrCode)}
                className={`flex items-center justify-center gap-2 p-3 rounded-2xl font-bold text-xs transition-all border ${
                  showQrCode ? 'bg-teal-600 text-white border-teal-500' : 'bg-slate-800 text-slate-200 border-white/10 hover:bg-slate-700'
                }`}
              >
                <QrCode size={16} />
                <span>{showQrCode ? 'بستن بارکد QR' : 'نمایش بارکد QR امضا'}</span>
              </button>

              <button
                onClick={handleCopy}
                className="flex items-center justify-center gap-2 p-3 bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-200 rounded-2xl font-bold text-xs transition-all"
              >
                {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                <span>{copied ? 'متن کامل کپی شد' : 'کپی متن و لینک'}</span>
              </button>
            </div>

            {/* QR Code display */}
            {showQrCode && (
              <div className="bg-slate-950 border border-teal-500/40 rounded-3xl p-6 text-center animate-scale-up space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">اسکن مستقیم با دوربین گوشی</span>
                  <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-white/10 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setUseOfficialDomain(false)}
                      className={`px-2 py-1 rounded-lg font-bold transition-all ${
                        !useOfficialDomain ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      سرور برنامه
                    </button>
                    <button
                      type="button"
                      onClick={() => setUseOfficialDomain(true)}
                      className={`px-2 py-1 rounded-lg font-bold transition-all ${
                        useOfficialDomain ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      دامنه رسمی ابری
                    </button>
                  </div>
                </div>

                <div className="inline-block p-4 bg-white rounded-2xl shadow-2xl border border-white/20">
                  {qrImage ? (
                    <img src={qrImage} alt="بارکد امضای دیجیتال" className="w-48 h-48 object-contain select-none" />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center text-slate-400 text-xs">در حال بارگذاری بارکد...</div>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-[11px] text-teal-400 font-mono break-all dir-ltr select-all bg-slate-900/80 p-2 rounded-xl border border-white/5">
                    {signUrl}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    بارکد استاندارد QR کاملاً خوانا برای انواع اسکنرها و دوربین‌های هوشمند
                  </p>
                </div>
              </div>
            )}

            {/* Messenger Sharing Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <a
                href={shareLinks.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 p-3.5 bg-emerald-600 hover:bg-emerald-500 rounded-2xl text-white font-bold text-xs transition-all shadow-md active:scale-95"
              >
                <span>واتساپ</span>
              </a>

              <a
                href={shareLinks.telegram}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 p-3.5 bg-sky-600 hover:bg-sky-500 rounded-2xl text-white font-bold text-xs transition-all shadow-md active:scale-95"
              >
                <span>تلگرام</span>
              </a>

              <a
                href={shareLinks.bale}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 p-3.5 bg-teal-700 hover:bg-teal-600 rounded-2xl text-white font-bold text-xs transition-all shadow-md active:scale-95"
              >
                <span>پیام‌رسان بله</span>
              </a>

              <a
                href={shareLinks.eitaa}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 p-3.5 bg-amber-700 hover:bg-amber-600 rounded-2xl text-white font-bold text-xs transition-all shadow-md active:scale-95"
              >
                <span>پیام‌رسان ایتا</span>
              </a>

              <a
                href={shareLinks.rubika}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 p-3.5 bg-purple-700 hover:bg-purple-600 rounded-2xl text-white font-bold text-xs transition-all shadow-md active:scale-95"
              >
                <span>روبیکا</span>
              </a>

              <a
                href={shareLinks.sms}
                className="flex items-center justify-center gap-2 p-3.5 bg-slate-700 hover:bg-slate-600 rounded-2xl text-white font-bold text-xs transition-all shadow-md active:scale-95"
              >
                <Smartphone size={14} />
                <span>ارسال با پیامک</span>
              </a>
            </div>

            {copyFeedback && (
              <div className={`p-3 rounded-xl text-center text-xs font-bold animate-fade-in ${
                copied ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}>
                {copyFeedback}
              </div>
            )}

            {/* Direct URL Box */}
            <div className="bg-slate-950 border border-white/5 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-bold">آدرس مستقیم لینک امضا:</span>
                <span className="text-[10px] text-teal-400 font-bold">مهلت اعتبار: ۴۸ ساعت</span>
              </div>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  readOnly 
                  value={signUrl}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono outline-none"
                />
                <a
                  href={signUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl flex items-center justify-center transition-all shadow-md"
                  title="باز کردن صفحه امضا در تب جدید"
                >
                  <ExternalLink size={16} />
                </a>
              </div>
              <div className="pt-1 flex justify-between items-center text-[10px] text-slate-500">
                <span>امضای ثبت شده بلافاصله و بلادرنگ روی فاکتور اعمال می‌شود.</span>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3.5 rounded-2xl font-bold mt-4 transition-all text-sm"
        >
          بستن پنجره
        </button>
      </div>
    </div>,
    document.body
  );
};

export default ShareModal;
