import { useState, useEffect } from 'react';
import { useFinancialStore } from '../store-financial';
import { DollarSign, RefreshCw, ArrowRightLeft, Info } from 'lucide-react';
import { exchangeRateService } from '../services/exchangeRateService';

export default function MultiCurrencyManagement() {
  const { currencies, updateExchangeRate } = useFinancialStore();
  const [editingCurrency, setEditingCurrency] = useState<string | null>(null);
  const [newRate, setNewRate] = useState(0);
  const [autoUpdating, setAutoUpdating] = useState(false);
  const [amount, setAmount] = useState('');
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('IRR');
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);

  useEffect(() => {
    // بروزرسانی خودکار هر ساعت
    const cleanup = exchangeRateService.startAutoUpdate((rates) => {
      updateExchangeRate('USD', rates.USD);
      updateExchangeRate('EUR', rates.EUR);
    }, 60);

    return cleanup;
  }, []);

  const handleManualUpdate = async () => {
    setAutoUpdating(true);
    const rates = await exchangeRateService.fetchRates();
    if (rates) {
      updateExchangeRate('USD', rates.USD);
      updateExchangeRate('EUR', rates.EUR);
    }
    setAutoUpdating(false);
  };

  const handleUpdateRate = (code: string) => {
    if (newRate > 0) {
      updateExchangeRate(code, newRate);
      setEditingCurrency(null);
      setNewRate(0);
    }
  };

  const handleConvert = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;

    const fromRate = currencies.find(c => c.code === fromCurrency)?.exchangeRate || 1;
    const toRate = currencies.find(c => c.code === toCurrency)?.exchangeRate || 1;
    
    const result = (amt * fromRate) / toRate;
    setConvertedAmount(result);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <DollarSign className="w-8 h-8 text-emerald-500" />
          <h1 className="text-2xl font-bold text-slate-100">مدیریت چند ارزی</h1>
        </div>
        <button
          onClick={handleManualUpdate}
          disabled={autoUpdating}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${autoUpdating ? 'animate-spin' : ''}`} />
          {autoUpdating ? 'در حال بروزرسانی...' : 'بروزرسانی آنلاین'}
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {currencies.map(currency => (
          <div key={currency.code} className="bg-slate-900/40 border border-white/5 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-lg text-slate-200">{currency.name}</h3>
                <div className="text-sm text-slate-400">{currency.code}</div>
              </div>
              <div className="text-3xl">{currency.symbol}</div>
            </div>

            {editingCurrency === currency.code ? (
              <div className="space-y-2">
                <input
                  type="number"
                  value={newRate || ''}
                  onChange={e => setNewRate(Number(e.target.value))}
                  placeholder="نرخ جدید"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 placeholder-slate-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdateRate(currency.code)}
                    className="flex-1 px-3 py-1 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700"
                  >
                    ذخیره
                  </button>
                  <button
                    onClick={() => setEditingCurrency(null)}
                    className="flex-1 px-3 py-1 bg-gray-300 rounded text-sm hover:bg-gray-400"
                  >
                    انصراف
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <div className="text-sm text-slate-400 mb-1">نرخ تبدیل به ریال</div>
                  <div className="text-2xl font-bold text-emerald-600">
                    {currency.exchangeRate.toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                  <span>آخرین بروزرسانی:</span>
                  <span>{currency.lastUpdated}</span>
                </div>
                <button
                  onClick={() => {
                    setEditingCurrency(currency.code);
                    setNewRate(currency.exchangeRate);
                  }}
                  className="w-full px-3 py-2 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  بروزرسانی نرخ
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 bg-slate-900/40 border border-white/5 rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <ArrowRightLeft className="w-5 h-5 text-emerald-500" />
          <h2 className="text-xl font-bold text-slate-100">تبدیل ارز</h2>
        </div>
        <div className="grid md:grid-cols-4 gap-4">
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="مبلغ"
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 placeholder-slate-500"
          />
          <select 
            value={fromCurrency}
            onChange={e => setFromCurrency(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
          >
            {currencies.map(c => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
          <select 
            value={toCurrency}
            onChange={e => setToCurrency(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
          >
            {currencies.map(c => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
          <button 
            onClick={handleConvert}
            className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
          >
            تبدیل
          </button>
        </div>
        {convertedAmount !== null && (
          <div className="mt-4 p-4 bg-emerald-900/20 border border-emerald-500/30 rounded-lg">
            <div className="text-center">
              <div className="text-sm text-slate-400 mb-1">نتیجه تبدیل:</div>
              <div className="text-2xl font-bold text-emerald-400">
                {convertedAmount.toLocaleString('fa-IR', { maximumFractionDigits: 2 })}
              </div>
              <div className="text-sm text-slate-500 mt-1">
                {currencies.find(c => c.code === toCurrency)?.name}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 bg-blue-900/20 border border-blue-500/30 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-slate-300 space-y-2 text-sm">
            <p className="font-semibold text-blue-400">راهنما و توضیحات:</p>
            <ul className="list-disc list-inside space-y-1 text-slate-400">
              <li>نرخ‌های نمایش داده شده از API بین‌المللی دریافت می‌شود و ممکن است با نرخ بازار آزاد ایران متفاوت باشد</li>
              <li>برای استفاده از نرخ بازار آزاد، می‌توانید نرخ‌ها را به صورت دستی بروزرسانی کنید</li>
              <li>دکمه "بروزرسانی نرخ" در هر کارت ارز، امکان ویرایش دستی نرخ را فراهم می‌کند</li>
              <li>سیستم هر ساعت به صورت خودکار نرخ‌ها را بروزرسانی می‌کند</li>
              <li>برای تبدیل ارز، مبلغ را وارد کرده و ارز مبدا و مقصد را انتخاب کنید</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
