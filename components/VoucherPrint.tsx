
import React from 'react';
import { Voucher, PrintTheme } from '../types';
import { toPersianDigits, getQrCodeUrl, generateId, formatCurrency } from '../utils';
import { useStore } from '../store';
import { Package, Truck, Scale, ShieldCheck, Box, UserCheck, AlertTriangle, MapPinned, Smartphone, Weight, QrCode, User, Navigation, Anchor, Wind, Sun, Award, Camera, Coins, MapPin, HelpCircle, CheckCircle2 } from 'lucide-react';
import { PersianWatermarkCanvas, PersianHeaderBanner, PersianCard, PersianHashtiSeal, IslimiCornerSvg } from './PersianArtCanvas';
import { DocumentTrialWatermarkFooter } from './DocumentTrialWatermarkFooter';

interface Props { data: Voucher; theme: PrintTheme; }

export const VoucherPrint: React.FC<Props> = ({ data, theme }) => {
    const { companies } = useStore();
    const docCompany = companies.find(c => c.id === data.companyId) || companies[0] || {
        id: 'default',
        name: 'اشک قلم',
        address: 'تهران',
        phone: '021',
        isActive: true
    };
    
    // Driver Specific QR: Contains Receiver Name, Phone, and potential Location string
    const driverQrData = `DELIVERY_INFO\nReceiver: ${data.personName}\nPhone: ${data.receiverPhone || 'N/A'}\nVehicle: ${data.vehicleNumber || 'N/A'}\nTracking: ${data.trackingCode}`;
    const driverQr = getQrCodeUrl(driverQrData);
    
    // Auth QR
    const authQr = getQrCodeUrl(`VOUCHER:${data.trackingCode}\nTYPE:${data.type}\nDATE:${data.date}`);

    // Vibrant Canva Themes Configuration
    const themeStyles: any = {
        smart: { 
            primary: 'bg-teal-500', 
            accent: 'text-teal-600', 
            light: 'bg-teal-50', 
            border: 'border-teal-500', 
            dark: 'text-teal-950',
            gradient: 'from-teal-500 to-emerald-400',
            icon: <Wind size={64} className="text-teal-600" />
        },
        premium: { 
            primary: 'bg-indigo-600', 
            accent: 'text-indigo-600', 
            light: 'bg-indigo-50', 
            border: 'border-indigo-600', 
            dark: 'text-indigo-950',
            gradient: 'from-indigo-600 to-violet-500',
            icon: <Anchor size={64} className="text-indigo-600" />
        },
        industrial: { 
            primary: 'bg-amber-500', 
            accent: 'text-amber-600', 
            light: 'bg-orange-50', 
            border: 'border-amber-500', 
            dark: 'text-orange-950',
            gradient: 'from-amber-500 to-orange-600',
            icon: <Sun size={64} className="text-amber-500" />
        },
        official: { 
            primary: 'bg-slate-800', 
            accent: 'text-slate-800', 
            light: 'bg-slate-100', 
            border: 'border-slate-800', 
            dark: 'text-slate-950',
            gradient: 'from-slate-800 to-slate-900',
            icon: <Award size={64} className="text-slate-900" />
        }
    };
    
    if (theme === 'persian') {
        return <PersianVoucherTemplate data={data} docCompany={docCompany} driverQr={driverQr} authQr={authQr} />;
    }

    const s = themeStyles[theme] || themeStyles.smart;

    return (
        <div className="p-8 bg-white min-h-[297mm] flex flex-col text-slate-950 font-sans shadow-none border-none overflow-hidden relative" dir="rtl" style={{ fontFamily: 'Vazirmatn, Tahoma, sans-serif' }}>
            {/* VIBRANT TOP HEADER */}
            <div className={`flex justify-between items-stretch mb-8 rounded-[2.5rem] p-6 bg-gradient-to-r ${s.gradient} text-white shadow-xl relative overflow-hidden`}>
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
                
                <div className="flex items-center gap-6 relative z-10">
                    <div className="w-24 h-24 rounded-3xl flex items-center justify-center bg-white shadow-lg">
                        {docCompany.logo ? <img src={docCompany.logo} className="w-full h-full object-contain p-2" alt="Logo" /> : s.icon}
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-tighter mb-1">{docCompany.name}</h1>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">Supply Chain & Logistics</p>
                        <div className="flex gap-4 mt-3 bg-black/20 p-2 rounded-xl backdrop-blur-md w-fit px-4">
                            <span className="flex items-center gap-1 text-[10px] font-black"><Package size={12}/> {toPersianDigits(data.items.length)} Items</span>
                            <div className="w-px h-3 bg-white/30"></div>
                            <span className="flex items-center gap-1 text-[10px] font-black"><Weight size={12}/> {toPersianDigits(data.totalWeight || 0)} KG</span>
                        </div>
                    </div>
                </div>
                
                <div className="text-left flex flex-col items-end justify-center relative z-10">
                    <div className="text-4xl font-black mb-1 opacity-90">حواله {data.type === 'IN' ? 'ورود' : 'خروج'}</div>
                    <div className="flex items-center gap-3 bg-white text-black px-4 py-2 rounded-xl shadow-lg mt-2">
                        <div className="text-right">
                            <span className="block text-[8px] font-black uppercase text-slate-400">Tracking ID</span>
                            <span className="block text-sm font-black font-mono">{toPersianDigits(data.trackingCode)}</span>
                        </div>
                        <QrCode size={24} className={s.accent}/>
                    </div>
                </div>
            </div>

            {/* INFO CARDS */}
            <div className="grid grid-cols-12 gap-6 mb-8">
                {/* Customer & Location Info */}
                <div className={`col-span-8 ${s.light} p-5 rounded-[2rem] border-2 ${s.border} relative overflow-hidden group`}>
                    <div className={`absolute top-0 right-0 w-2 h-full ${s.primary}`}></div>
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-2"><User size={12}/> تحویل‌گیرنده / صاحب کالا</span>
                            <div className="text-xl font-black text-slate-900 mb-1">{data.personName}</div>
                            <div className="flex gap-4 text-xs font-bold text-slate-500">
                                <span className="flex items-center gap-1"><Smartphone size={12}/> {toPersianDigits(data.receiverPhone || '---')}</span>
                                <span className="flex items-center gap-1"><MapPin size={12}/> {docCompany.address}</span>
                            </div>
                        </div>
                        {/* Driver Exclusive QR */}
                        <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-md flex flex-col items-center gap-1">
                            <img src={driverQr} className="w-16 h-16" alt="Driver QR" />
                            <span className="text-[7px] font-black uppercase text-slate-400">Driver Scan</span>
                        </div>
                    </div>
                </div>

                {/* Logistics Info */}
                <div className="col-span-4 bg-slate-50 p-5 rounded-[2rem] border border-slate-200 flex flex-col justify-between">
                    <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-2"><Truck size={12}/> اطلاعات حمل</span>
                        <div className="text-lg font-black text-slate-800">{data.supervisor || 'تعیین نشده'}</div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-200">
                        <div className="flex justify-between items-center">
                            <span className="text-[9px] font-bold text-slate-500">پلاک خودرو:</span>
                            <span className="font-mono font-black text-sm bg-slate-200 px-2 rounded">{data.vehicleNumber || '---'}</span>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                            <span className="text-[9px] font-bold text-slate-500">تاریخ:</span>
                            <span className="font-mono font-black text-sm">{toPersianDigits(data.date)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ITEM TABLE - CANVA STYLE */}
            <div className={`flex-1 border-2 ${s.border} rounded-[2.5rem] overflow-hidden mb-8 shadow-lg bg-white relative`}>
                <table className="w-full text-right border-collapse">
                    <thead className={`${s.primary} text-white`}>
                        <tr className="text-[10px] font-black uppercase tracking-wider">
                            <th className="p-4 text-center w-16">ردیف</th>
                            <th className="p-4 text-center w-24 bg-black/10">موقعیت (Shelf)</th>
                            <th className="p-4">شرح کالا / قطعات</th>
                            <th className="p-4 text-center w-24">تعداد</th>
                            <th className="p-4 text-center w-24">وزن (KG)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {data.items.map((item, i) => (
                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4 font-black text-center text-slate-300 text-sm">{toPersianDigits(i + 1)}</td>
                                <td className={`p-4 text-center font-mono font-black text-sm ${s.accent} bg-slate-50/50`}>
                                    {item.shelfLocation || '-'}
                                </td>
                                <td className="p-4">
                                    <div className="font-black text-sm text-slate-900">{item.productName}</div>
                                </td>
                                <td className="p-4 text-center font-black text-lg text-slate-800">
                                    {toPersianDigits(item.quantity)} <span className="text-[8px] text-slate-400 font-bold">{item.unit}</span>
                                </td>
                                <td className="p-4 text-center font-mono font-black text-sm text-slate-400">
                                    {toPersianDigits((item.quantity * (item.weight || 0)).toLocaleString())}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* FOOTER SUMMARY & NOTES */}
            <div className="grid grid-cols-12 gap-6 mb-8">
                <div className={`col-span-8 border border-slate-200 p-5 rounded-[2rem] bg-slate-50 relative`}>
                     <div className="space-y-2">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2"><Scale size={14}/> توضیحات انباردار</h4>
                        <p className="text-xs font-bold leading-5 text-slate-700">
                            {data.notes || 'محموله طبق لیست فوق و با رعایت استانداردهای ایمنی بارگیری شده و از سلامت کامل ظاهری برخوردار است.'}
                        </p>
                    </div>
                </div>
                
                 {/* Estimated Value Block */}
                <div className="col-span-4 bg-amber-50 border border-amber-200 p-5 rounded-[2rem] flex flex-col justify-center items-center shadow-sm">
                    <span className="text-[9px] text-amber-400 font-black uppercase tracking-widest mb-1">ارزش تقریبی کالا</span>
                    <span className="text-xl font-black font-mono tracking-tighter text-amber-600">{formatCurrency(data.estimatedValue || 0).replace(' ریال','')}</span>
                    <span className="text-[8px] text-amber-300 font-bold">جهت اطلاع / بیمه باربری</span>
                </div>
            </div>

             {/* LOADING PHOTOS SECTION */}
            {data.loadingPhotos && data.loadingPhotos.length > 0 && (
                <div className="mb-8 p-4 bg-slate-50 border-2 border-slate-100 rounded-[2rem]">
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Camera size={14}/> مستندات تصویری بارگیری</h4>
                    <div className="grid grid-cols-4 gap-4">
                        {data.loadingPhotos.slice(0, 4).map((photo, idx) => (
                            <div key={idx} className="aspect-square rounded-2xl overflow-hidden border-2 border-slate-200 bg-white shadow-md">
                                <img src={photo} className="w-full h-full object-cover" alt={`Evidence ${idx}`} />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TRIPLE SIGNATURES */}
            <div className="grid grid-cols-3 gap-8 text-center mt-auto pb-4">
                <div className="space-y-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">تایید انبار</span>
                    <div className="h-40 bg-white border-2 border-dashed border-slate-300 rounded-[2rem] flex items-center justify-center p-4">
                        {docCompany.stamp ? <img src={docCompany.stamp} className="max-h-full max-w-full object-contain" alt="Company Stamp" /> : <Box size={48} className="text-slate-200"/>}
                    </div>
                </div>
                <div className="space-y-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">راننده / مباشر</span>
                    <div className="h-40 bg-white border-2 border-dashed border-slate-300 rounded-[2rem] flex items-center justify-center p-4">
                        {data.supervisorSignature ? <img src={data.supervisorSignature} className="max-h-full max-w-full object-contain" alt="Supervisor Signature" /> : <Truck size={48} className="text-slate-200"/>}
                    </div>
                </div>
                <div className="space-y-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">تحویل‌گیرنده</span>
                    <div className="h-40 bg-white border-2 border-dashed border-slate-300 rounded-[2rem] flex items-center justify-center p-4">
                        {data.signature ? <img src={data.signature} className="max-h-full max-w-full object-contain" alt="Receiver Signature" /> : <UserCheck size={48} className="text-slate-200"/>}
                    </div>
                </div>
            </div>
            
            <div className="text-center pt-4 border-t border-slate-100 flex justify-between items-center">
                <p className="text-[8px] text-slate-400 font-black uppercase tracking-[0.3em]">Ashke Ghalam Logistics Cloud • 1404</p>
                <img src={authQr} className="w-8 h-8 opacity-50" />
            </div>
            <DocumentTrialWatermarkFooter />
        </div>
    );
};

// --- تم اصیل ایرانی حواله انبارداری با نقوش اسلیمی و تذهیب مینیاتوری (Persian Voucher Template) ---
const PersianVoucherTemplate: React.FC<{
    data: Voucher;
    docCompany: any;
    driverQr: string;
    authQr: string;
}> = ({ data, docCompany, driverQr, authQr }) => {
    const [showHelp, setShowHelp] = React.useState(false);

    const isEntry = data.type === 'IN';
    const voucherTypeText = isEntry ? 'حواله ورود به انبار (رسید کالا)' : 'حواله خروج از انبار (تحویل کالا)';
    const totalItems = data.items?.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0) || 0;

    return (
        <div 
            className="invoice-paper sheet-a4-white relative bg-[#fffdf9] min-h-[297mm] h-auto flex flex-col font-sans text-slate-900 p-6 md:p-8 overflow-hidden border-[5px] border-[#b8860b] shadow-2xl"
            dir="rtl"
            style={{ direction: 'rtl', letterSpacing: 'normal' }}
        >
            {/* لچک‌های تذهیب زرین و سرمه‌ای در ۴ گوشه حواله */}
            <div className="absolute top-0 right-0 pointer-events-none z-0 opacity-80">
                <IslimiCornerSvg position="top-right" size={72} />
            </div>
            <div className="absolute top-0 left-0 pointer-events-none z-0 opacity-80">
                <IslimiCornerSvg position="top-left" size={72} />
            </div>
            <div className="absolute bottom-0 right-0 pointer-events-none z-0 opacity-80">
                <IslimiCornerSvg position="bottom-right" size={72} />
            </div>
            <div className="absolute bottom-0 left-0 pointer-events-none z-0 opacity-80">
                <IslimiCornerSvg position="bottom-left" size={72} />
            </div>

            {/* خط حاشیه ظریف تذهیب داخلی */}
            <div className="absolute inset-2 pointer-events-none border border-[#c59b27]/60 rounded-sm z-0">
                <div className="absolute inset-1 border border-dashed border-[#0d9488]/30 rounded-xs" />
            </div>

            {/* دکمه راهنمای هوشمند حواله ایرانی */}
            <div className="absolute top-3 left-3 z-30 no-print">
                <button
                    type="button"
                    onClick={() => setShowHelp(!showHelp)}
                    className="w-7 h-7 rounded-full bg-[#0f172a] text-[#fef08a] hover:bg-[#1e293b] flex items-center justify-center shadow-md border border-[#c59b27] transition-transform active:scale-95"
                    title="راهنمای هوشمند نقوش اسلیمی حواله"
                >
                    <HelpCircle size={15} />
                </button>
            </div>

            {/* پنجره پاپ‌آپ راهنمای هوشمند */}
            {showHelp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 no-print" onClick={() => setShowHelp(false)}>
                    <div className="bg-[#fffdf9] border-2 border-[#b8860b] rounded-3xl max-w-md w-full p-6 text-slate-900 shadow-2xl relative text-right" dir="rtl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-[#e2d7be] pb-3 mb-4">
                            <div className="flex items-center gap-2">
                                <span className="text-[#b8860b] text-lg">❖</span>
                                <h3 className="font-black text-sm text-[#0f172a]">راهنمای حواله اصیل اسلیمی انبارداری</h3>
                            </div>
                            <button onClick={() => setShowHelp(false)} className="text-slate-400 hover:text-slate-700 font-black text-sm">✕</button>
                        </div>
                        <div className="space-y-3 text-xs leading-relaxed text-slate-700">
                            <p className="flex items-start gap-2">
                                <span className="text-[#0d9488] font-bold">۱.</span>
                                <span><strong>جدول‌کشی و تذهیب سنتی:</strong> حاشیه‌ها، کادرها و لچک‌های زرین و سرمه‌ای بدون تداخل با متن.</span>
                            </p>
                            <p className="flex items-start gap-2">
                                <span className="text-[#0d9488] font-bold">۲.</span>
                                <span><strong>چیدمان کاملاً متقارن و مقاوم:</strong> کادرهای تحویل‌گیرنده و ناوگان ترابری بدون تداخل با عرض تفکیک‌شده ۵۰٪.</span>
                            </p>
                            <p className="flex items-start gap-2">
                                <span className="text-[#0d9488] font-bold">۳.</span>
                                <span><strong>تایید چهارگانه اصالت:</strong> مهر انباردار، شمسه هشت‌پر گره‌چینی، امضای راننده و تایید تحویل‌گیرنده نهایی.</span>
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowHelp(false)}
                            className="mt-5 w-full py-2.5 bg-[#0f172a] text-[#fef08a] hover:bg-[#1e293b] rounded-xl font-black text-xs transition-all shadow-md"
                        >
                            متوجه شدم
                        </button>
                    </div>
                </div>
            )}

            {/* واترمرک محو شمسه کانوا در پس‌زمینه حواله */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-90 z-0">
                <PersianWatermarkCanvas opacity={0.032} size={540} />
            </div>

            <div className="relative z-10 flex flex-col flex-1">
                {/* کتیبه سربرگ حواله با نقوش اسلیمی سلطنتی */}
                <PersianHeaderBanner
                    title={docCompany?.name || 'انبار مرکزی و لجستیک اشک قلم'}
                    subtitle={voucherTypeText}
                    code={toPersianDigits(data.trackingCode)}
                    date={toPersianDigits(data.date)}
                    typeBadge={isEntry ? 'ورود به انبار' : 'خروج از انبار'}
                />

                {/* بخش کارت‌های مشخصات بار و تحویل در دو کادر اسلیمی ۵۰٪ متقارن */}
                <div className="w-full flex flex-row gap-3.5 mb-3.5">
                    {/* کارت مشخصات تحویل‌گیرنده / مشتری */}
                    <div className="w-1/2">
                        <PersianCard 
                            title="مشخصات صاحب کالا / تحویل‌گیرنده" 
                            icon={<UserCheck size={15} />}
                            badge={isEntry ? 'تامین‌کننده / مبدأ' : 'مقصد محموله'}
                            className="h-full"
                        >
                            <div className="space-y-1.5 text-xs text-slate-800">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">نام طرف حساب:</span>
                                    <span className="font-bold text-sm text-[#0f172a]">{data.personName}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">تلفن همراه:</span>
                                    <span className="font-mono font-bold text-slate-700">{toPersianDigits(data.receiverPhone || '---')}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">آدرس تحویل:</span>
                                    <span className="text-slate-700 truncate max-w-[200px]">{docCompany?.address || 'انبار مرکزی'}</span>
                                </div>
                            </div>
                        </PersianCard>
                    </div>

                    {/* کارت مشخصات ترابری و لجستیک همراه بارکد راننده */}
                    <div className="w-1/2">
                        <PersianCard 
                            title="اطلاعات ناوگان حمل و لجستیک" 
                            icon={<Truck size={15} />}
                            badge="لجستیک"
                            className="h-full"
                        >
                            <div className="flex justify-between items-center gap-3">
                                <div className="space-y-1.5 text-xs text-slate-800 flex-1">
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500">مباشر / راننده:</span>
                                        <span className="font-bold text-[#0f172a]">{data.supervisor || 'راننده طرف قرارداد'}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500">شماره پلاک:</span>
                                        <span className="font-mono font-bold bg-[#f1f5f9] px-2 py-0.5 rounded border border-slate-300 text-slate-800 text-[11px] dir-ltr">
                                            {data.vehicleNumber || '---'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500">تعداد اقلام:</span>
                                        <span className="font-black text-[#0d9488]">
                                            {toPersianDigits(data.items.length)} ردیف کالا
                                        </span>
                                    </div>
                                </div>
                                <div className="bg-white p-1.5 rounded-lg border border-[#c59b27]/60 shadow-2xs flex flex-col items-center gap-0.5 shrink-0">
                                    <img src={driverQr} className="w-11 h-11 object-contain" alt="QR راننده" />
                                    <span className="text-[7.5px] font-black text-[#0f172a]">اسکن راننده</span>
                                </div>
                            </div>
                        </PersianCard>
                    </div>
                </div>

                {/* جدول اقلام حواله انبارداری به سبک کتیبه لاجوردی و زرین */}
                <div className="mb-3.5 overflow-hidden rounded-xl border-2 border-[#b8860b] shadow-2xs bg-white">
                    <table className="w-full text-right border-collapse text-xs table-auto">
                        <thead>
                            <tr className="bg-[#0f172a] text-[#faf8f2] border-b-2 border-[#b8860b]">
                                <th className="py-2 px-3 text-center font-black w-12">ردیف</th>
                                <th className="py-2 px-3 text-center font-black w-28 bg-[#080d16]">موقعیت انبار (Shelf)</th>
                                <th className="py-2 px-3 font-black">شرح کالا یا قطعات</th>
                                <th className="py-2 px-2 text-center font-black w-24">تعداد / مقدار</th>
                                <th className="py-2 px-2 text-center font-black w-20">واحد</th>
                                <th className="py-2 px-3 text-center font-black w-28">وزن واحد (KG)</th>
                                <th className="py-2 px-3 text-left font-black w-32 bg-[#080d16] text-[#fef08a]">وزن کل (KG)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.items.map((item: any, i: number) => {
                                const isEven = i % 2 === 0;
                                const itemWeightTotal = (Number(item.quantity) || 0) * (Number(item.weight) || 0);
                                return (
                                    <tr 
                                        key={i} 
                                        className={`border-b border-[#e2d7be]/60 transition-colors ${
                                            isEven ? 'bg-[#fffdfa]' : 'bg-[#fcf8ee]/60'
                                        }`}
                                    >
                                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-600">{toPersianDigits(i + 1)}</td>
                                        <td className="py-2 px-3 text-center font-mono font-bold text-[#b45309] bg-[#fffdf0]">
                                            {item.shelfLocation || 'عمومی'}
                                        </td>
                                        <td className="py-2 px-3 font-bold text-slate-900">
                                            <span>{item.productName}</span>
                                            {item.description && (
                                                <span className="block text-[10px] text-slate-500 font-normal mt-0.5">{item.description}</span>
                                            )}
                                        </td>
                                        <td className="py-2 px-2 text-center font-mono font-black text-slate-800 text-sm">
                                            {toPersianDigits(item.quantity)}
                                        </td>
                                        <td className="py-2 px-2 text-center text-[11px] text-slate-600">
                                            {item.unit || 'عدد'}
                                        </td>
                                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-700">
                                            {toPersianDigits(item.weight || 0)}
                                        </td>
                                        <td className="py-2 px-3 text-left font-mono font-black text-[#0f172a] bg-[#fdfaf2]">
                                            {toPersianDigits(itemWeightTotal.toLocaleString())}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="bg-[#fcf8ec] border-t-2 border-[#b8860b] font-black text-xs text-slate-900">
                                <td colSpan={3} className="py-2 px-3 text-left">مجموع محموله:</td>
                                <td className="py-2 px-2 text-center font-mono text-sm text-[#0f172a]">{toPersianDigits(totalItems)}</td>
                                <td></td>
                                <td></td>
                                <td className="py-2 px-3 text-left font-mono text-sm text-[#b45309]">{toPersianDigits((data.totalWeight || 0).toLocaleString())} KG</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* بخش توضیحات انبارداری و ارزش تقریبی محموله */}
                <div className="w-full flex flex-row gap-3.5 mb-3.5 items-stretch">
                    <div className="w-2/3">
                        <PersianCard 
                            title="توضیحات و کنترل کیفی انباردار" 
                            icon={<Scale size={15} />}
                            className="h-full"
                        >
                            <p className="text-xs text-slate-700 leading-relaxed">
                                {data.notes || 'اقلام فوق با نظارت کامل مسئول کنترل کیفیت انبار بارگیری/تخلیه گردیده و از سلامت کامل بسته‌بندی و تعداد منطبق بر حواله برخوردار است.'}
                            </p>
                        </PersianCard>
                    </div>

                    <div className="w-1/3">
                        <div className="h-full bg-gradient-to-br from-[#0f172a] to-[#080d16] border-2 border-[#b8860b] rounded-xl p-3.5 text-white shadow-md flex flex-col justify-center items-center text-center">
                            <span className="text-[10px] text-[#c59b27] font-black uppercase tracking-wider mb-1">ارزش تقریبی محموله</span>
                            <span className="text-lg font-black font-mono text-[#fef08a]">
                                {formatCurrency(data.estimatedValue || 0)}
                            </span>
                            <span className="text-[8.5px] text-slate-300 mt-1">جهت پوشش بیمه ترابری کالا</span>
                        </div>
                    </div>
                </div>

                {/* تصاویر بارگیری در صورت وجود */}
                {data.loadingPhotos && data.loadingPhotos.length > 0 && (
                    <div className="mb-3.5 p-2.5 bg-white border border-[#e2d7be] rounded-xl">
                        <span className="text-[10px] font-black text-[#0f172a] flex items-center gap-1 mb-2">
                            <Camera size={14} className="text-[#c59b27]" /> مستندات تصویری بازرسی و بارگیری
                        </span>
                        <div className="grid grid-cols-4 gap-2.5">
                            {data.loadingPhotos.slice(0, 4).map((photo, idx) => (
                                <div key={idx} className="aspect-video rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                                    <img src={photo} className="w-full h-full object-cover" alt={`سند بارگیری ${idx + 1}`} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* چهار بخش امضای رسمی، نشان اصالت اسلیمی و تاییدیه بار */}
                <div className="mt-auto pt-3 border-t-2 border-[#b8860b] grid grid-cols-4 gap-3 text-center bg-white/70 p-2.5 rounded-xl">
                    {/* تایید انباردار با مهر شرکت */}
                    <div className="border border-[#c59b27]/60 rounded-lg p-2 bg-white min-h-[90px] flex flex-col justify-between shadow-2xs">
                        <div className="h-12 flex items-center justify-center">
                            {docCompany?.stamp && (
                                <img src={docCompany.stamp} className="max-h-full max-w-full object-contain" alt="مهر شرکت" />
                            )}
                        </div>
                        <span className="text-[9.5px] font-black text-[#0f172a]">تایید و مهر انبار مرکزی</span>
                    </div>

                    {/* مهر اصالت اسلیمی */}
                    <div className="border border-[#c59b27]/60 rounded-lg p-1 bg-white flex items-center justify-center shadow-2xs">
                        <PersianHashtiSeal title="اصالت حواله" subtitle="مدیریت انبارداری" code={data.trackingCode} />
                    </div>

                    {/* امضای راننده یا مباشر حمل */}
                    <div className="border border-[#c59b27]/60 rounded-lg p-2 bg-white min-h-[90px] flex flex-col justify-between shadow-2xs">
                        <div className="h-12 flex items-center justify-center">
                            {data.supervisorSignature ? (
                                <img src={data.supervisorSignature} className="max-h-full max-w-full object-contain" alt="امضای راننده" />
                            ) : (
                                <Truck size={30} className="text-slate-300" />
                            )}
                        </div>
                        <span className="text-[9.5px] font-black text-[#0f172a]">امضای راننده / مباشر حمل</span>
                    </div>

                    {/* امضای تحویل‌گیرنده */}
                    <div className="border border-[#c59b27]/60 rounded-lg p-2 bg-white min-h-[90px] flex flex-col justify-between shadow-2xs">
                        <div className="h-12 flex items-center justify-center">
                            {data.signature ? (
                                <img src={data.signature} className="max-h-full max-w-full object-contain" alt="امضای تحویل‌گیرنده" />
                            ) : (
                                <UserCheck size={30} className="text-slate-300" />
                            )}
                        </div>
                        <span className="text-[9.5px] font-black text-[#0f172a]">امضا و اثرانگشت تحویل‌گیرنده</span>
                    </div>
                </div>

                {/* پانویس با کد تایید سامانه */}
                <div className="text-center mt-2 pt-1.5 text-[9px] text-slate-600 flex items-center justify-between border-t border-[#e2d7be]/80">
                    <span className="flex items-center gap-1 font-mono">
                        <span className="text-[#b8860b] text-xs">❖</span>
                        سامانه جامع انبارداری و مدیریت لجستیک اشک قلم • شناسه سند: {data.trackingCode}
                    </span>
                    <img src={authQr} className="w-5 h-5 opacity-70" alt="Auth" />
                </div>
                <DocumentTrialWatermarkFooter />
            </div>
        </div>
    );
};

