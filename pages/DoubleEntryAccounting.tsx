import { useState } from 'react';
import { useFinancialStore } from '../store-financial';
import { 
  BookOpen, Plus, TrendingUp, FileText, ShieldAlert, 
  CheckCircle2, AlertTriangle, Activity, Check, HelpCircle 
} from 'lucide-react';
import { getPersianDate } from '../utils';

export default function DoubleEntryAccounting() {
  const {
    accountingEntries,
    chartOfAccounts,
    addAccountingEntry,
    addChartOfAccount,
    getTrialBalance,
    validateTrialBalance,
    runConsistencyChecks,
    getBalanceSheet,
    getIncomeStatement
  } = useFinancialStore();

  const [showAddEntry, setShowAddEntry] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [activeTab, setActiveTab] = useState<'entries' | 'accounts' | 'trial' | 'reports' | 'audit'>('entries');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [newEntry, setNewEntry] = useState({
    date: getPersianDate(),
    description: '',
    debitAccountId: '',
    creditAccountId: '',
    amount: 0
  });

  const [newAccount, setNewAccount] = useState({
    id: '',
    code: '',
    name: '',
    type: 'ASSET' as const,
    level: 'DETAIL' as const,
    parentId: '',
    isActive: true
  });

  const handleAddEntry = () => {
    if (newEntry.debitAccountId && newEntry.creditAccountId && newEntry.amount > 0) {
      try {
        setErrorMessage(null);
        addAccountingEntry(newEntry);
        setNewEntry({ date: getPersianDate(), description: '', debitAccountId: '', creditAccountId: '', amount: 0 });
        setShowAddEntry(false);
      } catch (err: any) {
        setErrorMessage(err.message);
      }
    } else {
      setErrorMessage('لطفاً تمامی فیلدها را با مقادیر معتبر پر کنید.');
    }
  };

  const handleAddAccount = () => {
    if (newAccount.code && newAccount.name) {
      addChartOfAccount({
        ...newAccount,
        id: newAccount.code // Use code as ID for simplicity and matching chartOfAccounts standards
      });
      setNewAccount({ id: '', code: '', name: '', type: 'ASSET', level: 'DETAIL', parentId: '', isActive: true });
      setShowAddAccount(false);
    }
  };

  const trialBalance = getTrialBalance();
  const balanceSheet = getBalanceSheet(getPersianDate());
  const trialValidation = validateTrialBalance();
  const consistencyAlerts = runConsistencyChecks();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400 border border-blue-500/20 shadow-md">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">حسابداری دوطرفه (دفتر کل کلان)</h1>
            <p className="text-xs text-slate-400 mt-1">مدیریت سندهای حسابداری، کدهای معین و ممیزی سلامت اطلاعات مالی</p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => {
              setErrorMessage(null);
              setShowAddEntry(true);
            }}
            className="flex-1 sm:flex-initial px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 border border-blue-500/20 shadow-lg text-sm"
          >
            <Plus className="w-4 h-4" />
            ثبت سند دستی
          </button>
          <button
            onClick={() => setShowAddAccount(true)}
            className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 border border-white/5 shadow-md text-sm"
          >
            <Plus className="w-4 h-4" />
            افزودن حساب به کدینگ
          </button>
        </div>
      </div>

      {/* Trial Balance Health Overview Banner */}
      <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-inner ${
        trialValidation.isBalanced 
          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
          : 'bg-red-500/10 border-red-500/20 text-red-400'
      }`}>
        <div className="flex items-center gap-3">
          {trialValidation.isBalanced ? (
            <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
          ) : (
            <ShieldAlert className="w-6 h-6 flex-shrink-0" />
          )}
          <div>
            <span className="font-black text-sm">وضعیت تعادل تراز آزمایشی: </span>
            <span className="text-xs">
              {trialValidation.isBalanced 
                ? 'مجموع اقلام بدهکار و بستانکار دفاتر کل متعادل است.' 
                : 'دفاتر کل نامتوازن هستند! اختلاف محاسباتی در سندها وجود دارد.'}
            </span>
          </div>
        </div>
        <div className="text-left font-mono text-xs">
          <span>اختلاف تراز: {trialValidation.difference.toLocaleString()} ریال</span>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex gap-2 overflow-x-auto border-b border-white/10 pb-px">
        {[
          { key: 'entries', label: 'اسناد حسابداری', icon: FileText },
          { key: 'accounts', label: 'کدینگ حسابها (COA)', icon: BookOpen },
          { key: 'trial', label: 'تراز آزمایشی ماهانه', icon: TrendingUp },
          { key: 'audit', label: 'یکپارچگی و سلامت مالی', icon: Activity },
          { key: 'reports', label: 'ترازنامه و سود و زیان', icon: FileText }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2.5 flex items-center gap-2 border-b-2 transition-all font-bold text-xs whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-blue-500 text-blue-400 bg-blue-500/10 rounded-t-xl'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: اسناد حسابداری */}
      {activeTab === 'entries' && (
        <div className="bg-slate-950/40 border border-white/5 rounded-3xl p-6 shadow-2xl space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-black text-white">دفتر روزنامه اسناد حسابداری</h2>
            <span className="text-xs text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-white/5">
              تعداد کل آرتیکل‌ها: {accountingEntries.length} ردیف
            </span>
          </div>
          
          <div className="overflow-x-auto rounded-2xl border border-white/5">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-900 border-b border-white/10 text-slate-300 text-xs font-black">
                  <th className="p-4">شناسه سند</th>
                  <th className="p-4">تاریخ</th>
                  <th className="p-4">شرح تراکنش</th>
                  <th className="p-4">حساب بدهکار (Debit)</th>
                  <th className="p-4">حساب بستانکار (Credit)</th>
                  <th className="p-4">مبلغ (ریال)</th>
                  <th className="p-4 text-center">وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300 text-xs font-medium">
                {accountingEntries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">سند حسابداری ثبت نشده است.</td>
                  </tr>
                ) : (
                  accountingEntries.map(entry => (
                    <tr key={entry.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="p-4 font-mono text-[10px] text-slate-500">{entry.id.slice(0, 8)}</td>
                      <td className="p-4">{entry.date}</td>
                      <td className="p-4 max-w-xs truncate" title={entry.description}>{entry.description}</td>
                      <td className="p-4 text-emerald-400 font-bold">
                        {chartOfAccounts.find(a => a.id === entry.debitAccountId)?.name || `کد ${entry.debitAccountId}`}
                      </td>
                      <td className="p-4 text-rose-400 font-bold">
                        {chartOfAccounts.find(a => a.id === entry.creditAccountId)?.name || `کد ${entry.creditAccountId}`}
                      </td>
                      <td className="p-4 font-mono font-black">{entry.amount.toLocaleString()}</td>
                      <td className="p-4 text-center">
                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 font-bold text-[10px]">
                          تأیید شده و قطعی
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2 p-4 bg-slate-900/40 rounded-2xl border border-white/5 text-[11px] text-slate-400">
            <Check className="text-emerald-400" size={16} />
            <span>توجه: بر اساس قوانین استانداردهای حسابداری، اسناد دفتر روزنامه سیستم <strong>غیرقابل حذف و غیرقابل تغییر (Immutable)</strong> هستند. برای اصلاح خطا از سند اصلاحی-برگشتی (استورنو) استفاده می‌شود.</span>
          </div>
        </div>
      )}

      {/* Tab: کدینگ حسابها */}
      {activeTab === 'accounts' && (
        <div className="bg-slate-950/40 border border-white/5 rounded-3xl p-6 shadow-2xl space-y-4">
          <h2 className="text-lg font-black text-white">درخت‌واره کدینگ حساب‌های دفتر کل و معین</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const).map(type => (
              <div key={type} className="border border-white/5 rounded-2xl p-4 bg-slate-900/40 shadow-md flex flex-col justify-between">
                <h3 className="font-black text-sm text-slate-200 border-b border-white/5 pb-2 mb-3">
                  {type === 'ASSET' ? 'دارایی‌ها (Assets)' :
                   type === 'LIABILITY' ? 'بدهی‌ها (Liabilities)' :
                   type === 'EQUITY' ? 'حقوق صاحبان سهام (Equity)' :
                   type === 'REVENUE' ? 'درآمدها (Revenues)' : 'هزینه‌ها (Expenses)'}
                </h3>
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                  {chartOfAccounts
                    .filter(a => a.type === type)
                    .map(account => (
                      <div key={account.id} className="flex justify-between items-center p-2 bg-slate-950/30 rounded-xl hover:bg-slate-800/20 transition-all text-xs text-slate-300">
                        <span className="font-bold">{account.name}</span>
                        <span className="font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded-md text-[10px]">{account.code}</span>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: تراز آزمایشی */}
      {activeTab === 'trial' && (
        <div className="bg-slate-950/40 border border-white/5 rounded-3xl p-6 shadow-2xl space-y-4">
          <h2 className="text-lg font-black text-white">جدول تراز آزمایشی چهارستونی دفاتر</h2>
          <div className="overflow-x-auto rounded-2xl border border-white/5">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-900 border-b border-white/10 text-slate-300 text-xs font-black">
                  <th className="p-4">کد حساب</th>
                  <th className="p-4">عنوان حساب دفتر کل/معین</th>
                  <th className="p-4">گردش بدهکار (ریال)</th>
                  <th className="p-4">گردش بستانکار (ریال)</th>
                  <th className="p-4">مانده بدهکار</th>
                  <th className="p-4">مانده بستانکار</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300 text-xs font-medium">
                {trialBalance.map(item => {
                  const isDebit = item.balance >= 0;
                  return (
                    <tr key={item.accountId} className="hover:bg-slate-900/50 transition-colors">
                      <td className="p-4 font-mono text-slate-500 font-bold">{item.accountId}</td>
                      <td className="p-4 font-black">{item.accountName}</td>
                      <td className="p-4 font-mono">{item.debit.toLocaleString()}</td>
                      <td className="p-4 font-mono">{item.credit.toLocaleString()}</td>
                      <td className="p-4 font-mono text-emerald-400 font-bold">
                        {isDebit ? item.balance.toLocaleString() : '۰'}
                      </td>
                      <td className="p-4 font-mono text-rose-400 font-bold">
                        {!isDebit ? Math.abs(item.balance).toLocaleString() : '۰'}
                      </td>
                    </tr>
                  );
                })}
                {/* Total row */}
                <tr className="bg-slate-900 font-black border-t-2 border-white/10">
                  <td colSpan={2} className="p-4 text-left">جمع کل تراز:</td>
                  <td className="p-4 font-mono">{trialValidation.totalDebit.toLocaleString()}</td>
                  <td className="p-4 font-mono">{trialValidation.totalCredit.toLocaleString()}</td>
                  <td className="p-4 font-mono text-emerald-400">{trialValidation.totalDebit.toLocaleString()}</td>
                  <td className="p-4 font-mono text-rose-400">{trialValidation.totalCredit.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: بررسی سلامت و یکپارچگی */}
      {activeTab === 'audit' && (
        <div className="bg-slate-950/40 border border-white/5 rounded-3xl p-6 shadow-2xl space-y-6">
          <div>
            <h2 className="text-lg font-black text-white">ممیزی هوشمند و کنترل‌های انطباق مالی (Internal Audit)</h2>
            <p className="text-xs text-slate-400 mt-1">شناسایی خودکار رکوردهای یتیم، انحرافات حسابهای معین با دفتر کل و مغایرت‌ها</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Stat 1 */}
            <div className="bg-slate-900/60 p-5 rounded-2xl border border-white/5 shadow-md flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-bold">تعداد هشدارهای یکپارچگی</span>
                <h4 className="text-2xl font-black text-white mt-1">{consistencyAlerts.length} مورد</h4>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner ${
                consistencyAlerts.length === 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}>
                <ShieldAlert size={20} />
              </div>
            </div>

            {/* Stat 2 */}
            <div className="bg-slate-900/60 p-5 rounded-2xl border border-white/5 shadow-md flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-bold">مجموع گردش کل</span>
                <h4 className="text-xl font-black text-white mt-1">{trialValidation.totalDebit.toLocaleString()} ریال</h4>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-inner">
                <TrendingUp size={20} />
              </div>
            </div>

            {/* Stat 3 */}
            <div className="bg-slate-900/60 p-5 rounded-2xl border border-white/5 shadow-md flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-bold">مغایرت تراز کلان</span>
                <h4 className="text-xl font-black text-white mt-1">{Math.abs(trialValidation.difference).toLocaleString()} ریال</h4>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner ${
                trialValidation.isBalanced ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
              }`}>
                {trialValidation.isBalanced ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-black text-white">جزئیات هشدارهای ممیزی و مغایرت‌گیری:</h3>
            
            {consistencyAlerts.length === 0 ? (
              <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-4 text-emerald-400">
                <CheckCircle2 size={28} className="flex-shrink-0" />
                <div className="text-xs">
                  <h4 className="font-black">کیفیت و سلامت دفاتر حسابداری تأیید شد</h4>
                  <p className="mt-1 opacity-80">هیچ مغایرتی بین دفتر معین اشخاص (کاردکس) و مانده‌های دفتر کل کلان یافت نشد. همچنین هیچ رکورد بدون مرجعی وجود ندارد.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {consistencyAlerts.map((alert, index) => {
                  const isError = alert.severity === 'error';
                  const alertBg = isError ? 'bg-red-500/15 border-red-500/20 text-red-400' : 'bg-amber-500/15 border-amber-500/20 text-amber-400';
                  
                  return (
                    <div key={index} className={`p-4 rounded-xl border flex items-start gap-3 shadow-md ${alertBg}`}>
                      {isError ? (
                        <ShieldAlert size={20} className="flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" />
                      )}
                      <div className="text-xs space-y-1">
                        <span className="font-bold">[{alert.type}] </span>
                        <span>{alert.message}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: گزارشات مالی */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="bg-slate-950/40 border border-white/5 rounded-3xl p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-black text-white">ترازنامه مالی سود و زیان جاری</h2>
            <div className="grid md:grid-cols-3 gap-6">
              
              {/* Assets column */}
              <div className="border border-white/5 rounded-2xl p-4 bg-slate-900/40 shadow-md flex flex-col justify-between">
                <div>
                  <h3 className="font-black text-sm text-slate-200 border-b border-white/5 pb-2 mb-3">دارایی‌ها (تراز بدهکار)</h3>
                  <div className="space-y-2 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span>صندوق و بانک:</span>
                      <span>{(trialBalance.find(t=>t.accountId==='1110')?.balance || 0 + (trialBalance.find(t=>t.accountId==='1120')?.balance || 0)).toLocaleString()} ریال</span>
                    </div>
                    <div className="flex justify-between">
                      <span>حساب‌های دریافتنی:</span>
                      <span>{(trialBalance.find(t=>t.accountId==='1130')?.balance || 0).toLocaleString()} ریال</span>
                    </div>
                    <div className="flex justify-between">
                      <span>موجودی کالا:</span>
                      <span>{(trialBalance.find(t=>t.accountId==='1160')?.balance || 0).toLocaleString()} ریال</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between font-black border-t border-white/5 pt-2 mt-4 text-emerald-400 text-sm">
                  <span>جمع کل دارایی‌ها:</span>
                  <span>{balanceSheet.assets.total.toLocaleString()} ریال</span>
                </div>
              </div>

              {/* Liabilities column */}
              <div className="border border-white/5 rounded-2xl p-4 bg-slate-900/40 shadow-md flex flex-col justify-between">
                <div>
                  <h3 className="font-black text-sm text-slate-200 border-b border-white/5 pb-2 mb-3">بدهی‌ها (تراز بستانکار)</h3>
                  <div className="space-y-2 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span>حساب‌های پرداختنی (تامین‌کنندگان):</span>
                      <span>{(trialBalance.find(t=>t.accountId==='2110')?.balance || 0).toLocaleString()} ریال</span>
                    </div>
                    <div className="flex justify-between">
                      <span>اسناد پرداختنی (چک‌های صادرشده):</span>
                      <span>{(trialBalance.find(t=>t.accountId==='2130')?.balance || 0).toLocaleString()} ریال</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between font-black border-t border-white/5 pt-2 mt-4 text-rose-400 text-sm">
                  <span>جمع کل بدهی‌ها:</span>
                  <span>{balanceSheet.liabilities.total.toLocaleString()} ریال</span>
                </div>
              </div>

              {/* Equity column */}
              <div className="border border-white/5 rounded-2xl p-4 bg-slate-900/40 shadow-md flex flex-col justify-between">
                <div>
                  <h3 className="font-black text-sm text-slate-200 border-b border-white/5 pb-2 mb-3">حقوق صاحبان سهام</h3>
                  <div className="space-y-2 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span>سرمایه ثبتی:</span>
                      <span>{(trialBalance.find(t=>t.accountId==='3100')?.balance || 0).toLocaleString()} ریال</span>
                    </div>
                    <div className="flex justify-between">
                      <span>سود انباشته (سنواتی):</span>
                      <span>{(trialBalance.find(t=>t.accountId==='3200')?.balance || 0).toLocaleString()} ریال</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between font-black border-t border-white/5 pt-2 mt-4 text-purple-400 text-sm">
                  <span>جمع حقوق صاحبان سهام:</span>
                  <span>{balanceSheet.equity.total.toLocaleString()} ریال</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: ثبت سند جدید */}
      {showAddEntry && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-[2rem] p-6 w-full max-w-md shadow-2xl animate-scale-in">
            <h3 className="text-lg font-black text-white mb-4">ثبت سند روزنامه دستی</h3>
            
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle size={16} className="flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold pr-1">تاریخ سند</label>
                <input
                  type="text"
                  placeholder="1404/03/20"
                  value={newEntry.date}
                  onChange={e => setNewEntry({ ...newEntry, date: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-slate-200 text-xs outline-none focus:border-blue-500 font-bold text-center"
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold pr-1">شرح سند</label>
                <input
                  type="text"
                  placeholder="بابت آرتیکل مالی دستی..."
                  value={newEntry.description}
                  onChange={e => setNewEntry({ ...newEntry, description: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-slate-200 text-xs outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold pr-1">حساب بدهکار (Debit)</label>
                <select
                  value={newEntry.debitAccountId}
                  onChange={e => setNewEntry({ ...newEntry, debitAccountId: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-slate-200 text-xs outline-none focus:border-blue-500 font-bold"
                >
                  <option value="">انتخاب حساب بدهکار</option>
                  {chartOfAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold pr-1">حساب بستانکار (Credit)</label>
                <select
                  value={newEntry.creditAccountId}
                  onChange={e => setNewEntry({ ...newEntry, creditAccountId: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-slate-200 text-xs outline-none focus:border-blue-500 font-bold"
                >
                  <option value="">انتخاب حساب بستانکار</option>
                  {chartOfAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold pr-1">مبلغ سند (ریال)</label>
                <input
                  type="number"
                  placeholder="مبلغ به ریال"
                  value={newEntry.amount || ''}
                  onChange={e => setNewEntry({ ...newEntry, amount: Number(e.target.value) })}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-slate-200 text-xs outline-none focus:border-blue-500 font-bold text-center"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleAddEntry}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all text-xs border border-blue-500/20"
                >
                  ثبت سند و اعتبارسنجی
                </button>
                <button
                  onClick={() => {
                    setErrorMessage(null);
                    setShowAddEntry(false);
                  }}
                  className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all text-xs border border-white/5"
                >
                  انصراف
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: حساب جدید */}
      {showAddAccount && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-[2rem] p-6 w-full max-w-md shadow-2xl animate-scale-in">
            <h3 className="text-lg font-black text-white mb-4">افزودن حساب به کدینگ</h3>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold pr-1">کد حساب (یکتا)</label>
                <input
                  type="text"
                  placeholder="مثال: 1180"
                  value={newAccount.code}
                  onChange={e => setNewAccount({ ...newAccount, code: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-slate-200 text-xs outline-none focus:border-green-500 font-bold text-center"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold pr-1">عنوان حساب</label>
                <input
                  type="text"
                  placeholder="مثال: پیش‌پرداخت بیمه"
                  value={newAccount.name}
                  onChange={e => setNewAccount({ ...newAccount, name: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-slate-200 text-xs outline-none focus:border-green-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold pr-1">گروه حساب</label>
                <select
                  value={newAccount.type}
                  onChange={e => setNewAccount({ ...newAccount, type: e.target.value as any })}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-slate-200 text-xs outline-none focus:border-green-500 font-bold"
                >
                  <option value="ASSET">دارایی‌ها (Asset)</option>
                  <option value="LIABILITY">بدهی‌ها (Liability)</option>
                  <option value="EQUITY">حقوق صاحبان سهام (Equity)</option>
                  <option value="REVENUE">درآمدها (Revenue)</option>
                  <option value="EXPENSE">هزینه‌ها (Expense)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold pr-1">سطح حساب</label>
                <select
                  value={newAccount.level}
                  onChange={e => setNewAccount({ ...newAccount, level: e.target.value as any })}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-slate-200 text-xs outline-none focus:border-green-500 font-bold"
                >
                  <option value="DETAIL">تفصیلی (Detail)</option>
                  <option value="SUB">معین (Sub)</option>
                  <option value="MAIN">کل (Main)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleAddAccount}
                  className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold transition-all text-xs border border-green-500/20"
                >
                  افزودن حساب
                </button>
                <button
                  onClick={() => setShowAddAccount(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all text-xs border border-white/5"
                >
                  انصراف
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
