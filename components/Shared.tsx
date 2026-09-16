
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { formatNumber, parseNumber, toPersianDigits, getJalaliMonths } from '../utils';
import { Calendar, X, Eraser, PenTool, AlertTriangle, CheckCircle2, Share2, Link as LinkIcon, Save, Info, Car } from 'lucide-react';
import { useStore } from '../store';

// Custom Hook for Keyboard Shortcuts
export const useKeyboardShortcut = (
  keyCombo: string[], // e.g. ['Alt', 'N']
  callback: () => void,
  disabled: boolean = false
) => {
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const isAltKey = keyCombo.includes('Alt');
      const isCtrlKey = keyCombo.includes('Ctrl');
      const isShiftKey = keyCombo.includes('Shift');
      const mainKey = keyCombo.find(k => !['Alt', 'Ctrl', 'Shift'].includes(k));

      if (
        (isAltKey && !event.altKey) ||
        (isCtrlKey && !event.ctrlKey) ||
        (isShiftKey && !event.shiftKey)
      ) {
        return;
      }

      if (mainKey && event.key && event.key.toLowerCase() === mainKey.toLowerCase()) {
        event.preventDefault();
        callback();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keyCombo, callback, disabled]);
};

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    value: number;
    onChange: (val: number) => void;
    label?: string;
}

export const NumberInput: React.FC<NumberInputProps> = ({ value, onChange, label, className, ...props }) => {
    const [displayValue, setDisplayValue] = useState('');
    useEffect(() => { setDisplayValue(value === 0 ? '' : formatNumber(value)); }, [value]);
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value; const num = parseNumber(raw);
        if (!isNaN(num)) { onChange(num); setDisplayValue(raw); } else if (raw === '') { onChange(0); setDisplayValue(''); }
    };
    const handleBlur = () => { setDisplayValue(value === 0 ? '' : formatNumber(value)); };
    return (
        <div className="w-full">
            {label && <label className="block text-slate-500 text-xs font-black mb-2 pr-2 uppercase tracking-widest">{label}</label>}
            <input {...props} type="text" value={displayValue} onChange={handleChange} onBlur={handleBlur} placeholder="۰" className={`w-full bg-slate-950 border-2 border-white/10 rounded-2xl px-6 py-5 text-white text-xl focus:border-teal-500 outline-none text-center font-mono font-black shadow-inner transition-all placeholder:text-slate-800 focus:bg-slate-900 ${className}`} dir="ltr" />
            {value > 0 && (
                <div className="flex justify-between px-2 mt-1.5 text-[10px] font-black text-slate-400" style={{ direction: 'rtl' }}>
                    <span>{toPersianDigits(value.toLocaleString())} ریال</span>
                    <span>{toPersianDigits(Math.round(value / 10).toLocaleString())} تومان</span>
                </div>
            )}
        </div>
    );
};

