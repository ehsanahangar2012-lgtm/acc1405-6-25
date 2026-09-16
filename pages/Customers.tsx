import React, { useState, useMemo, useRef } from 'react';
import { useStore } from '../store';
import { Person, Transaction, Voucher, CompanyProfile } from '../types';
import { generateId, toPersianDigits, formatCurrency, getNextCustomerCode } from '../utils';
import { Users, UserPlus, Phone, Tag, Search, ChevronLeft, Trash2, ArrowRightLeft, ShoppingBag, Eye, X, ClipboardCheck, AlertTriangle, List, LayoutGrid, Printer, Share2, Wallet, PlusCircle, MinusCircle, FileText, Package, CreditCard, ChevronDown, ChevronUp, Clock, Info, Download, FileSpreadsheet, ArrowLeft, Camera } from 'lucide-react';
import { ConfirmModal, useKeyboardShortcut } from '../components/Shared';
import ExcelImport from '../components/ExcelImport';
import { PersonLedger } from '../components/PersonLedger';
import PersonLedgerService from '../services/personLedgerService';
import * as XLSX from 'xlsx';
import { CardexPrint } from '../components/CardexPrint';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import { generatePdfBlob, downloadPdfBlob } from '../utils';

const CATEGORIES = ['مشتری عادی', 'مشتری VIP', 'تامینکننده عمده', 'همکار', 'سایر'];

