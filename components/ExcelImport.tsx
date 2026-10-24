import React, { useState } from 'react';
import { Upload, Download, FileSpreadsheet, X, CheckCircle, AlertCircle } from 'lucide-react';
import { excelImportService } from '../services/excelImportService';
import { useStore } from '../store';

interface Props {
    type: 'products' | 'people';
    onClose: () => void;
}

const ExcelImport: React.FC<Props> = ({ type, onClose }) => {
    const { addProducts, addPerson } = useStore();
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ success: number; errors: string[] } | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            setFile(e.target.files[0]);
            setResult(null);
        }
    };

    const handleImport = async () => {
        if (!file) return;
        
        setLoading(true);
        try {
            if (type === 'products') {
                const products = await excelImportService.importProducts(file);
                addProducts(products);
                setResult({ success: products.length, errors: [] });
            } else {
                const people = await excelImportService.importPeople(file);
                people.forEach(p => addPerson(p));
                setResult({ success: people.length, errors: [] });
            }
        } catch (error) {
            setResult({ success: 0, errors: ['خطا در خواندن فایل. لطفاً فرمت را بررسی کنید.'] });
        }
        setLoading(false);
    };

    const downloadTemplate = () => {
        if (type === 'products') {
            excelImportService.downloadProductTemplate();
        } else {
            excelImportService.downloadPeopleTemplate();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
            <div className="bg-slate-900 rounded-3xl p-8 max-w-2xl w-full border border-white/10 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <FileSpreadsheet className="text-teal-400" size={28} />
                        <h2 className="text-2xl font-black text-white">
                            ورود از اکسل - {type === 'products' ? 'کالاها' : 'اشخاص'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                <div className="space-y-6">
                    {/* دانلود قالب */}
                    <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-6">
                        <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                            <Download size={18} />
                            مرحله 1: دانلود قالب اکسل
                        </h3>
                        <p className="text-slate-400 text-sm mb-4">
                            ابتدا فایل قالب را دانلود کرده و اطلاعات خود را وارد کنید
                        </p>
                        <button
                            onClick={downloadTemplate}
                            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2"
                        >
                            <Download size={18} />
                            دانلود قالب {type === 'products' ? 'کالاها' : 'اشخاص'}
                        </button>
                    </div>

                    {/* آپلود فایل */}
                    <div className="bg-teal-500/10 border border-teal-500/20 rounded-2xl p-6">
                        <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                            <Upload size={18} />
                            مرحله 2: آپلود فایل تکمیل شده
                        </h3>
                        <label className="block">
                            <input
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <div className="border-2 border-dashed border-teal-500/30 rounded-xl p-8 text-center cursor-pointer hover:border-teal-500/50 transition-all">
                                {file ? (
                                    <div className="text-teal-400">
                                        <FileSpreadsheet size={48} className="mx-auto mb-2" />
                                        <p className="font-bold">{file.name}</p>
                                    </div>
                                ) : (
                                    <div className="text-slate-400">
                                        <Upload size={48} className="mx-auto mb-2" />
                                        <p>کلیک کنید یا فایل را بکشید</p>
                                    </div>
                                )}
                            </div>
                        </label>
                    </div>

                    {/* نتیجه */}
                    {result && (
                        <div className={`rounded-2xl p-6 ${result.errors.length > 0 ? 'bg-rose-500/10 border border-rose-500/20' : 'bg-emerald-500/10 border border-emerald-500/20'}`}>
                            {result.errors.length > 0 ? (
                                <>
                                    <div className="flex items-center gap-2 text-rose-400 font-bold mb-2">
                                        <AlertCircle size={20} />
                                        خطا در ورود اطلاعات
                                    </div>
                                    {result.errors.map((err, i) => (
                                        <p key={i} className="text-rose-300 text-sm">{err}</p>
                                    ))}
                                </>
                            ) : (
                                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                                    <CheckCircle size={20} />
                                    {result.success} مورد با موفقیت وارد شد
                                </div>
                            )}
                        </div>
                    )}

                    {/* دکمه ورود */}
                    <button
                        onClick={handleImport}
                        disabled={!file || loading}
                        className="w-full bg-teal-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {loading ? 'در حال پردازش...' : 'ورود اطلاعات'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExcelImport;