export const ConfirmModal: React.FC<{ isOpen: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string; confirmText?: string; type?: 'danger' | 'warning'; }> = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'بله، حذف شود', type = 'danger' }) => {
    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = 'auto';
    }, [isOpen]);

    if (!isOpen) return null;
    return createPortal(
        <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-slate-900 border-t md:border border-white/10 w-full max-w-md rounded-t-[2rem] md:rounded-[2rem] p-6 md:p-8 shadow-2xl animate-slide-up md:animate-pop-up relative max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 md:hidden"></div>
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 mx-auto ${type === 'danger' ? 'bg-rose-500/10 text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.2)]' : 'bg-amber-500/10 text-amber-500'}`}>
                    <AlertTriangle size={32} />
                </div>
                <h3 className="text-xl font-black text-white text-center mb-2">{title}</h3>
                <p className="text-slate-400 text-sm text-center mb-8 leading-relaxed">{message}</p>
                <div className="flex gap-3 md:gap-4 pb-safe">
                    <button onClick={() => { onConfirm(); onClose(); }} className="flex-1 bg-rose-600 text-white py-4 md:py-4 rounded-xl md:rounded-2xl font-black text-sm active:scale-95 shadow-lg shadow-rose-600/20 hover:bg-rose-500 transition-all min-h-[48px]">{confirmText}</button>
                    <button onClick={onClose} className="flex-1 bg-slate-800 text-white py-4 md:py-4 rounded-xl md:rounded-2xl font-bold text-sm hover:bg-slate-700 transition-all min-h-[48px]">لغو</button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export const JalaliDatePicker: React.FC<any> = ({ value, onChange, label }) => {
    const [year, setYear] = useState(1403); const [month, setMonth] = useState(1); const [day, setDay] = useState(1); const [isOpen, setIsOpen] = useState(false);
    useEffect(() => { if (value) { const parts = value.split('/'); if (parts.length === 3) { setYear(parseInt(parts[0])); setMonth(parseInt(parts[1])); setDay(parseInt(parts[2])); } } }, [value]);
    const handleUpdate = (y: number, m: number, d: number) => { const formattedDate = `${y}/${m.toString().padStart(2, '0')}/${d.toString().padStart(2, '0')}`; onChange(formattedDate); };
    return (
        <div className="w-full relative">
            {label && <label className="block text-slate-500 text-[9px] md:text-[10px] font-black mb-1.5 pr-2 uppercase tracking-widest">{label}</label>}
            <div className="w-full bg-slate-950 border border-white/10 rounded-xl md:rounded-2xl p-4 text-white cursor-pointer flex items-center justify-between hover:border-teal-500/50 transition-colors shadow-inner active:scale-[0.99]" onClick={() => setIsOpen(!isOpen)}><span className="font-mono tracking-wider font-bold text-sm md:text-lg">{toPersianDigits(value || '----/--/--')}</span><Calendar size={18} className="text-teal-500" /></div>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-[200] bg-black/60 md:hidden" onClick={() => setIsOpen(false)}></div>
                    <div className="fixed bottom-0 left-0 right-0 md:absolute md:top-full md:bottom-auto md:right-0 md:left-0 mt-2 bg-slate-900 border-t md:border border-white/20 rounded-t-[2rem] md:rounded-2xl p-6 md:p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-[201] animate-slide-up md:animate-pop-up">
                        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 md:hidden"></div>
                        <div className="flex gap-2 mb-4 h-48">
                            <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-950 rounded-xl border border-white/5">{Array.from({ length: 31 }, (_, i) => i + 1).map(d => (<button key={d} onClick={(e) => { e.stopPropagation(); handleUpdate(year, month, d); }} className={`w-full py-3 text-center text-xs md:text-[10px] ${day === d ? 'bg-teal-600 text-white font-black' : 'text-slate-400'}`}>{toPersianDigits(d)}</button>))}</div>
                            <div className="flex-[1.5] overflow-y-auto custom-scrollbar bg-slate-950 rounded-xl border border-white/5">{getJalaliMonths().map((m, idx) => (<button key={idx} onClick={(e) => { e.stopPropagation(); handleUpdate(year, idx + 1, day); }} className={`w-full py-3 text-center text-xs md:text-[10px] ${month === idx + 1 ? 'bg-teal-600 text-white font-black' : 'text-slate-400'}`}>{m}</button>))}</div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-950 rounded-xl border border-white/5">{Array.from({ length: 15 }, (_, i) => 1400 + i).map(y => (<button key={y} onClick={(e) => { e.stopPropagation(); handleUpdate(y, month, day); }} className={`w-full py-3 text-center text-xs md:text-[10px] ${year === y ? 'bg-teal-600 text-white font-black' : 'text-slate-400'}`}>{toPersianDigits(y)}</button>))}</div>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="w-full bg-teal-600 text-white py-4 md:py-3 rounded-2xl md:rounded-xl text-sm md:text-xs font-black shadow-lg">تایید و انتخاب</button>
                    </div>
                </>
            )}
            {isOpen && <div className="fixed inset-0 z-40 hidden md:block" onClick={() => setIsOpen(false)}></div>}
        </div>
    );
};

export const FullScreenSignatureModal: React.FC<any> = ({ isOpen, onClose, onSave, type, docId }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const lastPos = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            const timer = setTimeout(() => {
                if (canvasRef.current && containerRef.current) {
                    const canvas = canvasRef.current;
                    const container = containerRef.current;
                    const rect = container.getBoundingClientRect();
                    canvas.width = rect.width * 1.5;
                    canvas.height = rect.height * 1.5;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.scale(1.5, 1.5);
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        ctx.lineWidth = 3.5;
                        ctx.strokeStyle = '#020617';
                    }
                }
            }, 100);
            return () => { document.body.style.overflow = 'auto'; clearTimeout(timer); };
        }
    }, [isOpen]);

    const getPos = (e: any) => {
        const canvas = canvasRef.current; if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        let cX, cY;
        if (e.touches && e.touches.length > 0) { cX = e.touches[0].clientX; cY = e.touches[0].clientY; }
        else { cX = e.clientX; cY = e.clientY; }
        return { 
            x: (cX - rect.left) * (canvas.width / 1.5 / rect.width), 
            y: (cY - rect.top) * (canvas.height / 1.5 / rect.height)
        };
    };

    const startDrawing = (e: any) => { e.preventDefault(); setIsDrawing(true); lastPos.current = getPos(e); };
    const draw = (e: any) => {
        if (!isDrawing) return;
        e.preventDefault();
        const currentPos = getPos(e);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) { ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(currentPos.x, currentPos.y); ctx.stroke(); lastPos.current = currentPos; }
    };

    const stopDrawing = () => setIsDrawing(false);
    const handleSave = () => { const canvas = canvasRef.current; if (canvas) { onSave(canvas.toDataURL()); onClose(); } };
    const handleClear = () => { const ctx = canvasRef.current?.getContext('2d'); if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[99999] bg-slate-950 flex flex-col animate-fade-in overflow-hidden" dir="rtl">
            <header className="p-4 md:p-6 bg-slate-900 border-b border-white/10 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                    <PenTool size={20} className="text-teal-400" />
                    <h2 className="text-white font-black text-sm md:text-lg">ثبت امضای دیجیتال</h2>
                </div>
                <button onClick={onClose} className="p-2 bg-rose-500/10 text-rose-500 rounded-xl"><X size={20} /></button>
            </header>
            <main className="flex-1 p-3 md:p-8 flex items-center justify-center bg-slate-950 overflow-hidden">
                <div ref={containerRef} className="w-full h-full max-w-5xl max-h-[75vh] bg-white rounded-[2rem] shadow-2xl relative overflow-hidden cursor-crosshair border-8 border-slate-900/50">
                    <canvas ref={canvasRef} className="w-full h-full touch-none" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
                </div>
            </main>
            <footer className="p-4 md:p-10 bg-slate-900 border-t border-white/10 flex gap-4 shrink-0 pb-10 md:pb-10 safe-area-pb">
                <button onClick={handleSave} className="flex-1 bg-teal-600 text-white py-5 rounded-2xl font-black text-xl shadow-xl active:scale-95">تایید و ثبت نهایی</button>
                <button onClick={handleClear} className="w-20 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-2xl flex items-center justify-center"><Eraser size={24} /></button>
            </footer>
        </div>,
        document.body
    );
};

// Fixed ToastItem to be a React.FC so it accepts 'key' and other standard props
const ToastItem: React.FC<{ notification: any, onDismiss: (id: string) => void }> = ({ notification, onDismiss }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss(notification.id);
        }, 2000);
        return () => clearTimeout(timer);
    }, [notification.id, onDismiss]);

    return (
        <div className="pointer-events-auto bg-slate-900/95 backdrop-blur-md border border-white/10 px-2 py-1 rounded-lg shadow-lg flex items-center gap-1.5 animate-slide-down mb-1" style={{ direction: 'rtl' }}>
            <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${notification.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : notification.type === 'error' ? 'bg-rose-500/20 text-rose-400' : 'bg-blue-500/20 text-blue-400'}`}>
                {notification.type === 'success' ? <CheckCircle2 size={10}/> : notification.type === 'error' ? <AlertTriangle size={10}/> : <Info size={10}/>}
            </div>
            <p className="text-white font-bold text-[9px] flex-1">{notification.message}</p>
            <button onClick={() => onDismiss(notification.id)} className="text-slate-500 hover:text-white p-0.5"><X size={10}/></button>
        </div>
    );
};

