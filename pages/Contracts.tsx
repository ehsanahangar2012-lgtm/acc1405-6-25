import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { Contract, ContractType, ContractStatus, ContractItem, Person } from '../types';
import { generateId, toPersianDigits, formatCurrency, getPersianDate, generateTrackingCode, copyToClipboard, getQrCodeUrl } from '../utils';
import { 
  ScrollText, Plus, FileText, Calendar, Trash2, ShieldCheck, PenTool, 
  CheckCircle, Clock, AlertTriangle, Eye, X, PlusCircle, Save, ArrowLeft, Share2, UserPlus,
  Printer, HelpCircle, LayoutGrid, List, Smartphone, User, CheckCircle2, QrCode
} from 'lucide-react';
import { useMobile } from '../useMobile';
import { NumberInput, JalaliDatePicker, FullScreenSignatureModal, ConfirmModal, useKeyboardShortcut } from '../components/Shared';
import { simpleSignatureService } from '../services/simpleSignatureService';
import { hostUrlService } from '../services/hostUrlService';
import { ShareModal } from '../components/ShareModal';

interface CustomTemplate {
    id: string;
    label: string;
    content: string;
}

const CONTRACT_TYPES: { key: ContractType; label: string }[] = [
    { key: 'SERVICE', label: 'خدماتی' },
    { key: 'SALE', label: 'فروش' },
    { key: 'PURCHASE', label: 'خرید' },
    { key: 'EMPLOYMENT', label: 'استخدامی' },
    { key: 'LEASE', label: 'اجاره' },
    { key: 'OTHER', label: 'سایر' }
];

const CONTRACT_STATUSES: { key: ContractStatus; label: string; color: string }[] = [
    { key: 'DRAFT', label: 'پیش‌نویس', color: 'bg-slate-500/20 text-slate-400' },
    { key: 'ACTIVE', label: 'فعال', color: 'bg-emerald-500/20 text-emerald-400' },
    { key: 'COMPLETED', label: 'خاتمه‌یافته', color: 'bg-blue-500/20 text-blue-400' },
    { key: 'CANCELLED', label: 'فسخ‌شده', color: 'bg-rose-500/20 text-rose-400' },
    { key: 'EXPIRED', label: 'منقضی‌شده', color: 'bg-amber-500/20 text-amber-400' }
];

const TEMPLATES = [
  { id: 'none', label: 'سند خام / دستی' },
  { id: 'printing', label: '📄 قرارداد خدمات چاپ و لیتوگرافی' },
  { id: 'box', label: '📦 قرارداد ساخت جعبه مقوایی بسته‌بندی' },
  { id: 'carton', label: '🚚 قرارداد تولید کارتن ۳ و ۵ لایه' },
  { id: 'injection', label: '🔧 قرارداد خدمات تزریق پلاستیک صنعتی' }
];

// Helper to compile placeholders in templates
const compileTemplateText = (templateId: string, vars: Record<string, string>, companyName: string, clientName: string, amount: number) => {
  const formattedAmount = formatCurrency(amount);
  const formattedPrepayment = formatCurrency(Number(vars.prepayment || 0));

  switch (templateId) {
    case 'printing':
      return `ماده ۱: طرفین قرارداد
این قرارداد فی‌مابین شرکت ${companyName} به عنوان کارفرما از یک سو و جناب آقای/شرکت ${clientName} به عنوان پیمانکار از سوی دیگر، طبق ماده ۱۰ قانون مدنی منعقد گردیده و طرفین ملزم به اجرای مفاد آن می‌باشند.

ماده ۲: موضوع قرارداد
ارائه خدمات لیتوگرافی، تهیه زینک، چاپ و روکش ورقه‌های چاپی با مشخصات فنی زیر:
- تیراژ کل سفارش: ${toPersianDigits(vars.circulation || '---')} نسخه
- نوع کاغذ/مقوای مصرفی: ${vars.paperType || '---'}
- تعداد رنگ‌های تفکیکی: ${toPersianDigits(vars.colors || '---')} رنگ
- نوع سلفون/روکش حفاظتی: ${vars.coating || '---'}
- نوع صحافی نهایی: ${vars.binding || '---'}

ماده ۳: مبلغ کل و نحوه تسویه
ارزش کل تعهدات این قرارداد برابر با ${formattedAmount} تعیین می‌گردد. کارفرما متعهد است مبلغ ${formattedPrepayment} به عنوان پیش‌پرداخت اولیه جهت تامین زینک و کاغذ و مابقی را طبق شرایط اقساط و پیشرفت کار تسویه نماید.

ماده ۴: تعهدات پیمانکار (مجری چاپ)
۱. پیمانکار موظف است قبل از شروع چاپ نهایی، یک نسخه نمونه دیجیتال (پروف) به تایید کارفرما برساند. مسئولیت هرگونه اختلاف رنگ فاحش با نمونه تایید شده بر عهده پیمانکار است.
۲. درصد باطله مجاز کاغذ در فرآیند چاپ حداکثر ۳٪ بوده و پیمانکار ضامن جبران خسارت مازاد بر آن می‌باشد.
۳. کلیه فایل‌ها و حقوق معنوی طرح‌های ارائه شده متعلق به کارفرما بوده و پیمانکار حق انتشار یا واگذاری آن به غیر را ندارد.

ماده ۵: شرایط تحویل و خسارت تاخیر
تحویل موضوع قرارداد در محل کارفرما صورت می‌گیرد. به ازای هر روز تاخیر غیرمجاز در تحویل، مبلغ ۵٪ از ارزش کل قرارداد به عنوان وجه التزام و خسارت تاخیر کسر خواهد شد.

ماده ۶: فورس ماژور و حل اختلاف
در صورت بروز حوادث غیرمترقبه خارج از کنترل طرفین، تعهدات موقتاً به حالت تعلیق درمی‌آید. کلیه اختلافات ناشی از این قرارداد در وهله اول از طریق مذاکره و در صورت عدم حصول نتیجه، از طریق مراجع داوری اتحادیه چاپخانه‌داران تهران یا مراجع قضایی ذی‌صلاح حل و فصل خواهد شد.`;

    case 'box':
      return `ماده ۱: طرفین قرارداد
این قرارداد بر اساس ماده ۱۰ قانون مدنی فی‌مابین شرکت ${companyName} به عنوان کارفرما و جناب آقای/شرکت ${clientName} به عنوان پیمانکار جهت تولید جعبه‌های بسته‌بندی مقوایی منعقد می‌گردد.

ماده ۲: موضوع قرارداد
طراحی ساختار جعبه، تهیه زینک و کلیشه، چاپ، روکش، دایکات و جعبه‌چسبانی با مشخصات فنی زیر:
- ابعاد گسترده یا نهایی جعبه: ${vars.dimensions || '---'} سانتی‌متر
- نوع مقوای مصرفی: ${vars.boxPaperType || '---'}
- گرماژ مقوا (وزن پایه): ${toPersianDigits(vars.paperWeight || '---')} گرم
- نوع قالب‌زنی و تیغ دایکات: ${vars.dieCut || '---'}
- روکش نهایی جعبه: ${vars.boxCoating || '---'}

ماده ۳: ارزش قرارداد و شرایط پرداخت
مبلغ کل تولید جعبه‌ها برابر با ${formattedAmount} توافق گردید. کارفرما متعهد به پرداخت پیش‌پرداخت به مبلغ ${formattedPrepayment} همزمان با تایید نهایی ماکت فیزیکی جعبه بوده و تسویه نهایی هنگام تحویل محموله صورت می‌پذیرد.

ماده ۴: تعهدات پیمانکار (جعبه‌سازی)
۱. پیمانکار متعهد است مقواها را از نوع بهداشتی و با سختی مناسب جهت بسته‌بندی محصولات کارفرما تهیه نماید.
۲. چسب مصرفی در خط جعبه‌چسبانی باید از نوع سرد/گرم باکیفیت و بدون بو باشد تا در زمان انبارداری طولانی مدت باز نشود.
۳. تلرانس ابعاد دایکات حداکثر ۰.۵ میلی‌متر بوده و پیمانکار متعهد به انطباق دقیق لبه‌های جعبه می‌باشد.

ماده ۵: تحویل و کنترل کیفیت
مبنای پذیرش محموله، نمونه فیزیکی تایید شده توسط کارفرما است. کارفرما حق دارد تا ۴۸ ساعت پس از تحویل، اقلام معیوب یا ناخوانا را جهت مرجوعی و تولید مجدد به هزینه پیمانکار اعلام دارد.

ماده ۶: خسارات و قانون حاکم
این قرارداد تابع قوانین جمهوری اسلامی ایران است. هرگونه تاخیر در تحویل محموله فراتر از مدت زمان مجاز توافق شده، مشمول خسارت تاخیر روزانه به میزان ۱٪ از مبلغ کل سفارش خواهد بود که از مطالبات پیمانکار کسر می‌گردد.`;

    case 'carton':
      return `ماده ۱: طرفین قرارداد
این قرارداد فی‌مابین شرکت ${companyName} به عنوان سفارش‌دهنده (کارفرما) و جناب آقای/شرکت ${clientName} به عنوان تولیدکننده (پیمانکار) جهت تولید و تامین کارتن‌های بسته‌بندی منعقد می‌گردد.

ماده ۲: موضوع قرارداد
تولید کارتن‌های ورقه‌ای ضربه‌گیر چندلایه با مشخصات فنی زیر:
- ابعاد کارتن (طول * عرض * ارتفاع): ${vars.cartonDimensions || '---'} سانتی‌متر
- نوع کنگره و فلوت ورق: ورق ${vars.fluteType || '---'} فلوت
- تیراژ سفارش: ${toPersianDigits(vars.cartonCirculation || '---')} عدد
- روش چاپ روی کارتن: چاپ ${vars.cartonPrintType || '---'}

ماده ۳: مبالغ و تسویه مالی
مجموع ارزش سفارش برابر با ${formattedAmount} توافق گردید. کارفرما متعهد است طبق اقساط ماده ۵ مبلغ را پرداخت نموده و تسویه نهایی پس از تحویل در محل کارفرما و تایید کیفیت فیزیکی کارتن‌ها صورت خواهد گرفت.

ماده ۴: تعهدات پیمانکار (کارتن‌سازی)
۱. پیمانکار متعهد است لایه خارجی کارتن را از کاغذ باکیفیت (کرافت یا تست لاینر) و لایه‌های کنگره را از فلوتینگ درجه یک جهت مقاومت در برابر فشار عمودی و رطوبت انبارداری تهیه کند.
۲. کلیشه‌های چاپ ژلاتینی باید با تراکم بالا تهیه شده و ثبت رنگ‌ها بدون جابجایی صورت گیرد.
۳. کارتن‌ها باید به صورت تسمه‌کشی شده و روی پالت‌های استاندارد تحویل کارفرما گردند.

ماده ۵: تاخیرات و حل اختلاف
۱. به ازای هر روز تاخیر پیمانکار در ارائه کل سفارش، جریمه دیرکرد معادل ۱.۵٪ ارزش کارتن‌های تحویل‌نشده اعمال خواهد شد.
۲. کلیه دعاوی ناشی از کیفیت ورق، گرماژ و عدم مقاومت فشاری کارتن‌ها توسط کارشناس رسمی دادگستری بررسی شده و نظر ایشان برای طرفین لازم‌الاجرا است.`;

    case 'injection':
      return `ماده ۱: طرفین قرارداد
این قرارداد بر اساس ماده ۱۰ قانون مدنی فی‌مابین شرکت ${companyName} به عنوان کارفرما و جناب آقای/شرکت ${clientName} به عنوان مجری خدمات تزریق پلاستیک منعقد می‌گردد.

ماده ۲: موضوع قرارداد
ارائه خدمات تولید قطعات پلیمری با ماشین‌آلات تزریق پلاستیک صنعتی به شرح مشخصات فنی زیر:
- نوع پلیمر و مواد اولیه: پلاستیک ${vars.plasticMaterial || '---'}
- وزن خالص قطعه تزریقی: ${toPersianDigits(vars.partWeight || '---')} گرم
- تعداد حفره قالب (کویتی): ${toPersianDigits(vars.moldCavities || '---')} حفره
- مالکیت و مسئولیت قالب: قالب متعلق به ${vars.moldOwnership || '---'} می‌باشد
- مسئول تامین مواد اولیه: ${vars.materialProvider || '---'}

ماده ۳: مبلغ و هزینه تولید
مبلغ کل سقف تعهدات قرارداد برابر با ${formattedAmount} توافق گردید. مبنای محاسبه هزینه تولید هر ضرب تزریق برابر با ${toPersianDigits(Number(vars.strikePrice || 0).toLocaleString())} ریال خواهد بود که در دوره‌های زمانی مشخص فاکتور می‌گردد.

ماده ۴: تعهدات مجری تزریق پلاستیک
۱. مجری متعهد به نگهداری صحیح، روان‌کاری منظم و اورهال قالب کارفرما در طول دوره تولید است. هرگونه آسیب ناشی از غفلت اپراتور یا تنظیم نامناسب دستگاه بر عهده مجری خواهد بود.
۲. درصد ضایعات مجاز در صورت تامین مواد توسط کارفرما حداکثر ۲٪ وزن کل مواد ورودی است و مقادیر مازاد بر آن توسط مجری جبران می‌شود.
۳. قطعات تولید شده باید کاملا عاری از عیوبی نظیر مکش (سینک)، پلیسه (فلاش)، تاب‌برداشتگی و نواقص پرشدگی باشند.

ماده ۵: شرایط نگهداری قالب و ترخیص قطعات
قالب کارفرما تا انتهای تولید امانت نزد مجری بوده و پس از تسویه حساب نهایی مالی، بلافاصله تحویل کارفرما خواهد شد. مجری حق حبس یا وثیقه‌گذاری قالب را تحت هیچ شرایطی نخواهد داشت.

ماده ۶: حل اختلاف و مراجع قانونی
در صورت بروز هرگونه اختلاف فنی در خصوص کیفیت قطعات یا سایش قالب، موضوع به کارشناس فنی مرضی‌الطرفین ارجاع داده شده و رای وی قطعی و برای طرفین لازم‌الاتباع است.`;

    default:
      return '';
  }
};