const Customers = () => {
  const { people, addPerson, updatePerson, deletePerson, transactions, vouchers, companies } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [showExcelImport, setShowExcelImport] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('همه');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [newPerson, setNewPerson] = useState<Partial<Person>>({ isCustomer: true, category: CATEGORIES[0], name: '', phone: '', nationalId: '' });
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  
  // Canva Cardex Print Preview States
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printTheme, setPrintTheme] = useState<'modern' | 'minimal' | 'teal' | 'navy'>('modern');
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [downloadingImage, setDownloadingImage] = useState(false);
  const cardexRef = useRef<HTMLDivElement>(null);
  
  React.useEffect(() => {
      // بررسی پارامترهای آدرس برای اکشن ثبت سریع شخص
      const hash = window.location.hash;
      const queryIndex = hash.indexOf('?');
      if (queryIndex !== -1) {
          const queryString = hash.slice(queryIndex);
          const params = new URLSearchParams(queryString);
          const action = params.get('action');
          if (action === 'new-person') {
              setSelectedPersonId(null);
              setShowAdd(true);
              window.location.hash = hash.slice(0, queryIndex);
          }
      }
  }, []);

  const handleAdd = () => {
      if (newPerson.name) {
          if (editingPerson) {
              updatePerson(editingPerson.id, newPerson);
              setEditingPerson(null);
          } else {
              addPerson({ 
                  id: generateId(), 
                  balance: 0, 
                  code: getNextCustomerCode(people), 
                  category: newPerson.category, 
                  isCustomer: true, 
                  ...newPerson 
              } as Person);
          }
          setShowAdd(false);
          setNewPerson({ isCustomer: true, category: CATEGORIES[0], name: '', phone: '', nationalId: '' });
      } else alert('نام شخص الزامی است.');
  };

  useKeyboardShortcut(['Alt', 'N'], () => setShowAdd(true));
  useKeyboardShortcut(['Escape'], () => { setShowAdd(false); setSelectedPersonId(null); });

  const filteredPeople = people.filter(p => (p.name.includes(searchTerm) || (p.phone && p.phone.includes(searchTerm))) && (categoryFilter === 'همه' || p.category === categoryFilter));
  const selectedPerson = people.find(p => p.id === selectedPersonId);
  
  // Prepare grouped entries for CardexPrint
  const printReport = useMemo(() => {
      if (!selectedPersonId) return { entries: [], totalDebit: 0, totalCredit: 0, finalBalance: 0 };
      const report = PersonLedgerService.getReport(selectedPersonId, '', '');
      
      const groupedEntries: any[] = [];
      const processedIds = new Set();
      
      report.entries.forEach(entry => {
          if (processedIds.has(entry.id)) return;
          
          if (entry.type === 'INVOICE') {
              groupedEntries.push({ ...entry, isParent: true });
              processedIds.add(entry.id);
              
              const related = report.entries.filter(e => 
                  e.relatedInvoiceId === entry.referenceId && e.id !== entry.id
              );
              
              related.forEach(r => {
                  groupedEntries.push({ ...r, isChild: true });
                  processedIds.add(r.id);
              });
          } else if (!entry.relatedInvoiceId) {
              groupedEntries.push(entry);
              processedIds.add(entry.id);
          }
      });
      
      return {
          entries: groupedEntries,
          totalDebit: report.totalDebit,
          totalCredit: report.totalCredit,
          finalBalance: report.finalBalance
      };
  }, [selectedPersonId, transactions]);

  const handleExportExcel = () => {
      if (!selectedPerson) return;
      
      const wb = XLSX.utils.book_new();
      const wsData: any[][] = [];
      
      wsData.push(['کاردکس جامع مالی اشخاص']);
      wsData.push([`نام: ${selectedPerson.name}`, `کد: ${selectedPerson.code}`, `مانده: ${formatCurrency(Math.abs(selectedPerson.balance))} ${selectedPerson.balance > 0 ? 'بدهکار' : selectedPerson.balance < 0 ? 'بستانکار' : 'تسویه'}`]);
      wsData.push([]);
      wsData.push(['تاریخ', 'نوع تراکنش', 'شرح تراکنش', 'شماره سند', 'بدهکار (+)', 'بستانکار (-)', 'مانده (الباقی)']);
      
      const ledger = PersonLedgerService.getLedger(selectedPerson.id);
      
      ledger.forEach(entry => {
          wsData.push([
              entry.date,
              entry.type === 'INVOICE' ? (entry.debit > 0 ? 'فاکتور فروش (+)' : 'فاکتور خرید (-)') :
              entry.type === 'PAYMENT' ? (entry.credit > 0 ? 'دریافت نقدی (+)' : 'پرداخت نقدی (-)') :
              entry.type === 'CHECK' ? (entry.credit > 0 ? 'چک دریافتی (+)' : 'چک پرداختی (-)') : 'سند حسابداری',
              entry.description,
              entry.referenceNumber || '',
              entry.debit > 0 ? entry.debit : 0,
              entry.credit > 0 ? entry.credit : 0,
              entry.balance
          ]);
      });
      
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      ws['!cols'] = [
          { wch: 12 },
          { wch: 18 },
          { wch: 40 },
          { wch: 15 },
          { wch: 15 },
          { wch: 15 },
          { wch: 15 }
      ];
      
      XLSX.utils.book_append_sheet(wb, ws, 'کاردکس');
      XLSX.writeFile(wb, `Cardex-${selectedPerson.name}.xlsx`);
  };

  const handleDownloadPDF = async () => {
      if (!cardexRef.current || !selectedPerson) return;
      setDownloadingPDF(true);
      try {
          const pdfBlob = await generatePdfBlob(cardexRef.current);
          downloadPdfBlob(pdfBlob, `کاردکس-${selectedPerson.name}-${toPersianDigits(new Date().toLocaleDateString('fa-IR'))}.pdf`);
      } catch (error) {
          console.error('Error generating PDF:', error);
          alert('خطا در دانلود PDF کاردکس.');
      } finally {
          setDownloadingPDF(false);
      }
  };

  const handleDownloadImage = async () => {
      if (!cardexRef.current || !selectedPerson) return;
      setDownloadingImage(true);
      try {
          const element = cardexRef.current;
          const originalShadow = element.style.boxShadow;
          element.style.boxShadow = 'none';

          const canvas = await html2canvas(element, {
              scale: 2,
              useCORS: true,
              backgroundColor: '#ffffff',
              width: element.scrollWidth,
              height: element.scrollHeight,
              scrollX: 0,
              scrollY: 0
          });
          element.style.boxShadow = originalShadow;

          const link = document.createElement('a');
          link.download = `کاردکس-${selectedPerson.name}-${toPersianDigits(new Date().toLocaleDateString('fa-IR'))}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
      } catch (error) {
          console.error('Error generating Image:', error);
          alert('خطا در دانلود تصویر کاردکس.');
      } finally {
          setDownloadingImage(false);
      }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
       <header className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900/60 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-white/5 shadow-2xl gap-4 no-print">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">کاردکس جامع اشخاص</h1>
          <p className="text-slate-400 text-sm mt-1 font-bold">پایش تراز مالی و تاریخچه حوالههای انبارداری</p>
        </div>
        <div className="flex gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-80 group">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-teal-400" size={20} />
                <input className="w-full bg-slate-950/50 border border-white/5 rounded-2xl py-4 pr-12 pl-4 text-white text-sm outline-none focus:border-teal-500 shadow-inner" placeholder="جستجوی نام یا تلفن..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div className="flex bg-slate-950/50 border border-white/5 rounded-2xl p-1">
                <button onClick={() => setViewMode('grid')} className={`p-3 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-teal-600 text-white' : 'text-slate-500'}`}><LayoutGrid size={20}/></button>
                <button onClick={() => setViewMode('list')} className={`p-3 rounded-xl transition-all ${viewMode === 'list' ? 'bg-teal-600 text-white' : 'text-slate-500'}`}><List size={20}/></button>
            </div>
            <button onClick={() => setShowExcelImport(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-4 rounded-2xl flex items-center gap-2 shadow-xl font-black active:scale-95 transition-all" title="ورود اکسل"><FileSpreadsheet size={20} /></button>
            <button onClick={() => setShowAdd(true)} className="bg-teal-600 hover:bg-teal-500 text-white px-8 py-4 rounded-2xl flex items-center gap-3 shadow-xl font-black active:scale-95 transition-all" title="شخص جدید (Alt+N)"><UserPlus size={24} /><span>شخص جدید</span></button>
        </div>
      </header>

      {selectedPersonId ? (
          <div className="space-y-6 animate-fade-in">
              <div className="bg-slate-900/60 backdrop-blur-2xl border border-white/5 rounded-[3rem] p-8 shadow-2xl no-print">
                  <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-6">
                          <button onClick={() => setSelectedPersonId(null)} className="p-4 bg-slate-800 rounded-2xl hover:bg-slate-700 transition-all"><ChevronLeft size={24} className="text-white"/></button>
                          <div>
                              <h2 className="text-3xl font-black text-white mb-2">{selectedPerson?.name}</h2>
                              <div className="flex gap-3">
                                  {selectedPerson?.phone && <span className="text-sm text-slate-400 flex items-center gap-2"><Phone size={14}/>{toPersianDigits(selectedPerson.phone)}</span>}
                                  <span className="text-xs bg-teal-500/10 text-teal-400 px-3 py-1 rounded-full border border-teal-500/10 font-black">{selectedPerson?.category}</span>
                              </div>
                          </div>
                      </div>
                      <div className="flex gap-3">
                          <button onClick={handleExportExcel} className="p-4 bg-emerald-600 rounded-2xl hover:bg-emerald-500 transition-all" title="خروجی Excel"><FileSpreadsheet size={20} className="text-white"/></button>
                          <button onClick={() => setShowPrintPreview(true)} className="p-4 bg-purple-600 rounded-2xl hover:bg-purple-500 transition-all shadow-lg active:scale-95" title="چاپ کاردکس (تم Canva)"><Printer size={20} className="text-white"/></button>
                      </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                      <div className="bg-black/20 p-6 rounded-2xl border border-white/5">
                          <span className="text-xs text-slate-500 uppercase tracking-widest block mb-2">مانده حساب</span>
                          <span className={`text-3xl font-black font-mono ${selectedPerson && selectedPerson.balance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{formatCurrency(Math.abs(selectedPerson?.balance || 0))}</span>
                      </div>
                      <div className="bg-black/20 p-6 rounded-2xl border border-white/5">
                          <span className="text-xs text-slate-500 uppercase tracking-widest block mb-2">تعداد تراکنشها</span>
                          <span className="text-3xl font-black text-white">{toPersianDigits(transactions.filter(t => t.personId === selectedPersonId).length)}</span>
                      </div>
                      <div className="bg-black/20 p-6 rounded-2xl border border-white/5">
                          <span className="text-xs text-slate-500 uppercase tracking-widest block mb-2">کد شخص</span>
                          <span className="text-xl font-mono text-slate-300">{selectedPerson?.code || '---'}</span>
                      </div>
                  </div>
              </div>

              <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl no-print">
                  <PersonLedger personId={selectedPersonId} hideHeader={true} />
              </div>
          </div>
      ) : (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredPeople.map(c => (
                    <div key={c.id} className="bg-slate-900/40 backdrop-blur-xl border border-white/5 p-8 rounded-[3rem] hover:border-teal-500/40 transition-all cursor-pointer group shadow-2xl" onClick={() => setSelectedPersonId(c.id)}>
                        <div className="flex items-center gap-6 mb-8">
                            <div className="w-20 h-20 rounded-[2rem] bg-slate-800 flex items-center justify-center text-3xl font-black text-teal-400 border border-white/5 group-hover:scale-110 transition-transform shadow-inner">
                                {c.name.charAt(0)}
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <h3 className="font-black text-2xl text-white group-hover:text-teal-400 transition-colors mb-2 truncate">{c.name}</h3>
                                <span className="text-[9px] bg-teal-500/10 text-teal-400 px-3 py-1 rounded-full border border-teal-500/10 font-black">{c.category || 'مشتری'}</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center p-5 bg-black/20 rounded-3xl border border-white/5 shadow-inner">
                            <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">تراز:</span>
                            <span className={`font-black font-mono text-lg ${c.balance > 0 ? 'text-rose-400' : c.balance < 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                                {formatCurrency(Math.abs(c.balance))} 
                            </span>
                        </div>
                    </div>
                ))}
            </div>
          ) : (
            <div className="bg-slate-900/40 border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl animate-fade-in">
                <div className="overflow-x-auto">
                    <table className="w-full text-right">
                        <thead className="bg-white/5 text-slate-500 text-[10px] uppercase font-black">
                            <tr><th className="p-6">نام شخص</th><th className="p-6">شماره تماس</th><th className="p-6">دستهبندی</th><th className="p-6 text-left">مانده حساب</th><th className="p-6 text-center">عملیات</th></tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-slate-200">
                            {filteredPeople.map(c => (
                                <tr key={c.id} className="hover:bg-white/5 transition-colors cursor-pointer group" onClick={() => setSelectedPersonId(c.id)}>
                                    <td className="p-6 font-black text-lg">{c.name}</td>
                                    <td className="p-6 font-mono text-slate-400">{toPersianDigits(c.phone || '---')}</td>
                                    <td className="p-6"><span className="text-[10px] bg-white/5 px-3 py-1 rounded-lg border border-white/5 font-black">{c.category}</span></td>
                                    <td className={`p-6 text-left font-mono font-black ${c.balance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{formatCurrency(Math.abs(c.balance))}</td>
                                    <td className="p-6 text-center">
                                        <button onClick={(e) => { e.stopPropagation(); setEditingPerson(c); setNewPerson(c); setShowAdd(true); }} className="p-3 bg-blue-500/10 text-blue-400 rounded-xl hover:bg-blue-600 hover:text-white transition-all ml-2"><svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                                        <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(c.id); }} className="p-3 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-600 hover:text-white transition-all"><Trash2 size={18}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
          )
      )}

      {showAdd && (
          <div className="fixed inset-0 z-[1200] bg-black/90 backdrop-blur-3xl flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
              <div className="bg-slate-900 border border-white/10 w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-pop-up">
                  <div className="p-8 border-b border-white/5 flex justify-between items-center bg-slate-800/40">
                    <h3 className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-tighter"><UserPlus className="text-teal-400" size={24}/> {editingPerson ? 'ویرایش شخص' : 'ثبت شخص جدید'}</h3>
                    <button onClick={() => { setShowAdd(false); setEditingPerson(null); }} className="p-2 bg-white/5 rounded-full"><X size={20}/></button>
                  </div>
                  <div className="p-8 space-y-6">
                      <input className="w-full bg-slate-950 p-5 rounded-2xl border border-white/5 text-white font-black shadow-inner outline-none focus:border-teal-500" placeholder="نام و نام خانوادگی..." value={newPerson.name || ''} onChange={e => setNewPerson({...newPerson, name: e.target.value})} autoFocus />
                      <input className="w-full bg-slate-950 p-5 rounded-2xl border border-white/5 text-white font-mono shadow-inner outline-none focus:border-teal-500" placeholder="شماره تماس (اختیاری)" value={newPerson.phone || ''} onChange={e => setNewPerson({...newPerson, phone: e.target.value})} />
                      <input className="w-full bg-slate-950 p-5 rounded-2xl border border-white/5 text-white font-mono shadow-inner outline-none focus:border-teal-500" placeholder="کد ملی / شناسه ملی" value={newPerson.nationalId || ''} onChange={e => setNewPerson({...newPerson, nationalId: e.target.value})} />
                      <select className="w-full bg-slate-950 p-5 rounded-2xl border border-white/5 text-white font-black" value={newPerson.category} onChange={e => setNewPerson({...newPerson, category: e.target.value})}>
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                  </div>
                  <div className="p-8 bg-slate-950 border-t border-white/5 flex gap-4">
                      <button onClick={handleAdd} className="flex-1 bg-teal-600 text-white py-5 rounded-2xl font-black text-lg active:scale-95 shadow-xl">{editingPerson ? 'ذخیره تغییرات' : 'ذخیره شخص'}</button>
                      <button onClick={() => { setShowAdd(false); setEditingPerson(null); }} className="px-10 py-5 bg-slate-800 text-white rounded-2xl font-bold">لغو</button>
                  </div>
              </div>
          </div>
      )}

      {showPrintPreview && selectedPerson && createPortal(
          <div className="fixed inset-0 z-7000 bg-slate-950 flex flex-col animate-fade-in print-preview-modal print:static print:bg-white print:block print:h-auto print:overflow-visible" style={{ direction: 'rtl' }}>
              <header className="w-full bg-slate-900 border-b border-white/10 p-5 flex justify-between items-center z-10 px-8 shadow-2xl shrink-0 no-print">
                  <div className="flex items-center gap-4">
                      <button onClick={() => setShowPrintPreview(false)} className="bg-white/5 text-white p-3 rounded-2xl hover:bg-rose-600 transition-all shadow-lg active:scale-90 flex items-center justify-center shrink-0" title="بازگشت (Esc)"><ArrowLeft size={20}/></button>
                      <div className="flex flex-col">
                          <h2 className="text-white font-black text-lg">پیش‌نمایش و چاپ کاردکس حساب ({selectedPerson.name})</h2>
                          <p className="text-slate-500 text-[9px] font-black uppercase mt-1">Canva Financial Statement Preview</p>
                      </div>
                  </div>
                  <div className="flex gap-2 items-center">
                      <select 
                          className="bg-slate-800 border border-white/10 rounded-2xl px-4 py-3 text-white text-[10px] font-black outline-none focus:border-teal-500 shadow-inner" 
                          value={printTheme} 
                          onChange={e => setPrintTheme(e.target.value as any)}
                      >
                          <option value="modern">🎨 تم سرمه‌ای مدرن (Canva)</option>
                          <option value="teal">🌊 تم فیروزه‌ای زیبا</option>
                          <option value="navy">🏛️ تم سورمه‌ای کلاسیک</option>
                          <option value="minimal">🖤 تم مشکی مینیمال</option>
                      </select>
                      
                      <button 
                          onClick={handleDownloadPDF} 
                          disabled={downloadingPDF}
                          className="bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white px-4 py-3 rounded-2xl font-black text-xs shadow-xl active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 border border-rose-500/10"
                      >
                          {downloadingPDF ? (
                              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                              <FileText size={16}/>
                          )}
                          <span>دانلود PDF</span>
                      </button>
                      
                      <button 
                          onClick={handleDownloadImage} 
                          disabled={downloadingImage}
                          className="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white px-4 py-3 rounded-2xl font-black text-xs shadow-xl active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 border border-blue-500/10"
                      >
                          {downloadingImage ? (
                              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                              <Camera size={16}/>
                          )}
                          <span>دانلود تصویر</span>
                      </button>
                      
                      <button 
                          onClick={() => window.print()} 
                          className="bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all flex items-center gap-2"
                      >
                          <Printer size={20}/>
                          <span>چاپ سند</span>
                      </button>
                  </div>
              </header>

              <div className="flex-1 w-full overflow-y-auto p-4 md:p-12 flex flex-col items-center bg-[#020617] custom-scrollbar print:p-0 print:bg-white print:overflow-visible print:block">
                  <div className="relative mb-24 w-full md:w-auto print-content print:mb-0" style={{ width: 'min(100%, 215mm)' }}>
                      <div ref={cardexRef} className="bg-white shadow-[0_60px_150px_rgba(0,0,0,0.8)] rounded-none md:rounded-sm overflow-visible print-content print:shadow-none flex flex-col h-auto shrink-0" style={{ minHeight: '297mm' }}>
                          <CardexPrint 
                              person={selectedPerson}
                              entries={printReport.entries}
                              summary={{
                                  totalDebit: printReport.totalDebit,
                                  totalCredit: printReport.totalCredit,
                                  finalBalance: printReport.finalBalance
                              }}
                              theme={printTheme}
                          />
                      </div>
                  </div>
              </div>
          </div>,
          document.body
      )}

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => { deletePerson(deleteTarget!); setDeleteTarget(null); }} title="حذف شخص" message="آیا از حذف این شخص و تمامی سوابق مالی و حوالههای وی اطمینان دارید؟" />
      {showExcelImport && <ExcelImport type="people" onClose={() => setShowExcelImport(false)} />}
    </div>
  );
};

export default Customers;