export const ToastContainer = () => {
    const { notifications, removeNotification } = useStore();

    return createPortal(
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[10000] flex flex-col items-center pointer-events-none w-full max-w-xs px-2">
            {notifications.map(n => (
                <ToastItem key={n.id} notification={n} onDismiss={removeNotification} />
            ))}
        </div>,
        document.body
    );
};

// Iranian Plate Picker Component
const IRANIAN_LETTERS = [
    'الف', 'ب', 'پ', 'ت', 'ث', 'ج', 'چ', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'ژ', 'س', 'ش', 
    'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ک', 'گ', 'ل', 'م', 'ن', 'و', 'ه', 'ی'
];

interface IranianPlatePickerProps {
    value: { part1: string; part2: string; part3: string; part4: string };
    onChange: (value: { part1: string; part2: string; part3: string; part4: string }) => void;
    label?: string;
}

export const IranianPlatePicker: React.FC<IranianPlatePickerProps> = ({ value, onChange, label }) => {
    const [showLetterPicker, setShowLetterPicker] = useState(false);

    const handleLetterSelect = (letter: string) => {
        onChange({ ...value, part2: letter });
        setShowLetterPicker(false);
    };

    return (
        <div className="space-y-2">
            {label && <label className="text-xs text-slate-500 font-black pr-2 block uppercase">{label}</label>}
            
            <div className="flex gap-2" dir="ltr">
                {/* Part 4: Iran Code (2 digits) */}
                <input 
                    className="w-14 md:w-16 bg-slate-950 border border-white/5 rounded-xl p-2 md:p-3 text-white text-center font-black text-base md:text-lg outline-none focus:border-teal-500 transition-all" 
                    placeholder="۱۲" 
                    value={value.part4} 
                    onChange={e => onChange({ ...value, part4: e.target.value.slice(0, 2) })}
                    maxLength={2}
                />

                {/* Part 3: Main Number (3 digits) */}
                <input 
                    className="flex-1 bg-slate-950 border border-white/5 rounded-xl p-2 md:p-3 text-white text-center font-black text-base md:text-lg outline-none focus:border-teal-500 transition-all" 
                    placeholder="۳۴۵" 
                    value={value.part3} 
                    onChange={e => onChange({ ...value, part3: e.target.value.slice(0, 3) })}
                    maxLength={3}
                />

                {/* Part 2: Letter (Persian) */}
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setShowLetterPicker(!showLetterPicker)}
                        className="w-14 md:w-16 bg-gradient-to-br from-indigo-600 to-purple-700 border-2 border-indigo-400 rounded-xl p-2 md:p-3 text-white text-center font-black text-lg md:text-xl outline-none hover:from-indigo-500 hover:to-purple-600 transition-all shadow-lg active:scale-95 min-h-[44px]"
                    >
                        {value.part2 || 'ب'}
                    </button>

                    {showLetterPicker && createPortal(
                        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-4 animate-fade-in">
                            <div className="bg-slate-900 border-t md:border border-white/10 w-full max-w-md rounded-t-[2rem] md:rounded-[2rem] p-6 shadow-2xl animate-slide-up md:animate-pop-up">
                                <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 md:hidden"></div>
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-white font-black text-lg flex items-center gap-2">
                                        <Car size={20} className="text-indigo-400" />
                                        انتخاب حرف پلاک
                                    </h3>
                                    <button onClick={() => setShowLetterPicker(false)} className="text-slate-400 hover:text-white p-2 hover:bg-white/5 rounded-xl transition-all">
                                        <X size={20} />
                                    </button>
                                </div>
                                <div className="grid grid-cols-6 gap-2 max-h-[60vh] overflow-y-auto custom-scrollbar pb-safe">
                                    {IRANIAN_LETTERS.map(letter => (
                                        <button
                                            key={letter}
                                            onClick={() => handleLetterSelect(letter)}
                                            className={`p-3 md:p-4 rounded-xl font-black text-base md:text-lg transition-all min-h-[44px] active:scale-95 ${
                                                value.part2 === letter 
                                                    ? 'bg-gradient-to-br from-teal-600 to-emerald-600 text-white shadow-lg scale-105' 
                                                    : 'bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white'
                                            }`}
                                        >
                                            {letter}
                                        </button>
                                    ))}
                                </div>
                                <button 
                                    onClick={() => setShowLetterPicker(false)} 
                                    className="w-full bg-slate-800 text-white py-4 rounded-2xl font-bold mt-4 md:hidden min-h-[48px]"
                                >
                                    بستن
                                </button>
                            </div>
                        </div>,
                        document.body
                    )}
                </div>

                {/* Part 1: Prefix (2 digits) */}
                <input 
                    className="w-14 md:w-16 bg-slate-950 border border-white/5 rounded-xl p-2 md:p-3 text-white text-center font-black text-base md:text-lg outline-none focus:border-teal-500 transition-all" 
                    placeholder="۶۷" 
                    value={value.part1} 
                    onChange={e => onChange({ ...value, part1: e.target.value.slice(0, 2) })}
                    maxLength={2}
                />
            </div>

            {/* Preview */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-2 md:p-3 flex items-center justify-center gap-2 border-2 border-blue-400 shadow-lg">
                <div className="flex items-center gap-1 bg-white rounded-lg px-2 md:px-3 py-1.5 md:py-2" dir="ltr">
                    <span className="text-blue-900 font-black text-xs md:text-sm">{value.part4 || '__'}</span>
                    <span className="text-blue-900 font-black text-xs md:text-sm mx-0.5 md:mx-1">ایران</span>
                    <span className="text-blue-900 font-black text-base md:text-lg">{value.part3 || '___'}</span>
                    <span className="text-blue-900 font-black text-xl md:text-2xl mx-0.5 md:mx-1">{value.part2 || '_'}</span>
                    <span className="text-blue-900 font-black text-xs md:text-sm">{value.part1 || '__'}</span>
                </div>
            </div>
        </div>
    );
};
