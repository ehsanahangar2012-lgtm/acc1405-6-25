import React, { useState, useMemo, useRef } from 'react';
import { 
    ShoppingBag, Search, Plus, Minus, Trash2, CheckCircle2, 
    User, Phone, DollarSign, PenTool, X, Sparkles, Filter, 
    Layers, Package, ArrowRight, Printer, Send, HelpCircle,
    ChevronDown, Smartphone, Tag, ShieldCheck, CheckSquare
} from 'lucide-react';
import { Product, Person, Invoice, InvoiceItem, InvoiceType } from '../types';
import { useStore } from '../store';
import { 
    formatCurrency, toPersianDigits, getPersianDate, 
    formatAmountOnly, isAndroidApp 
} from '../utils';
import { triggerDeviceSms } from '../services/smsGatewayService';

export const MobileCatalog: React.FC = () => {
    const { 
        products = [], 
        people = [], 
        addInvoice, 
        companies = [],
        config
    } = useStore();

    const persons = people;
    const company = (companies && companies.find(c => c.isActive)) || companies[0] || {
        id: 'default',
        name: 'مجموعه تجاری اشک قلم',
        phone: '۰۲۱',
        address: 'تهران، ایران',
        legalName: 'سامانه ابری اشک قلم',
        logo: null,
        stamp: null,
        signature: null,
        isActive: true
    };
    const currency: 'RIAL' | 'TOMAN' = config?.currency === 'TOMAN' ? 'TOMAN' : 'RIAL';
    const currencyLabel = currency === 'TOMAN' ? 'تومان' : 'ریال';

    const isAndroid = isAndroidApp();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [cart, setCart] = useState<{ product: Product; quantity: number; unitPrice: number; discount: number }[]>([]);
    const [selectedPersonId, setSelectedPersonId] = useState<string>('');
    const [discountOverall, setDiscountOverall] = useState<number>(0);
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CREDIT' | 'POS'>('CASH');
    const [notes, setNotes] = useState('');
    const [showCartDrawer, setShowCartDrawer] = useState(false);
    const [showSignaturePad, setShowSignaturePad] = useState(false);
    const [signatureData, setSignatureData] = useState<string>('');
    const [createdInvoice, setCreatedInvoice] = useState<Invoice | null>(null);
    const [showHelp, setShowHelp] = useState(false);

    // Canvas for signature
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    // Categories extraction
    const categories = useMemo(() => {
        const set = new Set<string>();
        products.forEach(p => {
            if (p.category) set.add(p.category);
        });
        return ['all', ...Array.from(set)];
    }, [products]);

    // Filtered products
    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = !searchQuery || 
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.code && p.code.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
            return matchesSearch && matchesCat;
        });
    }, [products, searchQuery, selectedCategory]);

    // Cart calculations
    const subTotal = useMemo(() => {
        return cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice) - item.discount, 0);
    }, [cart]);

    const totalQuantity = useMemo(() => {
        return cart.reduce((sum, item) => sum + item.quantity, 0);
    }, [cart]);

    const finalTotal = Math.max(0, subTotal - discountOverall);

    const addToCart = (product: Product) => {
        setCart(prev => {
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
                return prev.map(item => 
                    item.product.id === product.id 
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prev, {
                product,
                quantity: 1,
                unitPrice: product.sellPrice || 0,
                discount: 0
            }];
        });
    };

    const updateQuantity = (productId: string, delta: number) => {
        setCart(prev => {
            return prev
                .map(item => {
                    if (item.product.id === productId) {
                        const newQ = item.quantity + delta;
                        return newQ > 0 ? { ...item, quantity: newQ } : null;
                    }
                    return item;
                })
                .filter(Boolean) as typeof prev;
        });
    };

    const removeFromCart = (productId: string) => {
        setCart(prev => prev.filter(item => item.product.id !== productId));
    };

    // Signature Pad logic
    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        setIsDrawing(true);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
        const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
        const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#0f172a';
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setSignatureData('');
    };

    const saveSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dataUrl = canvas.toDataURL('image/png');
        setSignatureData(dataUrl);
        setShowSignaturePad(false);
    };

    // Handle checkout / invoice submission
    const handleCheckout = () => {
        if (cart.length === 0) {
            alert('سبد سفارش خالی است.');
            return;
        }

        const person = persons.find(p => p.id === selectedPersonId);

        const invoiceItems: InvoiceItem[] = cart.map((item) => {
            const buyPrice = item.product.buyPrice || 0;
            const total = (item.quantity * item.unitPrice) - item.discount;
            const profit = total - (item.quantity * buyPrice);
            return {
                productId: item.product.id,
                productName: item.product.name,
                quantity: item.quantity,
                buyPrice,
                unitPrice: item.unitPrice,
                total,
                profit
            };
        });

        const newInvoice: any = {
            type: InvoiceType.SALE,
            date: getPersianDate(),
            personId: selectedPersonId || undefined,
            personName: person ? person.name : 'مشتری حضوری ویزیتوری',
            items: invoiceItems,
            totalAmount: subTotal,
            subTotal: subTotal,
            discount: discountOverall,
            tax: 0,
            finalTotal: finalTotal,
            cashAmount: paymentMethod === 'CASH' || paymentMethod === 'POS' ? finalTotal : 0,
            description: (notes ? notes + '\n' : '') + `ثبت شده از طریق کاتالوگ همراه ویزیتوری (${paymentMethod === 'POS' ? 'کارتخوان' : paymentMethod === 'CASH' ? 'نقدی' : 'نسیه / اعتباری'})`,
            signature: signatureData || undefined,
            status: 'REGISTERED'
        };

        addInvoice(newInvoice);
        setCreatedInvoice(newInvoice);
        setCart([]);
        setSignatureData('');
        setNotes('');
        setShowCartDrawer(false);
    };

    const handleSendInvoiceSms = () => {
        if (!createdInvoice) return;
        const person = persons.find(p => p.id === createdInvoice.personId);
        const targetPhone = person?.phone || '';
        const msg = `مشتری گرامی ${createdInvoice.personName}\nفاکتور فروش شماره ${toPersianDigits(createdInvoice.number)} به مبلغ ${formatCurrency(createdInvoice.finalTotal, currency)} با موفقیت ثبت شد.\nباتشکر، ${company?.name || 'مجموعه اشک قلم'}`;
        triggerDeviceSms(targetPhone, msg);
    };

    return (
        <div className="space-y-6 pb-24 animate-fade-in" dir="rtl">
            {/* سربرگ ماژول ویزیتوری */}
            <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 border border-teal-500/20 p-5 md:p-7 rounded-[2.5rem] shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400">
                        <ShoppingBag size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl md:text-2xl font-black text-white">کاتالوگ تصویری و ویزیتوری همراه</h1>
                            <button
                                onClick={() => setShowHelp(!showHelp)}
                                className="p-1 text-slate-400 hover:text-teal-300 transition cursor-pointer"
                                title="راهنمای هوشمند"
                            >
                                <HelpCircle size={18} />
                            </button>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                            سفارش‌گیری سریع در محل مشتری، کنترل موجودی زنده و اخذ امضای لمسی خریدار
                        </p>
                    </div>
                </div>

                {/* دکمه باز کردن سبد خرید */}
                <button
                    onClick={() => setShowCartDrawer(true)}
                    className="relative flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-black text-xs shadow-lg shadow-teal-950/50 active:scale-95 transition cursor-pointer"
                >
                    <ShoppingBag size={18} />
                    <span>سبد سفارش ({toPersianDigits(totalQuantity)})</span>
                    {totalQuantity > 0 && (
                        <span className="font-mono text-xs bg-white/20 px-2 py-0.5 rounded-lg mr-1">
                            {formatAmountOnly(finalTotal, currency)} {currencyLabel}
                        </span>
                    )}
                </button>
            </div>

            {/* راهنمای هوشمند */}
            {showHelp && (
                <div className="bg-slate-900/90 border border-teal-500/30 p-5 rounded-3xl text-xs text-slate-300 space-y-2.5 animate-slide-down">
                    <h3 className="font-bold text-teal-400 flex items-center gap-2">
                        <Sparkles size={16} /> راهنمای کاربری ماژول ویزیتوری همراه:
                    </h3>
                    <p className="leading-relaxed">
                        • با استفاده از کاتالوگ تصویری، کالاها را با عکس، موجودی دقیق انبار و قیمت روز به مشتری نشان دهید.
                    </p>
                    <p className="leading-relaxed">
                        • با فشردن دکمه «+» کالا را به سبد سفارش اضافه کنید. در سبد سفارش می‌توانید مشتری را انتخاب نموده و با صفحه لمسی از مشتری امضا بگیرید.
                    </p>
                    <p className="leading-relaxed">
                        • فاکتور بلافاصله در سیستم ثبت شده و پیامک تأییدیه با سیم‌کارت گوشی برای مشتری ارسال خواهد شد.
                    </p>
                </div>
            )}

            {/* نوار جستجو و فیلتر دسته‌بندی */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="جستجوی نام کالا، کد یا بارکد..."
                        className="w-full bg-slate-900/80 border border-slate-700/80 rounded-2xl py-3.5 pr-11 pl-4 text-xs md:text-sm text-white outline-none focus:border-teal-500 transition shadow-inner"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                {/* دسته‌بندی‌ها */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none shrink-0">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-4 py-3 rounded-2xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                                selectedCategory === cat
                                    ? 'bg-teal-600 text-white shadow-md shadow-teal-900/40'
                                    : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                        >
                            {cat === 'all' ? 'همه کالاها' : cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* شبکه نمایش کاتالوگ تصویری */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts.length === 0 ? (
                    <div className="col-span-full text-center py-16 bg-slate-900/40 rounded-3xl border border-slate-800 space-y-2">
                        <Package size={40} className="mx-auto text-slate-600 opacity-60" />
                        <p className="text-xs text-slate-400">هیچ کالایی با این مشخصات یافت نشد.</p>
                    </div>
                ) : (
                    filteredProducts.map(prod => {
                        const inCartItem = cart.find(c => c.product.id === prod.id);
                        const qtyInCart = inCartItem?.quantity || 0;
                        const hasStock = (prod.stock || 0) > 0;

                        return (
                            <div 
                                key={prod.id}
                                className="bg-slate-900/80 border border-slate-800 hover:border-teal-500/40 rounded-3xl p-4 flex flex-col justify-between space-y-3 transition-all duration-200 shadow-lg group relative overflow-hidden"
                            >
                                {/* بج دسته‌بندی یا تخفیف */}
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold px-2.5 py-1 bg-slate-800 text-slate-400 rounded-lg">
                                        {prod.category || 'کالای عمومی'}
                                    </span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                        hasStock ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                    }`}>
                                        موجودی: {toPersianDigits(prod.stock || 0)} {prod.unit || 'عدد'}
                                    </span>
                                </div>

                                {/* تصویر محصول */}
                                <div className="w-full h-36 bg-slate-950/60 rounded-2xl flex items-center justify-center border border-white/5 overflow-hidden group-hover:border-teal-500/20 transition">
                                    {prod.imageUrl ? (
                                        <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="text-center text-slate-600 space-y-1">
                                            <Package size={36} className="mx-auto text-teal-400/40" />
                                            <span className="text-[10px] font-mono text-slate-500 block">
                                                {prod.code || 'PRD'}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* نام و مشخصات */}
                                <div className="space-y-1">
                                    <h3 className="text-sm font-black text-white line-clamp-1">{prod.name}</h3>
                                    {prod.code && (
                                        <span className="text-[10px] text-slate-400 font-mono block">
                                            کد کالا: {toPersianDigits(prod.code)}
                                        </span>
                                    )}
                                </div>

                                {/* قیمت و دکمه افزودن */}
                                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                                    <div>
                                        <span className="text-[10px] text-slate-400 block">قیمت فروش:</span>
                                        <span className="text-xs font-black text-teal-300 font-mono">
                                            {formatAmountOnly(prod.sellPrice || 0, currency)} {currencyLabel}
                                        </span>
                                    </div>

                                    {qtyInCart === 0 ? (
                                        <button
                                            type="button"
                                            onClick={() => addToCart(prod)}
                                            className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 active:scale-95 text-white text-xs font-black flex items-center gap-1 shadow-md shadow-teal-950 transition cursor-pointer"
                                        >
                                            <Plus size={15} />
                                            <span>سفارش</span>
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-teal-500/30">
                                            <button
                                                onClick={() => updateQuantity(prod.id, 1)}
                                                className="w-7 h-7 bg-teal-600 hover:bg-teal-500 text-white rounded-lg flex items-center justify-center active:scale-90 transition cursor-pointer"
                                            >
                                                <Plus size={14} />
                                            </button>
                                            <span className="w-7 text-center text-xs font-black text-white font-mono">
                                                {toPersianDigits(qtyInCart)}
                                            </span>
                                            <button
                                                onClick={() => updateQuantity(prod.id, -1)}
                                                className="w-7 h-7 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-lg flex items-center justify-center active:scale-90 transition cursor-pointer"
                                            >
                                                <Minus size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* دراور سبد سفارش و نهایی‌سازی فاکتور */}
            {showCartDrawer && (
                <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-md flex justify-end animate-fade-in" dir="rtl">
                    <div className="bg-slate-900 border-r border-slate-700 w-full max-w-lg h-full flex flex-col shadow-2xl p-5 space-y-4 overflow-hidden">
                        {/* Drawer Header */}
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-teal-500/20 text-teal-400 rounded-xl">
                                    <ShoppingBag size={20} />
                                </div>
                                <h3 className="text-base font-black text-white">سبد سفارش مشتری ({toPersianDigits(totalQuantity)})</h3>
                            </div>
                            <button
                                onClick={() => setShowCartDrawer(false)}
                                className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Drawer Content */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
                            {/* اقلام سبد */}
                            <div className="space-y-2">
                                {cart.length === 0 ? (
                                    <p className="text-center py-8 text-slate-500 text-xs">سبد سفارش خالی است.</p>
                                ) : (
                                    cart.map(item => (
                                        <div key={item.product.id} className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 flex items-center justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-xs font-black text-white truncate">{item.product.name}</h4>
                                                <span className="text-[10px] text-teal-400 font-mono">
                                                    {formatAmountOnly(item.unitPrice, currency)} {currencyLabel}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-700">
                                                <button
                                                    onClick={() => updateQuantity(item.product.id, 1)}
                                                    className="w-6 h-6 bg-teal-600 text-white rounded-lg flex items-center justify-center"
                                                >
                                                    <Plus size={12} />
                                                </button>
                                                <span className="w-6 text-center text-xs font-bold text-white font-mono">
                                                    {toPersianDigits(item.quantity)}
                                                </span>
                                                <button
                                                    onClick={() => updateQuantity(item.product.id, -1)}
                                                    className="w-6 h-6 bg-slate-800 text-slate-300 rounded-lg flex items-center justify-center"
                                                >
                                                    <Minus size={12} />
                                                </button>
                                            </div>

                                            <span className="text-xs font-black text-white font-mono w-24 text-left">
                                                {formatAmountOnly(item.quantity * item.unitPrice, currency)}
                                            </span>

                                            <button
                                                onClick={() => removeFromCart(item.product.id)}
                                                className="p-1.5 text-slate-500 hover:text-rose-400"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* فرم اطلاعات سفارش */}
                            <div className="space-y-3 pt-3 border-t border-slate-800">
                                <div>
                                    <label className="text-[11px] text-slate-300 font-bold block mb-1">انتخاب طرف‌حساب / خریدار:</label>
                                    <select
                                        value={selectedPersonId}
                                        onChange={e => setSelectedPersonId(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white outline-none focus:border-teal-500"
                                    >
                                        <option value="">-- مشتری حضوری عمومی --</option>
                                        {persons.map(p => (
                                            <option key={p.id} value={p.id}>{p.name} {p.phone ? `(${toPersianDigits(p.phone)})` : ''}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[11px] text-slate-300 font-bold block mb-1">نحوه تسویه:</label>
                                        <select
                                            value={paymentMethod}
                                            onChange={e => setPaymentMethod(e.target.value as any)}
                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white outline-none focus:border-teal-500"
                                        >
                                            <option value="CASH">نقدی</option>
                                            <option value="POS">کارتخوان POS</option>
                                            <option value="CREDIT">نسیه / اعتباری</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[11px] text-slate-300 font-bold block mb-1">تخفیف کلی ({currencyLabel}):</label>
                                        <input
                                            type="number"
                                            value={discountOverall || ''}
                                            onChange={e => setDiscountOverall(Number(e.target.value) || 0)}
                                            placeholder="0"
                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono outline-none focus:border-teal-500"
                                        />
                                    </div>
                                </div>

                                {/* امضای لمسی خریدار */}
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-[11px] text-slate-300 font-bold">امضای لمسی خریدار:</label>
                                        <button
                                            type="button"
                                            onClick={() => setShowSignaturePad(true)}
                                            className="text-[11px] text-teal-400 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                                        >
                                            <PenTool size={13} />
                                            <span>{signatureData ? 'تغییر امضا' : 'اخذ امضای مشتری'}</span>
                                        </button>
                                    </div>
                                    {signatureData ? (
                                        <div className="bg-white p-2 rounded-xl border border-slate-300 flex items-center justify-between">
                                            <img src={signatureData} alt="امضا" className="h-10 object-contain" />
                                            <button
                                                type="button"
                                                onClick={() => setSignatureData('')}
                                                className="text-xs text-rose-500 hover:text-rose-700"
                                            >
                                                حذف
                                            </button>
                                        </div>
                                    ) : (
                                        <div 
                                            onClick={() => setShowSignaturePad(true)}
                                            className="p-3 bg-slate-950/60 border border-dashed border-slate-700 rounded-xl text-center text-slate-400 text-xs cursor-pointer hover:border-teal-500"
                                        >
                                            برای ثبت امضای خریدار روی صفحه لمسی کلیک کنید
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="text-[11px] text-slate-300 font-bold block mb-1">یادداشت سفارش:</label>
                                    <textarea
                                        rows={2}
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                        placeholder="توضیحات تحویل یا شرایط سفارش..."
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white outline-none focus:border-teal-500 resize-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Drawer Footer / Checkout Button */}
                        <div className="pt-3 border-t border-slate-800 space-y-3 shrink-0">
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-bold text-slate-300">مبلغ نهایی قابل پرداخت:</span>
                                <span className="font-black text-teal-400 font-mono text-base">
                                    {formatCurrency(finalTotal, currency)}
                                </span>
                            </div>

                            <button
                                type="button"
                                onClick={handleCheckout}
                                disabled={cart.length === 0}
                                className="w-full py-3.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 disabled:opacity-40 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-teal-950/60 active:scale-95 transition cursor-pointer"
                            >
                                <CheckSquare size={18} />
                                <span>ثبت نهایی و صدور فاکتور رسمی</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* مودال امضای لمسی خریدار روی تبلت / گوشی */}
            {showSignaturePad && (
                <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4" dir="rtl">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <h3 className="text-sm font-black text-white flex items-center gap-2">
                                <PenTool size={18} className="text-teal-400" />
                                <span>امضای لمسی خریدار پای فاکتور</span>
                            </h3>
                            <button onClick={() => setShowSignaturePad(false)} className="text-slate-400 hover:text-white">
                                <X size={18} />
                            </button>
                        </div>

                        <p className="text-xs text-slate-400">
                            لطفاً با انگشت یا قلم نوری روی کادر زیر امضا فرمایید:
                        </p>

                        <div className="bg-white rounded-2xl border-2 border-dashed border-teal-500/50 overflow-hidden shadow-inner touch-none">
                            <canvas
                                ref={canvasRef}
                                width={380}
                                height={180}
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                                className="w-full h-[180px] cursor-crosshair"
                            />
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <button
                                type="button"
                                onClick={clearCanvas}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-rose-400 rounded-xl text-xs font-bold transition"
                            >
                                پاک کردن
                            </button>

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowSignaturePad(false)}
                                    className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
                                >
                                    انصراف
                                </button>
                                <button
                                    type="button"
                                    onClick={saveSignature}
                                    className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-black shadow-md shadow-teal-900/40"
                                >
                                    تأیید و ذخیره امضا
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* پیام موفقیت ثبت فاکتور */}
            {createdInvoice && (
                <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-scale-in" dir="rtl">
                    <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 max-w-md w-full shadow-2xl text-center space-y-4">
                        <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-3xl mx-auto flex items-center justify-center border border-emerald-500/30">
                            <CheckCircle2 size={36} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-white">فاکتور با موفقیت ثبت گردید!</h3>
                            <p className="text-xs text-slate-300 mt-1">
                                فاکتور شماره {(createdInvoice.prefix || '') + toPersianDigits(createdInvoice.number)} به مبلغ {formatCurrency(createdInvoice.finalTotal)} در سیستم درج شد.
                            </p>
                        </div>

                        <div className="space-y-2 pt-2">
                            {persons.find(p => p.id === createdInvoice.personId)?.phone && (
                                <button
                                    type="button"
                                    onClick={handleSendInvoiceSms}
                                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 transition cursor-pointer"
                                >
                                    <Smartphone size={16} />
                                    <span>ارسال پیامک فاکتور به مشتری ({toPersianDigits(persons.find(p => p.id === createdInvoice.personId)?.phone || '')})</span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => setCreatedInvoice(null)}
                                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl text-xs font-bold transition cursor-pointer"
                            >
                                بازگشت به کاتالوگ
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MobileCatalog;