const Contracts: React.FC = () => {
    const { contracts, people, addContract, deleteContract, updateContract, setContractSignature, companies, addPerson } = useStore();
    
    const [view, setView] = useState<'list' | 'preview' | 'create'>('list');
    const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [showSignaturePad, setShowSignaturePad] = useState(false);
    const [signRole, setSignRole] = useState<'person' | 'company'>('person');

    // Mobile-optimized States
    const { isMobile } = useMobile();
    const [viewMode, setViewMode] = useState<'cards' | 'table'>(() => window.innerWidth < 768 ? 'cards' : 'table');
    const [activeMobileContractId, setActiveMobileContractId] = useState<string | null>(null);
    const [showSmartGuide, setShowSmartGuide] = useState(false);
    const [showMobileSignMenu, setShowMobileSignMenu] = useState(false);

    // Quick Add Person States
    const [showAddPersonModal, setShowAddPersonModal] = useState(false);
    const [newPersonName, setNewPersonName] = useState('');
    const [newPersonPhone, setNewPersonPhone] = useState('');

    const handleQuickAddPerson = () => {
        if (!newPersonName.trim()) return;
        const id = generateId();
        const nextCode = String(people.length + 1001);
        addPerson({
            id,
            name: newPersonName,
            phone: newPersonPhone,
            balance: 0,
            code: nextCode,
            category: 'طرف قرارداد',
            isCustomer: true,
        } as any);
        setPersonId(id);
        setNewPersonName('');
        setNewPersonPhone('');
        setShowAddPersonModal(false);
    };

    // Form states
    const [title, setTitle] = useState('');
    const [type, setType] = useState<ContractType>('SERVICE');
    const [status, setStatus] = useState<ContractStatus>('DRAFT');
    const [personId, setPersonId] = useState('');
    const [startDate, setStartDate] = useState(getPersianDate());
    const [endDate, setEndDate] = useState(getPersianDate());
    const [totalAmount, setTotalAmount] = useState(0);
    const [description, setDescription] = useState('');
    const [items, setItems] = useState<ContractItem[]>([]);
    
    // Templates States
    const [selectedTemplate, setSelectedTemplate] = useState<string>('none');
    const [templateVars, setTemplateVars] = useState<Record<string, string>>({});
    
    // Custom Templates States
    const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>(() => {
        try {
            const saved = localStorage.getItem('custom_contract_templates');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });
    const [showTemplateModal, setShowTemplateModal] = useState(false);

    // همگام‌سازی آنی امضاهای از راه دور در زمان باز بودن پیش‌نمایش قرارداد
    useEffect(() => {
        if (view !== 'preview') return;
        
        // همگام‌سازی بلافاصله با ورود به پیش‌نمایش
        simpleSignatureService.syncSignedRequests();
        
        // همگام‌سازی دوره‌ای هر ۸ ثانیه
        const pollTimer = setInterval(() => {
            simpleSignatureService.syncSignedRequests();
        }, 8000);
        
        return () => clearInterval(pollTimer);
    }, [view]);
    const [newTemplateLabel, setNewTemplateLabel] = useState('');
    const [newTemplateContent, setNewTemplateContent] = useState('');
    const [showShareModal, setShowShareModal] = useState(false);
    const [sharePreviewData, setSharePreviewData] = useState('');
    const [shareContractId, setShareContractId] = useState('');

    const templateEditorRef = useRef<HTMLTextAreaElement>(null);

    const insertVariable = (varName: string) => {
        const textarea = templateEditorRef.current;
        if (!textarea) return;
        const startPos = textarea.selectionStart;
        const endPos = textarea.selectionEnd;
        const text = textarea.value;
        const placeholder = `{{${varName}}}`;
        const newText = text.substring(0, startPos) + placeholder + text.substring(endPos);
        setNewTemplateContent(newText);
        setTimeout(() => {
            textarea.focus();
            textarea.selectionStart = textarea.selectionEnd = startPos + placeholder.length;
        }, 50);
    };

    const handleLoadSample = () => {
        const sample = `ماده ۱: طرفین قرارداد
این قرارداد همکاری فی‌مابین شرکت {{نام_کارفرما}} به شناسه ملی {{شناسه_ملی_کارفرما}} به نمایندگی جناب آقای {{نماینده_کارفرما}} به عنوان کارفرما از یک سو و جناب آقای/سرکار خانم {{نام_پیمانکار}} به شماره ملی {{کد_ملی_پیمانکار}} به عنوان پیمانکار از سوی دیگر، طبق ماده ۱۰ قانون مدنی منعقد گردیده و طرفین ملزم به اجرای مفاد آن می‌باشند.

ماده ۲: موضوع قرارداد
ارائه خدمات تخصصی در زمینه {{موضوع_قرارداد}} شامل پیاده‌سازی، خطایابی و تحویل فازهای مربوطه بر اساس مشخصات توافق شده.

ماده ۳: مدت قرارداد
مدت اجرای موضوع این قرارداد از تاریخ {{تاریخ_شروع}} لغایت {{تاریخ_پایان}} به مدت {{مدت_قرارداد}} تعیین می‌گردد.

ماده ۴: مبلغ قرارداد و نحوه تسویه
ارزش کل این قرارداد برابر با {{مبلغ_کل_قرارداد}} ریال توافق گردید که پس از تایید هر فاز توسط کارفرما و ارائه صورت‌حساب به شرح زیر تسویه می‌شود:
۱. پیش‌پرداخت: مبلغ {{مبلغ_پیش_پرداخت}} ریال پس از امضای قرارداد.
۲. تسویه نهایی: مبلغ {{مبلغ_تسویه_نهایی}} ریال پس از تحویل نهایی موضوع قرارداد.

ماده ۵: جریمه تاخیر و تعهدات طرفین
۱. پیمانکار متعهد است که موضوع قرارداد را در زمان‌های مقرر انجام داده و تحویل نماید. به ازای هر روز تاخیر غیرمجاز، جریمه دیرکرد روزانه به میزان {{جریمه_تاخیر_روزانه}} ریال از مطالبات نهایی کسر خواهد شد.
۲. کلیه اطلاعات فنی و تجاری رد و بدل شده محرمانه بوده و طرفین حق افشای آن را ندارند.`;
        setNewTemplateContent(sample);
        if (!newTemplateLabel.trim()) {
            setNewTemplateLabel('قرارداد همکاری فریلنسری پیش‌فرض');
        }
    };

    const liveExtractedVars = useMemo(() => {
        const regex = /{{(.*?)}}/g;
        const vars: string[] = [];
        let match;
        while ((match = regex.exec(newTemplateContent)) !== null) {
            const v = match[1].trim();
            if (v && !vars.includes(v)) {
                vars.push(v);
            }
        }
        return vars;
    }, [newTemplateContent]);
    
    // Add item states
    const [itemDesc, setItemDesc] = useState('');
    const [itemAmount, setItemAmount] = useState(0);
    const [itemDueDate, setItemDueDate] = useState(getPersianDate());

    const handleSaveCustomTemplate = () => {
        if (!newTemplateLabel.trim() || !newTemplateContent.trim()) {
            return alert('لطفا نام قالب و متن قرارداد را وارد نمایید.');
        }
        const newTpl = {
            id: 'custom_' + generateId(),
            label: newTemplateLabel.trim(),
            content: newTemplateContent.trim()
        };
        const updated = [...customTemplates, newTpl];
        setCustomTemplates(updated);
        localStorage.setItem('custom_contract_templates', JSON.stringify(updated));
        setNewTemplateLabel('');
        setNewTemplateContent('');
        alert('قالب جدید با موفقیت ذخیره شد.');
    };

    const handleDeleteCustomTemplate = (id: string) => {
        if (confirm('آیا از حذف این قالب اطمینان دارید؟')) {
            const updated = customTemplates.filter(t => t.id !== id);
            setCustomTemplates(updated);
            localStorage.setItem('custom_contract_templates', JSON.stringify(updated));
        }
    };

    const parsedCustomVars = useMemo(() => {
        if (!selectedTemplate.startsWith('custom_')) return [];
        const activeTpl = customTemplates.find(t => t.id === selectedTemplate);
        if (!activeTpl) return [];
        
        const regex = /{{(.*?)}}/g;
        const vars: string[] = [];
        let match;
        while ((match = regex.exec(activeTpl.content)) !== null) {
            const v = match[1].trim();
            if (!vars.includes(v)) {
                vars.push(v);
            }
        }
        return vars;
    }, [selectedTemplate, customTemplates]);

    const resetForm = () => {
        setTitle('');
        setType('SERVICE');
        setStatus('DRAFT');
        setPersonId('');
        setStartDate(getPersianDate());
        setEndDate(getPersianDate());
        setTotalAmount(0);
        setDescription('');
        setItems([]);
        setItemDesc('');
        setItemAmount(0);
        setItemDueDate(getPersianDate());
        setSelectedTemplate('none');
        setTemplateVars({});
        setView('list');
        setSelectedContractId(null);
    };

    const handleVarChange = (key: string, val: string) => {
      setTemplateVars(prev => ({ ...prev, [key]: val }));
    };

    const handleAddItem = () => {
        if (!itemDesc || itemAmount <= 0) return alert('شرح و مبلغ تعهد الزامی است.');
        setItems([...items, {
            id: generateId(),
            description: itemDesc,
            amount: itemAmount,
            dueDate: itemDueDate,
            isPaid: false
        }]);
        setItemDesc('');
        setItemAmount(0);
        setItemDueDate(getPersianDate());
    };

    const handleRemoveItem = (id: string) => {
        setItems(items.filter(item => item.id !== id));
    };

    const handleSaveContract = () => {
        if (!title || !personId || totalAmount <= 0) {
            return alert('عنوان، طرف حساب و مبلغ کل قرارداد الزامی است.');
        }
        const person = people.find(p => p.id === personId);
        const activeComp = companies.find(c => c.isActive) || companies[0];

        const contractNum = contracts.length + 1001;
        
        let compiledText = '';
        if (selectedTemplate !== 'none') {
            if (selectedTemplate.startsWith('custom_')) {
                const activeTpl = customTemplates.find(t => t.id === selectedTemplate);
                if (activeTpl) {
                    compiledText = activeTpl.content;
                    parsedCustomVars.forEach(v => {
                        const val = templateVars[v] || '---';
                        compiledText = compiledText.replace(new RegExp(`{{${v}}}`, 'g'), val);
                    });
                }
            } else {
                compiledText = compileTemplateText(selectedTemplate, templateVars, activeComp?.name || 'اشک قلم', person?.name || 'ناشناس', totalAmount);
            }
        }
        
        // Compile description as JSON if template is selected, else raw string
        const finalDescription = selectedTemplate !== 'none' 
          ? JSON.stringify({
              isTemplate: true,
              templateId: selectedTemplate,
              variables: templateVars,
              compiledText: compiledText
            }) 
          : description;

        const newContract: Contract = {
            id: generateId(),
            companyId: activeComp?.id || 'default',
            number: contractNum,
            title,
            type,
            status,
            personId,
            personName: person?.name || 'ناشناس',
            startDate,
            endDate,
            totalAmount,
            description: finalDescription,
            items,
            trackingCode: generateTrackingCode('CON', contractNum, startDate),
            createdAt: getPersianDate()
        };

        addContract(newContract);
        resetForm();
    };

    const selectedContract = useMemo(() => {
        return contracts.find(c => c.id === selectedContractId);
    }, [contracts, selectedContractId]);

    const previewCompany = useMemo(() => {
        if (!selectedContract) return null;
        return companies.find(c => c.id === selectedContract.companyId) || companies.find(c => c.isActive) || companies[0];
    }, [selectedContract, companies]);

    const previewPerson = useMemo(() => {
        if (!selectedContract) return null;
        return people.find(p => p.id === selectedContract.personId) || null;
    }, [selectedContract, people]);

    // Parse template description if it is stored in JSON
    const parsedContractDescription = useMemo(() => {
      if (!selectedContract || !selectedContract.description) return null;
      if (selectedContract.description.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(selectedContract.description);
          if (parsed.isTemplate) return parsed;
        } catch {}
      }
      return null;
    }, [selectedContract]);

    const handleShareContract = async (contract: Contract) => {
      try {
        const person = people.find(p => p.id === contract.personId);
        const activeComp = companies.find(c => c.id === contract.companyId) || companies.find(c => c.isActive) || companies[0];
        const fullDoc = { ...contract, person, company: activeComp, type: 'contract' };
        setShareContractId(contract.id);
        setSharePreviewData(JSON.stringify(fullDoc));
        setShowShareModal(true);
      } catch (err) {
        console.error('Error preparing signature request:', err);
        alert('خطا در آماده‌سازی درخواست امضا.');
      }
    };

    // Statistics
    const stats = useMemo(() => {
        const total = contracts.length;
        const active = contracts.filter(c => c.status === 'ACTIVE').length;
        const drafts = contracts.filter(c => c.status === 'DRAFT').length;
        const totalVal = contracts.reduce((sum, c) => sum + c.totalAmount, 0);
        return { total, active, drafts, totalVal };
    }, [contracts]);

    const getStatusDetails = (s: ContractStatus) => {
        return CONTRACT_STATUSES.find(cs => cs.key === s) || { label: s, color: 'bg-white/5 text-white' };
    };

    const getTypeLabel = (t: ContractType) => {
        return CONTRACT_TYPES.find(ct => ct.key === t)?.label || t;
    };

    useKeyboardShortcut(['Alt', 'N'], () => { if(view === 'list') setView('create'); });
    useKeyboardShortcut(['Alt', 'S'], () => { if(view === 'create') handleSaveContract(); });
    useKeyboardShortcut(['Escape'], () => { resetForm(); });

    return (
        <div className="space-y-8 animate-fade-in pb-20" dir="rtl">
            {view === 'list' && (
                <>
                    <header className="flex flex-col md:flex-row justify-between items-center bg-slate-900/40 p-5 md:p-8 rounded-[2.5rem] border border-white/5 shadow-2xl gap-4">
                        <div className="flex items-center justify-between w-full md:w-auto">
                            <div>
                                <h1 className="text-xl md:text-3xl font-black text-white flex items-center gap-3">
                                    <ScrollText className="text-indigo-400" /> مدیریت قراردادها
                                </h1>
                                <p className="text-slate-400 text-xs mt-1 font-bold">ثبت، مانیتورینگ اقساط و امضای دیجیتال قراردادهای تجاری</p>
                            </div>

                            {/* Mobile Smart Guide Button */}
                            <button
                                onClick={() => setShowSmartGuide(true)}
                                className="md:hidden w-10 h-10 rounded-2xl bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-400 flex items-center justify-center transition-all active:scale-90 shrink-0"
                                title="راهنمای هوشمند قراردادها"
                            >
                                <HelpCircle size={20} />
                            </button>
                        </div>

                        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                            {/* View Mode Toggle */}
                            <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-white/10">
                                <button
                                    onClick={() => setViewMode('cards')}
                                    className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all ${
                                        viewMode === 'cards'
                                            ? 'bg-teal-600 text-white shadow-lg'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                    title="نمای کارتی فشرده"
                                >
                                    <LayoutGrid size={15} />
                                    <span>کارت‌ها</span>
                                </button>
                                <button
                                    onClick={() => setViewMode('table')}
                                    className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all ${
                                        viewMode === 'table'
                                            ? 'bg-teal-600 text-white shadow-lg'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                    title="نمای جدولی"
                                >
                                    <List size={15} />
                                    <span>جدول</span>
                                </button>
                            </div>

                            {/* Desktop Smart Guide */}
                            <button
                                onClick={() => setShowSmartGuide(true)}
                                className="hidden md:flex w-12 h-12 rounded-2xl bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-400 items-center justify-center transition-all active:scale-90 shrink-0"
                                title="راهنمای هوشمند قراردادها"
                            >
                                <HelpCircle size={22} />
                            </button>

                            <button onClick={() => setView('create')} className="flex-1 md:flex-none bg-teal-600 hover:bg-teal-500 text-white px-6 md:px-8 py-3.5 md:py-4 rounded-2xl flex items-center justify-center gap-2 md:gap-3 font-black shadow-xl active:scale-95 text-xs md:text-base" title="قرارداد جدید (Alt+N)">
                                <Plus size={20} /> ایجاد قرارداد
                            </button>
                        </div>
                    </header>

                    {/* Stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                        <div className="bg-slate-900/60 backdrop-blur-md p-4 md:p-6 rounded-[2rem] border border-white/5 shadow-xl flex flex-col justify-between">
                            <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest block mb-1">کل قراردادها</span>
                            <span className="text-2xl md:text-3xl font-black text-white font-mono">{toPersianDigits(stats.total.toString())}</span>
                        </div>
                        <div className="bg-slate-900/60 backdrop-blur-md p-4 md:p-6 rounded-[2rem] border border-white/5 shadow-xl flex flex-col justify-between">
                            <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest block mb-1">قراردادهای فعال</span>
                            <span className="text-2xl md:text-3xl font-black text-emerald-400 font-mono">{toPersianDigits(stats.active.toString())}</span>
                        </div>
                        <div className="bg-slate-900/60 backdrop-blur-md p-4 md:p-6 rounded-[2rem] border border-white/5 shadow-xl flex flex-col justify-between">
                            <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest block mb-1">پیش‌نویس‌ها</span>
                            <span className="text-2xl md:text-3xl font-black text-slate-400 font-mono">{toPersianDigits(stats.drafts.toString())}</span>
                        </div>
                        <div className="bg-slate-900/60 backdrop-blur-md p-4 md:p-6 rounded-[2rem] border border-white/5 shadow-xl flex flex-col justify-between">
                            <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest block mb-1">ارزش کل قراردادها</span>
                            <span className="text-lg md:text-2xl font-black text-indigo-400 font-mono tracking-tighter truncate">{formatCurrency(stats.totalVal)}</span>
                        </div>
                    </div>

                    {/* COMPACT CARDS VIEW (Mobile-friendly & Desktop Responsive) */}
                    {(viewMode === 'cards' || isMobile) ? (
                        <div className="space-y-4 pb-28 md:pb-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
                                {contracts.map(c => {
                                    const statusDetails = getStatusDetails(c.status);
                                    const isSelected = (activeMobileContractId || contracts[0]?.id) === c.id;
                                    const hasPersonSig = !!c.signature;
                                    const hasCompanySig = !!c.companySignature;

                                    return (
                                        <div
                                            key={c.id}
                                            onClick={() => setActiveMobileContractId(c.id)}
                                            className={`bg-slate-900/80 border-2 rounded-3xl p-4 md:p-5 transition-all cursor-pointer relative shadow-xl ${
                                                isSelected 
                                                    ? 'border-teal-500/80 bg-slate-900/95 ring-2 ring-teal-500/20 shadow-teal-500/10 scale-[1.01]' 
                                                    : 'border-white/10 hover:border-white/20'
                                            }`}
                                        >
                                            {/* Top Row: Title, Type and Status Badge */}
                                            <div className="flex items-start justify-between gap-2 mb-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-black text-white text-sm md:text-base truncate">{c.title}</h3>
                                                        <span className="text-[10px] px-2 py-0.5 rounded-lg font-bold bg-white/5 text-slate-300 shrink-0">
                                                            {getTypeLabel(c.type)}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[11px] text-slate-400 flex items-center gap-1 truncate">
                                                            <User size={13} className="text-indigo-400 shrink-0" />
                                                            <span className="font-bold text-white">{c.personName}</span>
                                                        </span>
                                                    </div>
                                                </div>

                                                <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black shrink-0 ${statusDetails.color}`}>
                                                    {statusDetails.label}
                                                </span>
                                            </div>

                                            {/* Middle Row: Amount & Tracking */}
                                            <div className="bg-slate-950/80 border border-white/5 rounded-2xl p-3 mb-3 flex items-center justify-between">
                                                <div>
                                                    <span className="text-[9px] text-slate-500 font-bold block mb-0.5">مبلغ کل قرارداد</span>
                                                    <span className="text-base font-black font-mono text-teal-400">{formatCurrency(c.totalAmount)}</span>
                                                </div>
                                                <div className="text-left">
                                                    <span className="text-[9px] text-slate-500 font-bold block mb-0.5">کد رهگیری</span>
                                                    <span className="text-xs font-mono text-indigo-400 font-black">{toPersianDigits(c.trackingCode)}</span>
                                                </div>
                                            </div>

                                            {/* Signatures & Dates Status */}
                                            <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                                                        hasPersonSig ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-500'
                                                    }`}>
                                                        <PenTool size={10} /> {hasPersonSig ? 'امضای خریدار ✓' : 'بدون امضا'}
                                                    </span>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                                                        hasCompanySig ? 'bg-teal-500/20 text-teal-400' : 'bg-white/5 text-slate-500'
                                                    }`}>
                                                        <ShieldCheck size={10} /> {hasCompanySig ? 'امضای شرکت ✓' : 'بدون مهر'}
                                                    </span>
                                                </div>

                                                <span className="text-[10px] text-slate-500 font-mono font-bold">
                                                    {toPersianDigits(c.startDate)}
                                                </span>
                                            </div>

                                            {/* Direct Action Buttons for Cards */}
                                            <div className="flex items-center justify-end gap-1.5 mt-3 pt-2.5 border-t border-white/5">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedContractId(c.id);
                                                        setView('preview');
                                                    }}
                                                    className="p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-600 hover:text-white rounded-xl transition-all"
                                                    title="مشاهده و پیش‌نمایش"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedContractId(c.id);
                                                        setSignRole('person');
                                                        setShowSignaturePad(true);
                                                    }}
                                                    className="p-2 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-xl transition-all"
                                                    title="امضای قرارداد"
                                                >
                                                    <PenTool size={16} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedContractId(c.id);
                                                        setView('preview');
                                                        setTimeout(() => window.print(), 300);
                                                    }}
                                                    className="p-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-xl transition-all"
                                                    title="چاپ فوری"
                                                >
                                                    <Printer size={16} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleShareContract(c);
                                                    }}
                                                    className="p-2 bg-white/5 text-slate-300 hover:bg-white/10 rounded-xl transition-all"
                                                    title="اشتراک‌گذاری"
                                                >
                                                    <Share2 size={16} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDeleteTarget(c.id);
                                                    }}
                                                    className="p-2 bg-rose-500/10 text-rose-400 hover:bg-rose-600 hover:text-white rounded-xl transition-all"
                                                    title="حذف قرارداد"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}

                                {contracts.length === 0 && (
                                    <div className="col-span-full py-16 text-center border-2 border-dashed border-white/10 rounded-3xl space-y-3">
                                        <ScrollText size={48} className="mx-auto text-slate-600" />
                                        <p className="text-sm text-slate-400 font-bold">هیچ قراردادی ثبت نشده است.</p>
                                        <button onClick={() => setView('create')} className="bg-teal-600 text-white px-6 py-3 rounded-2xl font-black text-xs shadow-lg">
                                            + ثبت اولین قرارداد
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* MOBILE BOTTOM STICKY ACTION BAR */}
                            {contracts.length > 0 && (
                                <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0d1527]/95 backdrop-blur-xl border-t border-white/10 p-3 shadow-[0_-8px_32px_rgba(0,0,0,0.6)] md:hidden">
                                    {(() => {
                                        const currentContract = contracts.find(c => c.id === (activeMobileContractId || contracts[0]?.id)) || contracts[0];
                                        return (
                                            <div className="max-w-md mx-auto space-y-2">
                                                {/* Selected contract quick label */}
                                                <div className="flex items-center justify-between px-1 text-[11px]">
                                                    <span className="text-slate-400 font-bold truncate max-w-[180px]">
                                                        قرارداد: <strong className="text-white">{currentContract.title}</strong>
                                                    </span>
                                                    <span className="text-teal-400 font-mono font-black">
                                                        {formatCurrency(currentContract.totalAmount)}
                                                    </span>
                                                </div>

                                                {/* Action Buttons Row with easy thumb reach */}
                                                <div className="grid grid-cols-4 gap-2">
                                                    {/* Sign Button with Popup */}
                                                    <div className="relative">
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowMobileSignMenu(!showMobileSignMenu)}
                                                            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-black text-xs shadow-lg flex flex-col items-center justify-center gap-1 active:scale-95"
                                                        >
                                                            <PenTool size={18} />
                                                            <span>امضا</span>
                                                        </button>

                                                        {showMobileSignMenu && (
                                                            <div className="absolute bottom-full mb-2 right-0 left-0 bg-slate-900 border border-indigo-500/30 rounded-2xl p-2 shadow-2xl space-y-1.5 z-50 text-right">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setSelectedContractId(currentContract.id);
                                                                        setSignRole('person');
                                                                        setShowSignaturePad(true);
                                                                        setShowMobileSignMenu(false);
                                                                    }}
                                                                    className="w-full text-right p-2 text-xs font-bold text-white hover:bg-white/10 rounded-xl"
                                                                >
                                                                    ✍️ امضای طرف دوم (خریدار)
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setSelectedContractId(currentContract.id);
                                                                        setSignRole('company');
                                                                        setShowSignaturePad(true);
                                                                        setShowMobileSignMenu(false);
                                                                    }}
                                                                    className="w-full text-right p-2 text-xs font-bold text-teal-400 hover:bg-white/10 rounded-xl border-t border-white/5"
                                                                >
                                                                    🛡️ امضای شرکت (کارفرما)
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Print Button */}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedContractId(currentContract.id);
                                                            setView('preview');
                                                            setTimeout(() => window.print(), 350);
                                                        }}
                                                        className="py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl font-black text-xs shadow-lg flex flex-col items-center justify-center gap-1 active:scale-95"
                                                    >
                                                        <Printer size={18} />
                                                        <span>چاپ</span>
                                                    </button>

                                                    {/* View Preview Button */}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedContractId(currentContract.id);
                                                            setView('preview');
                                                        }}
                                                        className="py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black text-xs border border-white/10 flex flex-col items-center justify-center gap-1 active:scale-95"
                                                    >
                                                        <Eye size={18} />
                                                        <span>مشاهده</span>
                                                    </button>

                                                    {/* Share Button */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleShareContract(currentContract)}
                                                        className="py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-black text-xs border border-white/10 flex flex-col items-center justify-center gap-1 active:scale-95"
                                                    >
                                                        <Share2 size={18} />
                                                        <span>اشتراک</span>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Standard Desktop Table */
                        <div className="bg-slate-900/60 border border-white/5 rounded-[2.5rem] shadow-2xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-right">
                                    <thead className="bg-white/5 text-slate-500 text-[10px] font-black uppercase">
                                        <tr>
                                            <th className="p-6">کد رهگیری</th>
                                            <th className="p-6">عنوان</th>
                                            <th className="p-6">نوع</th>
                                            <th className="p-6">طرف حساب</th>
                                            <th className="p-6 text-left">مبلغ کل</th>
                                            <th className="p-6">تاریخ شروع</th>
                                            <th className="p-6">وضعیت</th>
                                            <th className="p-6 text-center">عملیات</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-slate-200 text-sm font-bold divide-y divide-white/5">
                                        {contracts.map(c => {
                                            const statusDetails = getStatusDetails(c.status);
                                            return (
                                                <tr key={c.id} className="hover:bg-white/5 transition-all group">
                                                    <td className="p-6 font-mono text-indigo-400">{toPersianDigits(c.trackingCode)}</td>
                                                    <td className="p-6 font-black text-white">{c.title}</td>
                                                    <td className="p-6 text-slate-400">{getTypeLabel(c.type)}</td>
                                                    <td className="p-6 text-white">{c.personName}</td>
                                                    <td className="p-6 text-left font-mono font-black text-teal-400">{formatCurrency(c.totalAmount)}</td>
                                                    <td className="p-6 text-slate-500 font-mono">{toPersianDigits(c.startDate)}</td>
                                                    <td className="p-6">
                                                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black ${statusDetails.color}`}>
                                                            {statusDetails.label}
                                                        </span>
                                                    </td>
                                                    <td className="p-6">
                                                        <div className="flex justify-center gap-2">
                                                            <button onClick={() => { setSelectedContractId(c.id); setView('preview'); }} className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl hover:bg-blue-600 hover:text-white transition-all" title="پیش‌نمایش"><Eye size={18}/></button>
                                                            <button onClick={() => handleShareContract(c)} className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl hover:bg-indigo-600 hover:text-white transition-all" title="اشتراک‌گذاری و کپی لینک"><Share2 size={18}/></button>
                                                            <button onClick={() => setDeleteTarget(c.id)} className="p-2.5 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-600 hover:text-white transition-all" title="حذف"><Trash2 size={18}/></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {contracts.length === 0 && (
                                            <tr>
                                                <td colSpan={8} className="p-12 text-center text-slate-600 italic">هیچ قراردادی ثبت نشده است.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}

            {view === 'create' && (
                <div className="space-y-6">
                    <header className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-white/5 flex items-center justify-between shadow-2xl">
                        <div className="flex items-center gap-6">
                            <button onClick={resetForm} className="bg-white/5 text-white p-4 rounded-2xl hover:bg-white/10 transition-all" title="بازگشت (Esc)"><ArrowLeft size={20}/></button>
                            <h2 className="text-2xl font-black text-white">ثبت قرارداد جدید</h2>
                        </div>
                    </header>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        <div className="lg:col-span-8 space-y-6">
                            {/* Template Selector Card */}
                            <div className="bg-slate-900 border border-white/10 p-8 rounded-[2.5rem] shadow-2xl space-y-4">
                              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                                <div className="flex-1 w-full text-right">
                                  <label className="text-xs text-slate-400 font-bold pr-2 block mb-2">انتخاب قالب آماده قرارداد</label>
                                  <select 
                                    className="w-full bg-slate-950 border border-white/10 rounded-2xl p-4 text-white font-black outline-none focus:border-teal-500"
                                    value={selectedTemplate}
                                    onChange={e => {
                                      setSelectedTemplate(e.target.value);
                                      setTemplateVars({});
                                    }}
                                  >
                                    {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                    {customTemplates.map(t => <option key={t.id} value={t.id}>✨ قالب سفارشی: {t.label}</option>)}
                                  </select>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setShowTemplateModal(true)}
                                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-4 rounded-2xl font-black text-xs shrink-0 self-end flex items-center gap-2 shadow-lg w-full md:w-auto justify-center"
                                >
                                  ➕ مدیریت قالب‌های سفارشی
                                </button>
                              </div>
                            </div>

                            <div className="bg-slate-900 border border-white/10 p-8 rounded-[2.5rem] shadow-2xl space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs text-slate-400 font-bold pr-2 block">عنوان قرارداد</label>
                                    <input className="w-full bg-slate-950 border border-white/5 rounded-2xl p-4 text-white font-black shadow-inner outline-none focus:border-teal-500" placeholder="مثلا: قرارداد ارائه خدمات توسعه نرم‌افزار..." value={title} onChange={e => setTitle(e.target.value)} autoFocus />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-xs text-slate-400 font-bold pr-2 block mb-2">طرف دوم قرارداد (شخص)</label>
                                        <div className="flex gap-2">
                                            <select className="flex-1 bg-slate-950 border border-white/5 rounded-2xl p-4 text-white font-black shadow-inner outline-none focus:border-teal-500" value={personId} onChange={e => setPersonId(e.target.value)}>
                                                <option value="">--- انتخاب شخص ---</option>
                                                {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                            <button 
                                                onClick={() => setShowAddPersonModal(true)} 
                                                type="button" 
                                                className="shrink-0 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg" 
                                                title="ثبت سریع شخص جدید"
                                            >
                                                <UserPlus size={22} />
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-400 font-bold pr-2 block mb-2">نوع قرارداد</label>
                                        <select className="w-full bg-slate-950 border border-white/5 rounded-2xl p-4 text-white font-black shadow-inner outline-none focus:border-teal-500" value={type} onChange={e => setType(e.target.value as ContractType)}>
                                            {CONTRACT_TYPES.map(ct => <option key={ct.key} value={ct.key}>{ct.label}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <JalaliDatePicker label="تاریخ شروع" value={startDate} onChange={setStartDate} />
                                    <JalaliDatePicker label="تاریخ پایان" value={endDate} onChange={setEndDate} />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <NumberInput label="مبلغ کل قرارداد (ریال)" value={totalAmount} onChange={setTotalAmount} />
                                    <div>
                                        <label className="text-xs text-slate-400 font-bold pr-2 block mb-2">وضعیت شروع</label>
                                        <select className="w-full bg-slate-950 border border-white/5 rounded-2xl p-4 text-white font-black shadow-inner outline-none focus:border-teal-500" value={status} onChange={e => setStatus(e.target.value as ContractStatus)}>
                                            {CONTRACT_STATUSES.map(cs => <option key={cs.key} value={cs.key}>{cs.label}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Dynamic Template Variables Form */}
                                {selectedTemplate !== 'none' && (
                                  <div className="bg-slate-950 p-6 rounded-2xl border border-white/5 space-y-4">
                                    <h4 className="text-white font-black text-xs border-b border-white/5 pb-2">متغیرهای فنی و حقوقی قالب</h4>
                                    
                                    {selectedTemplate.startsWith('custom_') ? (
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {parsedCustomVars.map(v => (
                                          <div key={v} className="space-y-1 text-right">
                                            <label className="text-[10px] text-slate-400 font-bold pr-2">{v.replace(/_/g, ' ')}</label>
                                            <input 
                                              type="text" 
                                              className="w-full bg-slate-900 border border-white/5 p-3 rounded-lg text-white text-xs font-bold" 
                                              placeholder={`مقدار برای ${v.replace(/_/g, ' ')}...`} 
                                              value={templateVars[v] || ''} 
                                              onChange={e => handleVarChange(v, e.target.value)} 
                                            />
                                          </div>
                                        ))}
                                        {parsedCustomVars.length === 0 && (
                                          <p className="text-slate-500 text-xs italic col-span-2 text-center py-4">هیچ متغیری با فرمت {"{{متغیر}}"} در متن این قالب یافت نشد.</p>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      
                                      {/* PRINTING VARIABLES */}
                                      {selectedTemplate === 'printing' && (
                                        <>
                                          <div className="space-y-1">
                                            <label className="text-[10px] text-slate-500 font-bold pr-2">تیراژ کل سفارش</label>
                                            <input type="number" className="w-full bg-slate-900 border border-white/5 p-3 rounded-lg text-white font-mono text-xs" placeholder="مثال: ۵۰۰۰" value={templateVars.circulation || ''} onChange={e => handleVarChange('circulation', e.target.value)} />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-[10px] text-slate-500 font-bold pr-2">نوع کاغذ/مقوای مصرفی</label>
                                            <input className="w-full bg-slate-900 border border-white/5 p-3 rounded-lg text-white text-xs" placeholder="مثال: گلاسه ۳۰۰ گرم کره ای" value={templateVars.paperType || ''} onChange={e => handleVarChange('paperType', e.target.value)} />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-[10px] text-slate-500 font-bold pr-2">تعداد رنگ چاپی</label>
                                            <input className="w-full bg-slate-900 border border-white/5 p-3 rounded-lg text-white text-xs" placeholder="مثال: ۴ رنگ اصلی (CMYK)" value={templateVars.colors || ''} onChange={e => handleVarChange('colors', e.target.value)} />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-[10px] text-slate-500 font-bold pr-2">نوع روکش حفاظتی</label>
                                            <input className="w-full bg-slate-900 border border-white/5 p-3 rounded-lg text-white text-xs" placeholder="مثال: سلفون مات حرارتی یکرو" value={templateVars.coating || ''} onChange={e => handleVarChange('coating', e.target.value)} />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-[10px] text-slate-500 font-bold pr-2">نوع صحافی نهایی</label>
                                            <input className="w-full bg-slate-900 border border-white/5 p-3 rounded-lg text-white text-xs" placeholder="مثال: پرفراژ و چسب گرم" value={templateVars.binding || ''} onChange={e => handleVarChange('binding', e.target.value)} />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-[10px] text-slate-500 font-bold pr-2">مبلغ پیش‌پرداخت (ریال)</label>
                                            <input type="number" className="w-full bg-slate-900 border border-white/5 p-3 rounded-lg text-white font-mono text-xs" placeholder="مثال: ۵۰۰۰۰۰۰۰" value={templateVars.prepayment || ''} onChange={e => handleVarChange('prepayment', e.target.value)} />
                                          </div>
                                        </>
                                      )}

                                      {/* BOX VARIABLES */}
                                      {selectedTemplate === 'box' && (
                                        <>
                                          <div className="space-y-1">
                                            <label className="text-[10px] text-slate-500 font-bold pr-2">ابعاد نهایی جعبه (سانتی‌متر)</label>
                                            <input className="w-full bg-slate-900 border border-white/5 p-3 rounded-lg text-white font-mono text-xs" placeholder="طول * عرض * ارتفاع" value={templateVars.dimensions || ''} onChange={e => handleVarChange('dimensions', e.target.value)} />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-[10px] text-slate-500 font-bold pr-2">نوع مقوای مصرفی</label>
                                            <input className="w-full bg-slate-900 border border-white/5 p-3 rounded-lg text-white text-xs" placeholder="مثال: مقوای ایندربرد سفید" value={templateVars.boxPaperType || ''} onChange={e => handleVarChange('boxPaperType', e.target.value)} />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-[10px] text-slate-500 font-bold pr-2">گرماژ مقوا (گرم)</label>
                                            <input type="number" className="w-full bg-slate-900 border border-white/5 p-3 rounded-lg text-white font-mono text-xs" placeholder="مثال: ۳۵۰" value={templateVars.paperWeight || ''} onChange={e => handleVarChange('paperWeight', e.target.value)} />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-[10px] text-slate-500 font-bold pr-2">نوع قالب‌زنی و دایکات</label>
                                            <input className="w-full bg-slate-900 border border-white/5 p-3 rounded-lg text-white text-xs" placeholder="مثال: قالب ملخی دایکات تخت" value={templateVars.dieCut || ''} onChange={e => handleVarChange('dieCut', e.target.value)} />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-[10px] text-slate-500 font-bold pr-2">روکش جعبه</label>
                                            <input className="w-full bg-slate-900 border border-white/5 p-3 rounded-lg text-white text-xs" placeholder="مثال: یووی موضعی برجسته" value={templateVars.boxCoating || ''} onChange={e => handleVarChange('boxCoating', e.target.value)} />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-[10px] text-slate-500 font-bold pr-2">مبلغ پیش‌پرداخت (ریال)</label>
                                            <input type="number" className="w-full bg-slate-900 border border-white/5 p-3 rounded-lg text-white font-mono text-xs" placeholder="مثال: ۳۰۰۰۰۰۰۰" value={templateVars.prepayment || ''} onChange={e => handleVarChange('prepayment', e.target.value)} />
                                          </div>
                                        </>
                                      )}

                                      {/* CARTON VARIABLES */}
                                      {selectedTemplate === 'carton' && (
                                        <>
                                          <div className="space-y-1">
                                            <label className="text-[10px] text-slate-500 font-bold pr-2">ابعاد کارتن (طول*عرض*ارتفاع)</label>
                                            <input className="w-full bg-slate-900 border border-white/5 p-3 rounded-lg text-white font-mono text-xs" placeholder="مثال: ۴۰ * ۳۰ * ۲۰" value={templateVars.cartonDimensions || ''} onChange={e => handleVarChange('cartonDimensions', e.target.value)} />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-[10px] text-slate-500 font-bold pr-2">نوع کنگره و فلوت ورق</label>
                                            <select className="w-full bg-slate-900 border border-white/5 p-3 rounded-lg text-white text-xs" value={templateVars.fluteType || ''} onChange={e => handleVarChange('fluteType', e.target.value)}>
                                              <option value="">انتخاب ورق...</option>
                                              <option value="۳ لایه فلوت B">۳ لایه فلوت B</option>
                                              <option value="۳ لایه فلوت C">۳ لایه فلوت C</option>
                                              <option value="۵ لایه فلوت BC">۵ لایه فلوت BC</option>
                                              <option value="E فلوت بهداشتی">E فلوت بهداشتی</option>
                                            </select>
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-[10px] text-slate-500 font-bold pr-2">تیراژ سفارش (عدد)</label>
                                            <input type="number" className="w-full bg-slate-900 border border-white/5 p-3 rounded-lg text-white font-mono text-xs" placeholder="مثال: ۱۰۰۰" value={templateVars.cartonCirculation || ''} onChange={e => handleVarChange('cartonCirculation', e.target.value)} />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-[10px] text-slate-500 font-bold pr-2">روش چاپ روی کارتن</label>
                                            <input className="w-full bg-slate-900 border border-white/5 p-3 rounded-lg text-white text-xs" placeholder="مثال: فلکسو دو رنگ" value={templateVars.cartonPrintType || ''} onChange={e => handleVarChange('cartonPrintType', e.target.value)} />
                                          </div>
                                        </>
                                      )}

                                      {/* PLASTIC INJECTION VARIABLES */}
                                      {selectedTemplate === 'injection' && (
                                        <>
                                          <div className="space-y-1">
                                            <label className="text-[10px] text-slate-500 font-bold pr-2">نوع پلیمر / مواد اولیه</label>
                                            <input className="w-full bg-slate-900 border border-white/5 p-3 rounded-lg text-white text-xs" placeholder="مثال: پلی پروپیلن (PP) یا ABS" value={templateVars.plasticMaterial || ''} onChange={e => handleVarChange('plasticMaterial', e.target.value)} />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-[10px] text-slate-500 font-bold pr-2">وزن خالص قطعه (گرم)</label>
                                            <input type="number" className="w-full bg-slate-900 border border-white/5 p-3 rounded-lg text-white font-mono text-xs" placeholder="مثال: ۱۵۰" value={templateVars.partWeight || ''} onChange={e => handleVarChange('partWeight', e.target.value)} />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-[10px] text-slate-500 font-bold pr-2">تعداد حفره قالب (کویتی)</label>
                                            <input type="number" className="w-full bg-slate-900 border border-white/5 p-3 rounded-lg text-white font-mono text-xs" placeholder="مثال: ۴ حفره" value={templateVars.moldCavities || ''} onChange={e => handleVarChange('moldCavities', e.target.value)} />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-[10px] text-slate-500 font-bold pr-2">مالکیت و مسئولیت قالب</label>
                                            <input className="w-full bg-slate-900 border border-white/5 p-3 rounded-lg text-white text-xs" placeholder="مثال: کارفرمای پروژه" value={templateVars.moldOwnership || ''} onChange={e => handleVarChange('moldOwnership', e.target.value)} />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-[10px] text-slate-500 font-bold pr-2">مسئول تامین مواد اولیه</label>
                                            <input className="w-full bg-slate-900 border border-white/5 p-3 rounded-lg text-white text-xs" placeholder="مثال: مجری یا کارفرما" value={templateVars.materialProvider || ''} onChange={e => handleVarChange('materialProvider', e.target.value)} />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-[10px] text-slate-500 font-bold pr-2">هزینه هر ضرب تزریق (ریال)</label>
                                            <input type="number" className="w-full bg-slate-900 border border-white/5 p-3 rounded-lg text-white font-mono text-xs" placeholder="مثال: ۱۲۰۰۰" value={templateVars.strikePrice || ''} onChange={e => handleVarChange('strikePrice', e.target.value)} />
                                          </div>
                                        </>
                                      )}

                                    </div>
                                   )}
                                  </div>
                                )}

                                {selectedTemplate === 'none' && (
                                  <div className="space-y-2">
                                      <label className="text-xs text-slate-400 font-bold pr-2 block">شرح و شرایط قرارداد</label>
                                      <textarea className="w-full bg-slate-950 border border-white/5 rounded-2xl p-4 text-white text-sm outline-none focus:border-teal-500 h-32 resize-none shadow-inner" placeholder="شرح وظایف، تضامین، تعهدات و..." value={description} onChange={e => setDescription(e.target.value)} />
                                  </div>
                                )}
                            </div>

                            {/* Installments / Items */}
                            <div className="bg-slate-900 border border-white/10 p-8 rounded-[2.5rem] shadow-2xl space-y-6">
                                <h3 className="text-white font-black text-lg flex items-center gap-2"><PlusCircle size={20} className="text-teal-400" /> تعهدات پرداخت و اقساط (اختیاری)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-slate-500 font-bold pr-2">شرح قسط/تعهد</label>
                                        <input className="w-full bg-slate-950 p-3.5 border border-white/10 rounded-xl text-white text-xs outline-none focus:border-teal-500" placeholder="مثال: قسط اول پس از پیشرفت فیزیکی..." value={itemDesc} onChange={e => setItemDesc(e.target.value)} />
                                    </div>
                                    <div className="space-y-1">
                                        <NumberInput label="مبلغ قسط (ریال)" value={itemAmount} onChange={setItemAmount} className="!p-3.5 !rounded-xl !text-sm" />
                                    </div>
                                    <div className="space-y-1">
                                        <JalaliDatePicker label="سررسید قسط" value={itemDueDate} onChange={setItemDueDate} />
                                    </div>
                                </div>
                                <button onClick={handleAddItem} className="w-full bg-slate-800 text-teal-400 border border-teal-500/20 py-3 rounded-xl font-black text-xs hover:bg-slate-700 transition-all flex items-center justify-center gap-2">افزودن قسط به لیست</button>

                                <div className="space-y-2">
                                    {items.map(item => (
                                        <div key={item.id} className="flex justify-between items-center bg-slate-950 p-4 rounded-xl border border-white/5">
                                            <div className="flex flex-col">
                                                <span className="text-white font-bold text-xs">{item.description}</span>
                                                <span className="text-[10px] text-slate-500 font-mono mt-1">سررسید: {toPersianDigits(item.dueDate || '')}</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-teal-400 font-mono font-black text-sm">{formatCurrency(item.amount)}</span>
                                                <button onClick={() => handleRemoveItem(item.id)} className="text-rose-500 p-2 hover:bg-rose-500/10 rounded-lg"><Trash2 size={16}/></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-4 sticky top-24">
                            <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl space-y-6">
                                <h4 className="text-white font-black text-sm border-b border-white/5 pb-3">ذخیره‌سازی سند</h4>
                                <button onClick={handleSaveContract} className="w-full bg-teal-600 hover:bg-teal-500 text-white py-5 rounded-[2rem] flex items-center justify-center gap-3 transition-all shadow-xl font-black text-lg active:scale-95 shadow-teal-600/20">
                                    <Save size={24} />
                                    <span>ثبت و ذخیره نهایی</span>
                                </button>
                                <button onClick={resetForm} className="w-full bg-slate-800 text-slate-400 py-4 rounded-[2rem] font-bold text-sm hover:bg-slate-700 transition-all">انصراف</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {view === 'preview' && selectedContract && (
                <div className="fixed inset-0 z-[6000] bg-slate-950 flex flex-col animate-fade-in print-preview-modal">
                    <header className="w-full bg-slate-900 border-b border-white/10 p-5 flex justify-between items-center z-10 px-8 shadow-2xl shrink-0 no-print">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setView('list')} className="bg-white/5 text-white p-3 rounded-2xl hover:bg-rose-600 transition-all shadow-lg active:scale-90 flex items-center justify-center shrink-0" title="بازگشت (Esc)"><ArrowLeft size={20}/></button>
                            <div className="flex flex-col">
                                <h2 className="text-white font-black text-lg">پیش‌نمایش قرارداد تجاری</h2>
                                <p className="text-slate-500 text-[9px] font-black uppercase mt-1">Document Verification View</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => { setSignRole('person'); setShowSignaturePad(true); }} className="bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/20 text-indigo-300 hover:text-white px-5 py-3 rounded-2xl font-black text-xs transition-all flex items-center gap-2"><PenTool size={16}/> امضای طرف دوم</button>
                            <button onClick={() => { setSignRole('company'); setShowSignaturePad(true); }} className="bg-teal-500/20 hover:bg-teal-600 border border-teal-500/20 text-teal-300 hover:text-white px-5 py-3 rounded-2xl font-black text-xs transition-all flex items-center gap-2"><ShieldCheck size={16}/> امضای شرکت</button>
                            <button onClick={() => handleShareContract(selectedContract)} className="bg-blue-600/20 hover:bg-blue-600 border border-blue-500/20 text-blue-300 hover:text-white px-5 py-3 rounded-2xl font-black text-xs transition-all flex items-center gap-2" title="اشتراک‌گذاری"><Share2 size={16}/> اشتراک‌گذاری</button>
                            <button onClick={() => window.print()} className="bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all flex items-center gap-2">چاپ سند</button>
                        </div>
                    </header>

                    <div className="flex-1 w-full overflow-y-auto p-4 md:p-12 flex flex-col items-center bg-[#020617] custom-scrollbar">
                        <div className="bg-white text-slate-900 rounded-sm shadow-2xl p-8 md:p-12 font-sans border border-slate-200 print-contract-page flex flex-col h-auto shrink-0" style={{ width: 'min(98vw, 210mm)', minHeight: '297mm', direction: 'rtl' }}>
                            <div className="contract-double-border w-full flex-1 flex flex-col justify-between h-auto shrink-0 p-6 md:p-8" style={{ minHeight: '265mm' }}>
                                <div>
                                    {/* Design a beautiful premium letterhead */}
                                    <div className="flex justify-between items-start mb-8 border-b-2 border-slate-900 pb-5 w-full text-slate-900">
                                        {/* Right: Company Logo & Details */}
                                        <div className="flex items-center gap-3 text-right">
                                            <div className="w-14 h-14 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center text-slate-800 shrink-0 shadow-sm">
                                                {previewCompany?.logo ? (
                                                    <img src={previewCompany.logo} className="w-full h-full object-contain p-1" />
                                                ) : (
                                                    <ScrollText size={28} className="text-indigo-600" />
                                                )}
                                            </div>
                                            <div>
                                                <h2 className="text-base font-black text-slate-900">{previewCompany?.name || 'سامانه مدیریت قراردادها'}</h2>
                                                <p className="text-[9px] text-slate-500 mt-0.5 font-bold">
                                                    تلفن: {toPersianDigits(previewCompany?.phone || '۰۲۱')}
                                                </p>
                                                <p className="text-[9px] text-slate-500 font-bold truncate max-w-[200px]" title={previewCompany?.address}>
                                                    نشانی: {previewCompany?.address || 'دفتر مرکزی'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Center: Title & Islamic Emblem */}
                                        <div className="text-center self-center flex flex-col items-center">
                                            <span className="text-[10px] font-bold text-slate-500 mb-1">بسمه تعالی</span>
                                            <div className="bg-slate-100 border border-slate-300 px-5 py-1.5 rounded-xl shadow-xs">
                                                <h1 className="text-sm font-black text-slate-950 tracking-wider">قرارداد {getTypeLabel(selectedContract.type)}</h1>
                                                <span className="text-[8px] text-slate-500 font-black block mt-0.5">سند رسمی و معتبر تجاری</span>
                                            </div>
                                        </div>

                                        {/* Left: Metadata & QR Code */}
                                        <div className="flex items-center gap-3 text-right">
                                            <div className="text-right text-[9px] text-slate-600 font-bold space-y-0.5">
                                                <div>شماره: <span className="font-mono font-black">{toPersianDigits(selectedContract.number)}</span></div>
                                                <div>تاریخ ثبت: <span className="font-mono font-black">{toPersianDigits(selectedContract.createdAt || '')}</span></div>
                                                <div>کد رهگیری: <span className="font-mono font-black text-indigo-700">{toPersianDigits(selectedContract.trackingCode)}</span></div>
                                                <div>وضعیت: <span className="font-black text-emerald-600">{getStatusDetails(selectedContract.status).label}</span></div>
                                            </div>
                                            <div className="bg-white border border-slate-200 p-1 rounded-lg flex flex-col items-center shadow-xs shrink-0">
                                                <img src={getQrCodeUrl(`${window.location.origin}${window.location.pathname}#/sign/${selectedContract.id}`)} className="w-11 h-11" alt="QR Verification" />
                                                <span className="text-[6px] text-slate-400 mt-0.5 font-bold">تایید اصالت</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Parties Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                        {/* First Party (Company) */}
                                        <div className="contract-party-card text-right">
                                            <h4 className="font-black text-[11px] text-indigo-900 border-b border-slate-200 pb-1 mt-0 mb-1.5 flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                                                طرف اول: کارفرما (حقوقی)
                                            </h4>
                                            <div className="text-[10px] text-slate-700 space-y-0.5 leading-4">
                                                <div><strong>نام شرکت:</strong> {previewCompany?.legalName || previewCompany?.name || '---'}</div>
                                                <div><strong>شناسه ملی:</strong> {previewCompany?.id && previewCompany.id !== 'default' ? toPersianDigits(previewCompany.id) : '---'}</div>
                                                <div><strong>تلفن تماس:</strong> {previewCompany?.phone ? toPersianDigits(previewCompany.phone) : '---'}</div>
                                                <div className="truncate" title={previewCompany?.address}><strong>نشانی:</strong> {previewCompany?.address || '---'}</div>
                                            </div>
                                        </div>

                                        {/* Second Party (Person) */}
                                        <div className="contract-party-card text-right">
                                            <h4 className="font-black text-[11px] text-indigo-900 border-b border-slate-200 pb-1 mt-0 mb-1.5 flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                                                طرف دوم: پیمانکار / مجری
                                            </h4>
                                            <div className="text-[10px] text-slate-700 space-y-0.5 leading-4">
                                                <div><strong>نام کامل:</strong> {previewPerson?.name || selectedContract.personName}</div>
                                                <div><strong>کد ملی / شناسه:</strong> {previewPerson?.nationalId ? toPersianDigits(previewPerson.nationalId) : '---'}</div>
                                                <div><strong>تلفن همراه:</strong> {previewPerson?.phone ? toPersianDigits(previewPerson.phone) : '---'}</div>
                                                <div className="truncate" title={previewPerson?.address}><strong>نشانی:</strong> {previewPerson?.address || '---'}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="space-y-5 text-[11px] leading-6 text-justify text-slate-800 mb-8 pr-1">
                                        <div>
                                            <h4 className="font-black text-xs border-r-3 border-indigo-600 pr-1.5 mb-1.5 text-indigo-950">ماده ۱: موضوع قرارداد</h4>
                                            <p className="font-bold text-slate-900 pl-4">{selectedContract.title}</p>
                                        </div>
                                        
                                        <div>
                                            <h4 className="font-black text-xs border-r-3 border-indigo-600 pr-1.5 mb-1.5 text-indigo-950">ماده ۲: شرح و تعهدات قرارداد</h4>
                                            {parsedContractDescription ? (
                                              <div className="space-y-3">
                                                <p className="whitespace-pre-line leading-relaxed font-medium bg-slate-50/50 p-3.5 rounded-xl border border-slate-100">{parsedContractDescription.compiledText}</p>
                                                
                                                {/* Tech specs summary table */}
                                                <div>
                                                  <p className="text-[9px] font-black text-slate-400 mb-1">متغیرها و مقادیر فنی ثبت‌شده در قالب:</p>
                                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 text-[9px]">
                                                    {Object.entries(parsedContractDescription.variables).map(([key, val]) => {
                                                      let label = key;
                                                      if (key === 'circulation') label = 'تیراژ';
                                                      else if (key === 'paperType') label = 'کاغذ مصرفی';
                                                      else if (key === 'colors') label = 'رنگ‌ها';
                                                      else if (key === 'coating') label = 'سلفون/پوشش';
                                                      else if (key === 'binding') label = 'صحافی چاپی';
                                                      else if (key === 'dimensions') label = 'ابعاد جعبه';
                                                      else if (key === 'boxPaperType') label = 'نوع مقوا';
                                                      else if (key === 'paperWeight') label = 'گرماژ مقوا';
                                                      else if (key === 'dieCut') label = 'قالب‌زنی دایکات';
                                                      else if (key === 'boxCoating') label = 'روکش جعبه';
                                                      else if (key === 'cartonDimensions') label = 'ابعاد کارتن';
                                                      else if (key === 'fluteType') label = 'کنگره فلوت ورق';
                                                      else if (key === 'cartonCirculation') label = 'تیراژ سفارش';
                                                      else if (key === 'cartonPrintType') label = 'چاپ کارتن';
                                                      else if (key === 'plasticMaterial') label = 'مواد اولیه';
                                                      else if (key === 'partWeight') label = 'وزن قطعه (گرم)';
                                                      else if (key === 'moldCavities') label = 'حفره قالب';
                                                      else if (key === 'moldOwnership') label = 'مالکیت قالب';
                                                      else if (key === 'strikePrice') label = 'هزینه هر ضرب';
                                                      else if (key === 'materialProvider') label = 'تامین مواد';
                                                      else if (key === 'prepayment') label = 'پیش‌پرداخت';

                                                      return (
                                                        <div key={key} className="bg-slate-50 border border-slate-200/60 p-2 rounded-lg flex justify-between">
                                                          <span className="text-slate-400 font-bold">{label.replace(/_/g, ' ')}:</span>
                                                          <span className="font-black text-slate-800">
                                                            {key === 'prepayment' || key === 'strikePrice' || key === 'مبلغ_کل_پروژه' || key === 'مبلغ_پیش_پرداخت' || key === 'مبلغ_تسویه_نهایی' || key === 'مبلغ_کل_قرارداد' || !isNaN(Number(val)) && Number(val) > 1000 ? toPersianDigits(Number(val).toLocaleString()) + ' ریال' : toPersianDigits(val as string)}
                                                          </span>
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                </div>
                                              </div>
                                            ) : (
                                              <p className="whitespace-pre-line leading-relaxed font-medium bg-slate-50/50 p-3.5 rounded-xl border border-slate-100">{selectedContract.description || 'شرح ثبت نشده است.'}</p>
                                            )}
                                        </div>

                                        <div>
                                            <h4 className="font-black text-xs border-r-3 border-indigo-600 pr-1.5 mb-1.5 text-indigo-950">ماده ۳: مدت قرارداد</h4>
                                            <p>این قرارداد از تاریخ <span className="font-black font-mono text-indigo-900">{toPersianDigits(selectedContract.startDate)}</span> لغایت <span className="font-black font-mono text-indigo-900">{toPersianDigits(selectedContract.endDate || '---')}</span> معتبر و برای طرفین لازم‌الاجرا خواهد بود.</p>
                                        </div>

                                        <div>
                                            <h4 className="font-black text-xs border-r-3 border-indigo-600 pr-1.5 mb-1.5 text-indigo-950">ماده ۴: ارزش قرارداد</h4>
                                            <p>ارزش کل تعهدات این قرارداد برابر با <span className="font-black text-teal-700 text-xs">{formatCurrency(selectedContract.totalAmount)}</span> تعیین شده است.</p>
                                        </div>

                                        {selectedContract.items && selectedContract.items.length > 0 && (
                                            <div>
                                                <h4 className="font-black text-xs border-r-3 border-indigo-600 pr-1.5 mb-1.5 text-indigo-950">ماده ۵: برنامه زمان‌بندی پرداخت و اقساط تعهد شده</h4>
                                                <div className="border border-slate-200 rounded-xl overflow-hidden mt-2 shadow-xs">
                                                    <table className="w-full text-right text-[10px]">
                                                        <thead className="bg-slate-100 font-bold text-slate-700">
                                                            <tr>
                                                                <th className="p-2.5">شرح قسط / مرحله پرداختی</th>
                                                                <th className="p-2.5">تاریخ سررسید</th>
                                                                <th className="p-2.5 text-left">مبلغ تعهد شده</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 text-slate-800">
                                                            {selectedContract.items.map((item, index) => (
                                                                <tr key={item.id} className="hover:bg-slate-50/50">
                                                                    <td className="p-2.5">{item.description}</td>
                                                                    <td className="p-2.5 font-mono">{toPersianDigits(item.dueDate || '')}</td>
                                                                    <td className="p-2.5 text-left font-mono font-bold text-teal-600">{formatCurrency(item.amount)}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Signatures Zone */}
                                <div className="grid grid-cols-2 gap-8 border-t border-slate-300 pt-6 mt-6">
                                    <div className="text-center flex flex-col items-center">
                                        <p className="text-[10px] font-black text-slate-500 mb-2">مهر و امضای طرف اول (کارفرما)</p>
                                        <div className="relative w-48 h-28 flex items-center justify-center border border-slate-200 bg-slate-50/30 rounded-xl overflow-hidden shadow-inner">
                                            {/* Signature of the manager/company */}
                                            {(selectedContract.companySignature || previewCompany?.signature) ? (
                                                <img 
                                                    src={selectedContract.companySignature || previewCompany?.signature} 
                                                    className="h-20 max-w-full object-contain mix-blend-multiply z-10" 
                                                />
                                            ) : null}
                                            
                                            {/* Stamp of the company */}
                                            {previewCompany?.stamp ? (
                                                <img 
                                                    src={previewCompany.stamp} 
                                                    className="absolute right-4 bottom-2 h-16 w-16 object-contain mix-blend-multiply opacity-85 z-20" 
                                                />
                                            ) : (
                                                /* Decorative Stamp Ring */
                                                <div className="absolute right-2 bottom-2 w-16 h-16 border-2 border-dashed border-indigo-500/10 rounded-full flex flex-col items-center justify-center rotate-12">
                                                    <span className="text-[6px] text-indigo-500/20 font-black">محل مهر</span>
                                                    <span className="text-[5px] text-indigo-500/20 font-mono">STAMP ZONE</span>
                                                </div>
                                            )}

                                            {!(selectedContract.companySignature || previewCompany?.signature) && !previewCompany?.stamp && (
                                                <span className="text-[9px] text-slate-400 italic">انتظار برای امضاء طرف اول...</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-center flex flex-col items-center">
                                        <p className="text-[10px] font-black text-slate-500 mb-2">مهر و امضای طرف دوم (پیمانکار)</p>
                                        <div className="relative w-48 h-28 flex items-center justify-center border border-slate-200 bg-slate-50/30 rounded-xl overflow-hidden shadow-inner">
                                            {selectedContract.signature ? (
                                                <img src={selectedContract.signature} className="h-20 max-w-full object-contain mix-blend-multiply z-10" />
                                            ) : (
                                                <span className="text-[9px] text-slate-400 italic">انتظار برای امضاء طرف دوم...</span>
                                            )}
                                            {/* Decorative Fingerprint Ring */}
                                            <div className="absolute left-2 bottom-2 w-16 h-16 border-2 border-dashed border-teal-500/10 rounded-full flex flex-col items-center justify-center -rotate-12">
                                                <span className="text-[6px] text-teal-500/20 font-black">اثر انگشت / مهر</span>
                                                <span className="text-[5px] text-teal-500/20 font-mono">FINGERPRINT</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <FullScreenSignatureModal 
                        isOpen={showSignaturePad} 
                        onClose={() => setShowSignaturePad(false)} 
                        onSave={(img: string) => {
                            if (selectedContractId) {
                                setContractSignature(selectedContractId, img, signRole);
                                setShowSignaturePad(false);
                            }
                        }} 
                        title={`ثبت امضای دیجیتال (${signRole === 'company' ? 'صاحب کسب‌وکار (طرف اول)' : 'طرف دوم قرارداد'})`}
                    />

                    {/* Mobile Bottom Action Bar in Preview */}
                    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0d1527]/95 backdrop-blur-xl border-t border-white/10 p-3 shadow-[0_-8px_32px_rgba(0,0,0,0.7)] md:hidden no-print">
                        <div className="grid grid-cols-4 gap-2 max-w-md mx-auto">
                            <button 
                                onClick={() => { setSignRole('person'); setShowSignaturePad(true); }}
                                className="py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-black text-[11px] flex flex-col items-center justify-center gap-1 active:scale-95 shadow-md"
                            >
                                <PenTool size={16} />
                                <span>امضای خریدار</span>
                            </button>
                            <button 
                                onClick={() => { setSignRole('company'); setShowSignaturePad(true); }}
                                className="py-3 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-2xl font-black text-[11px] flex flex-col items-center justify-center gap-1 active:scale-95 shadow-md"
                            >
                                <ShieldCheck size={16} />
                                <span>امضای شرکت</span>
                            </button>
                            <button 
                                onClick={() => window.print()}
                                className="py-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded-2xl font-black text-[11px] flex flex-col items-center justify-center gap-1 active:scale-95 shadow-md"
                            >
                                <Printer size={16} />
                                <span>چاپ سند</span>
                            </button>
                            <button 
                                onClick={() => handleShareContract(selectedContract)}
                                className="py-3 bg-slate-800 text-slate-300 rounded-2xl font-black text-[11px] flex flex-col items-center justify-center gap-1 active:scale-95 border border-white/10"
                            >
                                <Share2 size={16} />
                                <span>اشتراک</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Smart Guide Modal */}
            {showSmartGuide && (
                <div className="fixed inset-0 z-[7500] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" dir="rtl">
                    <div className="bg-slate-900 border border-teal-500/30 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4">
                        <div className="flex justify-between items-center pb-3 border-b border-white/10">
                            <div className="flex items-center gap-2 text-teal-400">
                                <HelpCircle size={22} />
                                <h3 className="font-black text-white text-base">راهنمای هوشمند سامانه قراردادها</h3>
                            </div>
                            <button onClick={() => setShowSmartGuide(false)} className="text-slate-400 hover:text-white p-1">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-3 text-xs text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
                            <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                                <strong className="text-teal-300 block mb-1">📱 نمای کارتی فشرده مخصوص موبایل:</strong>
                                در نسخه موبایل، لیست قراردادها به صورت کارت‌های تجاری فشرده با اطلاعات کلیدی (مبلغ، طرف حساب، وضعیت امضا) نمایش داده می‌شود.
                            </div>
                            <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                                <strong className="text-indigo-300 block mb-1">⚡ نوار دسترسی سریع پایین صفحه:</strong>
                                با انتخاب هر کارت، نوار عملیاتی در پایین صفحه در دسترس شست قرار می‌گیرد تا بتوانید بدون پیمایش اضافی، سند را امضا، چاپ یا اشتراک‌گذاری کنید.
                            </div>
                            <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                                <strong className="text-emerald-300 block mb-1">✍️ امضای دوطرفه دیجیتال:</strong>
                                امکان ثبت امضای خریدار و مهر دیجیتال شرکت با تاییدیه گرافیکی و نمایش وضعیت تایید در کارت و سربرگ رسمی سند.
                            </div>
                            <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                                <strong className="text-amber-300 block mb-1">🖨️ چاپ مستقیم و خروجی رسمی:</strong>
                                فرمت استاندارد A4 با سربرگ، کادر دوتایی امنیتی و کد QR رهگیری معتبر.
                            </div>
                        </div>

                        <button
                            onClick={() => setShowSmartGuide(false)}
                            className="w-full bg-teal-600 text-white py-3 rounded-2xl font-black text-xs shadow-lg"
                        >
                            متوجه شدم
                        </button>
                    </div>
                </div>
            )}

            <ConfirmModal 
                isOpen={!!deleteTarget} 
                onClose={() => setDeleteTarget(null)} 
                onConfirm={() => { 
                    if (deleteTarget) {
                        deleteContract(deleteTarget);
                        setDeleteTarget(null);
                        setSelectedContractId(null);
                        setView('list');
                    }
                }} 
                title="حذف قرارداد" 
                message="آیا از حذف کامل این قرارداد تجاری و اقساط ثبت شده مربوطه اطمینان دارید؟ این عمل غیرقابل بازگشت است." 
            />

            {showShareModal && (
                <ShareModal 
                    isOpen={showShareModal} 
                    onClose={() => {
                        setShowShareModal(false);
                        setSharePreviewData('');
                        setShareContractId('');
                    }} 
                    documentId={shareContractId} 
                    documentType="قرارداد" 
                    documentPreview={sharePreviewData} 
                />
            )}

            {/* Custom Templates Management Modal */}
            {showTemplateModal && (
                <div className="fixed inset-0 z-7000 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
                    <div className="bg-slate-900 border border-white/10 w-full max-w-5xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in">
                        <header className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-800/40">
                            <div className="text-right">
                                <h3 className="text-lg font-black text-white flex items-center gap-2">✨ مدیریت و راهنمای قالب‌های سفارشی قرارداد</h3>
                                <p className="text-[10px] text-slate-400 mt-1">طراحی قالب‌های پویا با متغیرهای خودکار برای دریافت سیستماتیک داده‌ها</p>
                            </div>
                            <button onClick={() => setShowTemplateModal(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 text-white transition-all">
                                <X size={20} />
                            </button>
                        </header>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 overflow-y-auto max-h-[78vh] custom-scrollbar">
                            {/* Right Column: Custom Template Creator (Form & Editor) - lg:col-span-7 */}
                            <div className="lg:col-span-7 space-y-4 text-right">
                                <div className="bg-slate-950 p-6 rounded-3xl border border-white/5 space-y-4">
                                    <h4 className="text-xs font-black text-teal-400 flex items-center gap-2">➕ ایجاد قالب جدید</h4>
                                    
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-slate-400 font-bold block">نام / عنوان قالب</label>
                                        <input 
                                            type="text" 
                                            className="w-full bg-slate-900 border border-white/5 rounded-xl p-3.5 text-white text-xs font-bold outline-none focus:border-teal-500 shadow-inner" 
                                            placeholder="مثال: قرارداد همکاری توسعه نرم‌افزار / طراح گرافیک" 
                                            value={newTemplateLabel} 
                                            onChange={e => setNewTemplateLabel(e.target.value)} 
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] text-slate-400 font-bold block">
                                            متن قرارداد
                                        </label>
                                        <textarea 
                                            ref={templateEditorRef}
                                            className="w-full bg-slate-900 border border-white/5 rounded-xl p-4 text-white text-xs font-medium leading-relaxed outline-none focus:border-teal-500 h-64 resize-none shadow-inner custom-scrollbar" 
                                            placeholder="ماده ۱: این قرارداد فی‌مابین شرکت {{نام_کارفرما}} به عنوان کارفرما و جناب آقای {{نام_پیمانکار}} جهت موضوع {{موضوع_قرارداد}} منعقد می‌گردد..."
                                            value={newTemplateContent} 
                                            onChange={e => setNewTemplateContent(e.target.value)} 
                                        />
                                    </div>

                                    {/* Live Form Fields Preview (Visual feedback) */}
                                    {liveExtractedVars.length > 0 && (
                                        <div className="bg-slate-900/50 border border-white/5 p-4 rounded-2xl space-y-2.5">
                                            <span className="text-[10px] text-teal-400 font-black block">👁️ پیش‌نمایش فیلدهای فرم قرارداد شما:</span>
                                            <div className="grid grid-cols-2 gap-2 max-h-24 overflow-y-auto custom-scrollbar">
                                                {liveExtractedVars.map(v => (
                                                    <div key={v} className="bg-slate-950 p-2 rounded-lg border border-white/5 text-[9px] text-slate-300 font-bold flex justify-between items-center">
                                                        <span className="truncate">{v.replace(/_/g, ' ')}</span>
                                                        <span className="text-[7px] bg-teal-500/10 text-teal-400 px-1.5 py-0.5 rounded-full font-mono font-black shrink-0">متغیر پویا</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <button 
                                        onClick={handleSaveCustomTemplate} 
                                        className="bg-teal-600 hover:bg-teal-500 text-white py-3.5 rounded-xl font-black text-xs transition-all w-full shadow-lg hover:shadow-teal-600/10 active:scale-95"
                                    >
                                        ذخیره قالب جدید
                                    </button>
                                </div>
                            </div>

                            {/* Left Column: Interactive Helper Guide & List - lg:col-span-5 */}
                            <div className="lg:col-span-5 space-y-4 text-right flex flex-col">
                                {/* Instructions & Variable Chips */}
                                <div className="bg-slate-950 p-5 rounded-3xl border border-white/5 space-y-4">
                                    <div>
                                        <h4 className="text-xs font-black text-indigo-400">💡 راهنمای تعریف متغیرها</h4>
                                        <p className="text-[10px] text-slate-400 leading-5 mt-1 font-medium">
                                            هر کلمه‌ای که داخل <code className="bg-white/5 text-indigo-300 px-1 py-0.5 rounded font-mono">{"{{...}}"}</code> قرار دهید، سیستم آن را شناسایی کرده و هنگام ایجاد قرارداد، یک **فیلد ورودی پویا** برای مقداردهی آن در فرم به شما نمایش خواهد داد.
                                        </p>
                                    </div>

                                    {/* Action buttons */}
                                    <div className="pt-1">
                                        <button 
                                            type="button" 
                                            onClick={handleLoadSample} 
                                            className="w-full bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/30 text-indigo-300 hover:text-white py-2.5 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1.5"
                                        >
                                            📄 بارگذاری نمونه قرارداد فریلنسری
                                        </button>
                                    </div>

                                    {/* Variable Chips */}
                                    <div className="space-y-2 border-t border-white/5 pt-3">
                                        <span className="text-[10px] text-slate-400 font-black block">📌 برای درج، روی متغیرهای پرکاربرد کلیک کنید:</span>
                                        
                                        <div className="space-y-3">
                                            <div>
                                                <span className="text-[8px] text-slate-500 font-bold block mb-1">طرفین قرارداد</span>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {['نام_کارفرما', 'شناسه_ملی_کارفرما', 'نماینده_کارفرما', 'نام_پیمانکار', 'کد_ملی_پیمانکار'].map(c => (
                                                        <button 
                                                            key={c} 
                                                            type="button"
                                                            onClick={() => insertVariable(c)}
                                                            className="bg-slate-900 hover:bg-indigo-600/30 border border-white/5 hover:border-indigo-500/50 text-slate-300 hover:text-indigo-200 px-2 py-1 rounded-lg text-[9px] font-bold transition-all"
                                                        >
                                                            {c.replace(/_/g, ' ')} +
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div>
                                                <span className="text-[8px] text-slate-500 font-bold block mb-1">اطلاعات مالی و زمانی</span>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {['مبلغ_کل_قرارداد', 'مبلغ_پیش_پرداخت', 'مبلغ_تسویه_نهایی', 'تاریخ_شروع', 'تاریخ_پایان', 'مدت_قرارداد', 'جریمه_تاخیر_روزانه'].map(c => (
                                                        <button 
                                                            key={c} 
                                                            type="button"
                                                            onClick={() => insertVariable(c)}
                                                            className="bg-slate-900 hover:bg-emerald-600/30 border border-white/5 hover:border-emerald-500/50 text-slate-300 hover:text-emerald-200 px-2 py-1 rounded-lg text-[9px] font-bold transition-all"
                                                        >
                                                            {c.replace(/_/g, ' ')} +
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div>
                                                <span className="text-[8px] text-slate-500 font-bold block mb-1">جزئیات پروژه</span>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {['موضوع_قرارداد', 'نشانی_پروژه', 'شرط_داوری'].map(c => (
                                                        <button 
                                                            key={c} 
                                                            type="button"
                                                            onClick={() => insertVariable(c)}
                                                            className="bg-slate-900 hover:bg-teal-600/30 border border-white/5 hover:border-teal-500/50 text-slate-300 hover:text-teal-200 px-2 py-1 rounded-lg text-[9px] font-bold transition-all"
                                                        >
                                                            {c.replace(/_/g, ' ')} +
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Existing Custom Templates List */}
                                <div className="bg-slate-950 p-5 rounded-3xl border border-white/5 space-y-3 flex-1 flex flex-col min-h-[200px]">
                                    <h4 className="text-xs font-black text-white">📋 لیست قالب‌های سفارشی شما</h4>
                                    <div className="space-y-2 overflow-y-auto max-h-48 flex-1 custom-scrollbar pr-1">
                                        {customTemplates.map(tpl => {
                                            // Count variables inside this template
                                            const regex = /{{(.*?)}}/g;
                                            const vars: string[] = [];
                                            let match;
                                            while ((match = regex.exec(tpl.content)) !== null) {
                                                const v = match[1].trim();
                                                if (v && !vars.includes(v)) vars.push(v);
                                            }

                                            return (
                                                <div key={tpl.id} className="flex justify-between items-center bg-slate-900/60 p-3 rounded-2xl border border-white/5 hover:border-white/10 transition-all">
                                                    <div className="flex flex-col text-right">
                                                        <span className="text-white font-bold text-xs">{tpl.label}</span>
                                                        <span className="text-[8px] text-slate-500 mt-1 font-bold">
                                                            تعداد متغیرها: {toPersianDigits(vars.length.toString())} عدد {vars.length > 0 && `(${vars.slice(0, 3).join(', ')}${vars.length > 3 ? '...' : ''})`}
                                                        </span>
                                                    </div>
                                                    <button 
                                                        onClick={() => handleDeleteCustomTemplate(tpl.id)} 
                                                        className="text-rose-500 p-2 hover:bg-rose-500/10 rounded-xl transition-all"
                                                        title="حذف قالب"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                        {customTemplates.length === 0 && (
                                            <p className="text-slate-600 text-[10px] italic text-center py-8">هیچ قالب سفارشی ثبت نشده است.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- QUICK ADD PERSON/CUSTOMER MODAL --- */}
            {showAddPersonModal && (
                <div className="fixed inset-0 z-[1400] bg-black/80 backdrop-blur-md flex items-end md:items-center justify-center p-4 animate-fade-in" dir="rtl">
                    <div className="bg-slate-900 border border-white/10 w-full max-w-sm rounded-t-[2.5rem] md:rounded-[2.5rem] p-8 shadow-2xl">
                        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 md:hidden"></div>
                        <h3 className="text-lg font-black text-white mb-6 flex items-center gap-2">
                            <UserPlus className="text-teal-400" size={20}/> 
                            تعریف سریع شخص
                        </h3>
                        <div className="space-y-4">
                            <input className="w-full bg-slate-950 p-4 rounded-2xl border border-white/5 text-white font-bold outline-none focus:border-teal-500" placeholder="نام کامل..." value={newPersonName} onChange={e => setNewPersonName(e.target.value)} autoFocus />
                            <input className="w-full bg-slate-950 p-4 rounded-2xl border border-white/5 text-white font-mono outline-none focus:border-teal-500" placeholder="شماره تماس (اختیاری)" value={newPersonPhone} onChange={e => setNewPersonPhone(e.target.value)} />
                            <button onClick={handleQuickAddPerson} className="w-full bg-teal-600 hover:bg-teal-500 text-white py-4 rounded-2xl font-black shadow-xl active:scale-95">ذخیره و انتخاب</button>
                            <button onClick={() => setShowAddPersonModal(false)} className="w-full bg-slate-800 text-white py-3 rounded-2xl font-bold">انصراف</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Contracts;
