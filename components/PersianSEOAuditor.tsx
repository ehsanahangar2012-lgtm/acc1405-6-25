import React, { useState, useEffect } from 'react';
import { useMarketingStore } from '../store-marketing';
import { generateId, getPersianDate, toPersianDigits } from '../utils';
import { SeoAuditResult } from '../types-marketing';
import { FileText, Copy, CheckCircle, AlertCircle, FileCode, Check, RefreshCw } from 'lucide-react';

export const PersianSEOAuditor: React.FC = () => {
  const addSeoAudit = useMarketingStore(state => state.addSeoAudit);

  // Input states
  const [slug, setSlug] = useState('box-printing-guide');
  const [contentTitle, setContentTitle] = useState('راهنمای جامع طراحی و چاپ جعبه مقوایی');
  const [metaDescription, setMetaDescription] = useState('در این مقاله با اصول طراحی، گرماژ مناسب ایندربرد و کات قالب جعبه‌های مقوایی برای بسته‌بندی کالا آشنا می‌شوید.');
  const [focusKeyword, setFocusKeyword] = useState('چاپ جعبه مقوایی');
  const [bodyText, setBodyText] = useState(
    `برای چاپ جعبه مقوایی باید ابتدا قالب جعبه را طراحی کنید. جعبه ها در ابعاد مختلف ساخته می شوند.
ما می توانیم از مقوای ایندربرد ۳۰۰ گرمی برای مقاومت بالا استفاده کنیم.
سلفون مات یا سلفون براق می تواند ماندگاری جعبه را زیاد کند. چاپ جعبه مقوایی نقش مهمی در برندینگ کالا دارد.`
  );

  // Schema builder states
  const [schemaType, setSchemaType] = useState<'Product' | 'Article' | 'FAQPage'>('Product');
  const [schemaInputs, setSchemaInputs] = useState<Record<string, string>>({
    name: 'جعبه مقوایی کرافت',
    brand: 'اشک قلم',
    price: '۲۵۰۰',
    author: 'ناظر فنی چاپ',
    q1: 'حداقل تیراژ سفارش چقدر است؟',
    a1: 'حداقل تیراژ برای چاپ اختصاصی افست ۱۰۰۰ عدد است.',
    q2: 'زمان تحویل سفارش چند روز است؟',
    a2: 'زمان تحویل سفارش‌ها معمولا بین ۷ الی ۱۰ روز کاری می‌باشد.'
  });

  const [copiedSchema, setCopiedSchema] = useState(false);
  const [copiedAudit, setCopiedAudit] = useState(false);
  const [jsonLdOutput, setJsonLdOutput] = useState('');

  // Audit results states
  const [audit, setAudit] = useState<Partial<SeoAuditResult['criteria']>>({
    titleLengthOk: false,
    metaDescriptionOk: false,
    h1Count: 0,
    contentLength: 0,
    keywordDensity: 0,
    persianHalfSpaceCheck: false,
    imageAltCheck: true,
  });
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [score, setScore] = useState(0);

  // Calculate audit results in real time
  useEffect(() => {
    const wordCount = bodyText.trim() === '' ? 0 : bodyText.trim().split(/\s+/).length;
    const titleLen = contentTitle.length;
    const metaLen = metaDescription.length;

    // Keyword density
    let keywordCount = 0;
    if (focusKeyword.trim() !== '') {
      const escapedKeyword = focusKeyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(escapedKeyword, 'gi');
      const matches = bodyText.match(regex);
      keywordCount = matches ? matches.length : 0;
    }
    const density = wordCount > 0 ? (keywordCount / wordCount) * 100 : 0;

    // Check H1 in content (simulated parser looking for # title or <h1> tags)
    let h1Count = 0;
    if (contentTitle.trim() !== '') {
      h1Count = 1; // standard since we have title field
    }

    // Persian half-space check (checks if user typed "جعبه ها" instead of "جعبه‌ها" or "می شود" instead of "می‌شود")
    // looking for spaces before specific common prefixes/suffixes
    const spaceBeforeHa = / \u0647\u0627(\s|$)/.test(bodyText); // " ها"
    const spaceBeforeMi = /(\s|^)\u0645\u06cc /.test(bodyText); // "می "
    const halfSpaceRequired = spaceBeforeHa || spaceBeforeMi;

    const criteria = {
      titleLengthOk: titleLen >= 30 && titleLen <= 60,
      metaDescriptionOk: metaLen >= 70 && metaLen <= 150,
      h1Count: h1Count,
      contentLength: wordCount,
      keywordDensity: Number(density.toFixed(2)),
      persianHalfSpaceCheck: !halfSpaceRequired, // true if NO errors found
      imageAltCheck: true,
    };

    setAudit(criteria);

    // Build suggestions list
    const list: string[] = [];
    let calculatedScore = 100;

    if (!criteria.titleLengthOk) {
      list.push(`طول عنوان سئو باید بین ۳۰ تا ۶۰ کاراکتر باشد (فعلاً ${toPersianDigits(titleLen)} کاراکتر است).`);
      calculatedScore -= 15;
    }
    if (!criteria.metaDescriptionOk) {
      list.push(`طول متادیسکریپشن باید بین ۷۰ تا ۱۵۰ کاراکتر باشد تا در گوگل خلاصه نشود (فعلاً ${toPersianDigits(metaLen)} کاراکتر).`);
      calculatedScore -= 15;
    }
    if (wordCount < 300) {
      list.push(`تعداد کلمات متن کم است (حداقل ۳۰۰ کلمه توصیه می‌شود؛ فعلاً ${toPersianDigits(wordCount)} کلمه).`);
      calculatedScore -= 20;
    }
    if (density < 1.0) {
      list.push(`کلمه کلیدی هدف ("${focusKeyword}") کم تکرار شده است (تراکم فعلی ${toPersianDigits(density.toFixed(1))}%؛ توصیه: ۱ تا ۲ درصد).`);
      calculatedScore -= 15;
    } else if (density > 2.5) {
      list.push(`خطر جریمه کیورد استافینگ! کلمه کلیدی هدف بیش از حد تکرار شده است (${toPersianDigits(density.toFixed(1))}%).`);
      calculatedScore -= 20;
    }

    if (halfSpaceRequired) {
      list.push('برخی کلمات نیاز به اصلاح نیم‌فاصله دارند؛ به جای "جعبه ها" از "جعبه‌ها" و به جای "می شود" از "می‌شود" استفاده کنید.');
      calculatedScore -= 10;
    }

    setSuggestions(list);
    setScore(Math.max(10, calculatedScore));
  }, [contentTitle, metaDescription, focusKeyword, bodyText]);

  // Generate JSON-LD Schema
  useEffect(() => {
    let schemaObj = {};
    const pageUrl = `https://ashkghalam.ir/post/${slug}`;

    if (schemaType === 'Product') {
      schemaObj = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: schemaInputs.name,
        brand: { '@type': 'Brand', name: schemaInputs.brand },
        offers: {
          '@type': 'Offer',
          price: schemaInputs.price,
          priceCurrency: 'IRR',
          url: pageUrl
        }
      };
    } else if (schemaType === 'Article') {
      schemaObj = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: contentTitle,
        description: metaDescription,
        author: { '@type': 'Person', name: schemaInputs.author },
        publisher: { '@type': 'Organization', name: 'چاپخانه اشک قلم' },
        datePublished: new Date().toISOString().split('T')[0]
      };
    } else {
      schemaObj = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: schemaInputs.q1,
            acceptedAnswer: { '@type': 'Answer', text: schemaInputs.a1 }
          },
          {
            '@type': 'Question',
            name: schemaInputs.q2,
            acceptedAnswer: { '@type': 'Answer', text: schemaInputs.a2 }
          }
        ]
      };
    }

    setJsonLdOutput(JSON.stringify(schemaObj, null, 2));
  }, [schemaType, schemaInputs, contentTitle, metaDescription, slug]);

  const handleInputChange = (key: string, value: string) => {
    setSchemaInputs(prev => ({ ...prev, [key]: value }));
  };

  const copyToClipboard = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSaveAudit = () => {
    const newAudit: SeoAuditResult = {
      id: 'audit_' + generateId(),
      slug,
      score,
      criteria: {
        titleLengthOk: audit.titleLengthOk || false,
        metaDescriptionOk: audit.metaDescriptionOk || false,
        h1Count: audit.h1Count || 0,
        contentLength: audit.contentLength || 0,
        keywordDensity: audit.keywordDensity || 0,
        persianHalfSpaceCheck: audit.persianHalfSpaceCheck || false,
        imageAltCheck: true
      },
      suggestions,
      jsonLdSchema: jsonLdOutput,
      updatedAt: getPersianDate()
    };

    addSeoAudit(newAudit);
    copyToClipboard(JSON.stringify(newAudit, null, 2), setCopiedAudit);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-slate-100 font-sans">
      {/* Input panel & Editor */}
      <div className="space-y-6 bg-slate-900/50 border border-white/5 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-xl">
        <h3 className="text-lg font-black text-white flex items-center gap-2 pb-4 border-b border-white/5">
          <FileText className="text-teal-400" size={20} />
          ویرایشگر هوشمند و آنالیزور سئو فارسی
        </h3>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-black pr-2">نام مستعار آدرس (Slug)</label>
              <input
                type="text"
                value={slug}
                onChange={e => setSlug(e.target.value)}
                className="w-full bg-slate-950 border-2 border-white/5 rounded-2xl px-5 py-4 text-white text-xs outline-none focus:border-teal-500 font-mono"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-black pr-2">کلمه کلیدی کانونی سئو</label>
              <input
                type="text"
                value={focusKeyword}
                onChange={e => setFocusKeyword(e.target.value)}
                className="w-full bg-slate-950 border-2 border-white/5 rounded-2xl px-5 py-4 text-white text-xs outline-none focus:border-teal-500 font-bold"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-400 font-black pr-2">عنوان سئو (SEO Title)</label>
            <input
              type="text"
              value={contentTitle}
              onChange={e => setContentTitle(e.target.value)}
              className="w-full bg-slate-950 border-2 border-white/5 rounded-2xl px-5 py-4 text-white text-xs outline-none focus:border-teal-500 font-bold"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-400 font-black pr-2">توضیحات متا (Meta Description)</label>
            <textarea
              rows={2}
              value={metaDescription}
              onChange={e => setMetaDescription(e.target.value)}
              className="w-full bg-slate-950 border-2 border-white/5 rounded-2xl px-5 py-4 text-white text-xs outline-none focus:border-teal-500 font-bold leading-relaxed resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-400 font-black pr-2">متن بدنه محتوا (Farsi Article Body)</label>
            <textarea
              rows={8}
              value={bodyText}
              onChange={e => setBodyText(e.target.value)}
              className="w-full bg-slate-950 border-2 border-white/5 rounded-2xl px-5 py-4 text-white text-xs outline-none focus:border-teal-500 font-bold leading-relaxed resize-y"
            />
          </div>
        </div>
      </div>

      {/* SEO Scoring & Suggestions + JSON-LD Generator */}
      <div className="space-y-8">
        {/* SEO Auditor Card */}
        <div className="bg-slate-900/50 border border-white/5 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-xl space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-white/5">
            <h4 className="text-sm font-black text-white">امتیاز سئو و پارامترهای نگارشی</h4>
            <div className="flex items-center gap-3">
              <span className={`text-2xl font-black font-mono px-4 py-2 rounded-2xl ${
                score >= 80 ? 'bg-emerald-500/10 text-emerald-400' : score >= 50 ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'
              }`}>
                {toPersianDigits(score)} / ۱۰۰
              </span>
            </div>
          </div>

          {/* Audit Metrics */}
          <div className="grid grid-cols-2 gap-4 text-xs font-bold">
            <div className="flex items-center gap-2">
              {audit.titleLengthOk ? <CheckCircle className="text-emerald-400" size={16} /> : <AlertCircle className="text-rose-400" size={16} />}
              <span>طول عنوان سئو: {audit.titleLengthOk ? 'مناسب' : 'نامناسب'}</span>
            </div>
            <div className="flex items-center gap-2">
              {audit.metaDescriptionOk ? <CheckCircle className="text-emerald-400" size={16} /> : <AlertCircle className="text-rose-400" size={16} />}
              <span>توضیحات متا: {audit.metaDescriptionOk ? 'مناسب' : 'نامناسب'}</span>
            </div>
            <div className="flex items-center gap-2">
              {audit.contentLength && audit.contentLength >= 300 ? <CheckCircle className="text-emerald-400" size={16} /> : <AlertCircle className="text-amber-400" size={16} />}
              <span>حجم متن: {toPersianDigits(audit.contentLength || 0)} کلمه</span>
            </div>
            <div className="flex items-center gap-2">
              {audit.keywordDensity && audit.keywordDensity >= 1 && audit.keywordDensity <= 2.5 ? <CheckCircle className="text-emerald-400" size={16} /> : <AlertCircle className="text-amber-400" size={16} />}
              <span>تراکم کیورد: {toPersianDigits(audit.keywordDensity || 0)}%</span>
            </div>
            <div className="flex items-center gap-2 col-span-2">
              {audit.persianHalfSpaceCheck ? <CheckCircle className="text-emerald-400" size={16} /> : <AlertCircle className="text-amber-400" size={16} />}
              <span>رعایت قواعد نیم‌فاصله‌نویسی فارسی: {audit.persianHalfSpaceCheck ? 'تایید کامل' : 'نیاز به بهینه‌سازی'}</span>
            </div>
          </div>

          {/* Detailed suggestions list */}
          {suggestions.length > 0 ? (
            <div className="space-y-2.5 pt-4 border-t border-white/5">
              <h5 className="text-[11px] text-slate-400 font-black">لیست اقدامات پیشنهادی برای بهبود رتبه گوگل:</h5>
              <ul className="space-y-2">
                {suggestions.map((item, idx) => (
                  <li key={idx} className="flex gap-2 items-start text-xs font-bold text-amber-300">
                    <span className="shrink-0 text-amber-500 text-base leading-none">•</span>
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold p-4 rounded-2xl flex items-center gap-2">
              <CheckCircle size={18} />
              تبلیغ و محتوای شما کاملاً از نظر سئو بهینه‌سازی شده است!
            </div>
          )}

          <div className="pt-4 flex gap-4">
            <button
              onClick={handleSaveAudit}
              className="flex-1 bg-teal-600 hover:bg-teal-500 text-white font-black py-4 rounded-2xl active:scale-95 transition-all text-xs flex items-center justify-center gap-2 shadow-lg"
            >
              {copiedAudit ? <Check size={16} /> : <RefreshCw size={16} />}
              ذخیره و ایجاد گزارش سئو در پایگاه داده
            </button>
          </div>
        </div>

        {/* Schema Generator Card */}
        <div className="bg-slate-900/50 border border-white/5 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-xl space-y-6">
          <h4 className="text-sm font-black text-white pb-3 border-b border-white/5 flex items-center gap-2">
            <FileCode className="text-indigo-400" size={18} />
            سازنده ساختار کدهای گوگل Schema.org JSON-LD
          </h4>

          {/* Schema Selector Tabs */}
          <div className="flex bg-slate-950 p-1.5 rounded-2xl">
            {(['Product', 'Article', 'FAQPage'] as const).map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setSchemaType(type)}
                className={`flex-1 py-3 text-center text-xs font-black rounded-xl transition-all ${
                  schemaType === type
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {type === 'Product' ? 'محصول چاپی' : type === 'Article' ? 'مقاله علمی' : 'سوالات متداول FAQ'}
              </button>
            ))}
          </div>

          {/* Schema inputs depending on choice */}
          <div className="grid grid-cols-1 gap-4">
            {schemaType === 'Product' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 font-bold">نام محصول چاپی</label>
                    <input
                      type="text"
                      value={schemaInputs.name}
                      onChange={e => handleInputChange('name', e.target.value)}
                      className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 font-bold">برند / چاپخانه</label>
                    <input
                      type="text"
                      value={schemaInputs.brand}
                      onChange={e => handleInputChange('brand', e.target.value)}
                      className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-400 font-bold">حداقل قیمت آفر (ریال)</label>
                  <input
                    type="text"
                    value={schemaInputs.price}
                    onChange={e => handleInputChange('price', e.target.value)}
                    className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-white text-xs text-left font-mono outline-none focus:border-indigo-500"
                    dir="ltr"
                  />
                </div>
              </>
            )}

            {schemaType === 'Article' && (
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-bold">نویسنده مقاله</label>
                <input
                  type="text"
                  value={schemaInputs.author}
                  onChange={e => handleInputChange('author', e.target.value)}
                  className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500"
                />
              </div>
            )}

            {schemaType === 'FAQPage' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-400 font-bold">پرسش اول</label>
                  <input
                    type="text"
                    value={schemaInputs.q1}
                    onChange={e => handleInputChange('q1', e.target.value)}
                    className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500"
                  />
                  <input
                    type="text"
                    placeholder="پاسخ پرسش اول..."
                    value={schemaInputs.a1}
                    onChange={e => handleInputChange('a1', e.target.value)}
                    className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-slate-400 text-xs outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-400 font-bold">پرسش دوم</label>
                  <input
                    type="text"
                    value={schemaInputs.q2}
                    onChange={e => handleInputChange('q2', e.target.value)}
                    className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500"
                  />
                  <input
                    type="text"
                    placeholder="پاسخ پرسش دوم..."
                    value={schemaInputs.a2}
                    onChange={e => handleInputChange('a2', e.target.value)}
                    className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-slate-400 text-xs outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Outputs JSON-LD box */}
          <div className="space-y-2">
            <label className="text-[10px] text-slate-500 font-black flex justify-between items-center pr-2">
              خروجی قطعه کد اسکریپت گوگل:
              <button
                onClick={() => copyToClipboard(jsonLdOutput, setCopiedSchema)}
                className="text-indigo-400 hover:text-indigo-300 text-xs flex items-center gap-1 font-bold"
              >
                {copiedSchema ? <Check size={12} /> : <Copy size={12} />}
                {copiedSchema ? 'کپی شد!' : 'کپی کدهای گوگل'}
              </button>
            </label>
            <pre className="w-full max-h-40 overflow-y-auto bg-slate-950 border border-white/5 rounded-2xl p-4 text-[9px] text-indigo-400 font-mono text-left select-all" dir="ltr">
              {jsonLdOutput}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
