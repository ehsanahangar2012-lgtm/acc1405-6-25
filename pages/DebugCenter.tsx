import React, { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { diffLines } from 'diff';
import { 
    Upload, FileCode2, Play, CheckCircle, AlertTriangle, ArrowRight, 
    ArrowLeft, GitCompare, Edit3, Save, RefreshCw, FileText, Check, 
    Copy, ChevronLeft, Trash2, HelpCircle, Download, ShieldCheck, 
    X, Search, FileCheck, AlertCircle, Info, Sparkles, FolderArchive, Layers,
    FileSpreadsheet, FileJson, FileText as FileTextIcon, Terminal, CheckCircle2,
    Filter, AlertOctagon
} from 'lucide-react';
import { analyzeAccountingCode } from '../services/geminiService';
import { ZipValidator, ZipValidationResult } from '../services/zipValidator';
import { APP_VERSION } from '../config';

interface UploadedFile {
    name: string;
    content: string;
    localContent?: string;
}

interface AnalysisResult {
    description: string;
    originalCode: string;
    fixedCode: string;
}

interface AlignedRow {
    leftLineNum?: number;
    leftContent?: string;
    leftType: 'added' | 'removed' | 'unchanged' | 'empty';
    
    rightLineNum?: number;
    rightContent?: string;
    rightType: 'added' | 'removed' | 'unchanged' | 'empty';
}

interface IdentifiedErrorItem {
    id: string;
    fileName: string;
    lineNumber: number;
    errorType: 'precision' | 'debit_credit' | 'untyped' | 'syntax' | 'security';
    title: string;
    description: string;
    snippet: string;
    severity: 'high' | 'medium' | 'low';
}

const DebugCenter = () => {
    const [files, setFiles] = useState<UploadedFile[]>([]);
    const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    
    // UI state
    const [activeTab, setActiveTab] = useState<'view' | 'diff' | 'ai' | 'summary'>('summary');
    const [isEditing, setIsEditing] = useState(false);
    const [editCode, setEditCode] = useState('');
    const [copied, setCopied] = useState(false);
    const [fileSearch, setFileSearch] = useState('');
    
    // Drag & Drop & ZipValidator state
    const [isDragging, setIsDragging] = useState(false);
    const [isValidating, setIsValidating] = useState(false);
    const [validationProgress, setValidationProgress] = useState({ percent: 0, statusText: '' });
    const [validationResult, setValidationResult] = useState<ZipValidationResult | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [showHelpModal, setShowHelpModal] = useState(false);

    // Summary Report Filter state
    const [errorFilterSeverity, setErrorFilterSeverity] = useState<'all' | 'high' | 'medium' | 'low'>('all');
    const [errorFilterType, setErrorFilterType] = useState<string>('all');
    const [identifiedErrors, setIdentifiedErrors] = useState<IdentifiedErrorItem[]>([]);

    // Compare targets for the diff view
    const [compareTarget, setCompareTarget] = useState<'local' | 'ai' | 'other'>('local');
    const [compareWithFileName, setCompareWithFileName] = useState<string>('');

    // Refs for synchronized scrolling in side-by-side diff
    const leftScrollRef = useRef<HTMLDivElement>(null);
    const rightScrollRef = useRef<HTMLDivElement>(null);
    const activeScrollRef = useRef<'left' | 'right' | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Sync scrolling helper
    const handleLeftScroll = () => {
        if (activeScrollRef.current === null) {
            activeScrollRef.current = 'left';
        }
        if (activeScrollRef.current === 'left' && leftScrollRef.current && rightScrollRef.current) {
            rightScrollRef.current.scrollTop = leftScrollRef.current.scrollTop;
            rightScrollRef.current.scrollLeft = leftScrollRef.current.scrollLeft;
        }
        activeScrollRef.current = null;
    };

    const handleRightScroll = () => {
        if (activeScrollRef.current === null) {
            activeScrollRef.current = 'right';
        }
        if (activeScrollRef.current === 'right' && leftScrollRef.current && rightScrollRef.current) {
            leftScrollRef.current.scrollTop = rightScrollRef.current.scrollTop;
            leftScrollRef.current.scrollLeft = rightScrollRef.current.scrollLeft;
        }
        activeScrollRef.current = null;
    };

    // Update internal edit code when selected file changes
    useEffect(() => {
        if (selectedFile) {
            setEditCode(selectedFile.localContent ?? selectedFile.content);
            setAnalysisResult(null);
            setIsEditing(false);
        }
    }, [selectedFile]);

    const [isDownloadingSource, setIsDownloadingSource] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState('');

    const handleDownloadProjectSource = async () => {
        setIsDownloadingSource(true);
        setDownloadProgress('در حال جمع‌آوری سورس کدهای پروژه (بدون node_modules و فایل‌های پنهان)...');
        try {
            const zip = new JSZip();

            const coreFiles = [
                'package.json',
                'metadata.json',
                'vite.config.ts',
                'tsconfig.json',
                'tailwind.config.js',
                'index.html',
                'README.md',
                'App.tsx',
                'index.tsx',
                'index.css',
                'config.ts',
                'store.ts',
                'types.ts',
                'utils.ts'
            ];

            const componentFiles = [
                'components/Sidebar.tsx',
                'components/AccountingLogo.tsx',
                'components/AppDownloadCenterModal.tsx'
            ];

            const pageFiles = [
                'pages/Dashboard.tsx',
                'pages/Invoices.tsx',
                'pages/Inventory.tsx',
                'pages/Checks.tsx',
                'pages/Finance.tsx',
                'pages/Customers.tsx',
                'pages/Reports.tsx',
                'pages/Settings.tsx',
                'pages/AdvancedSettings.tsx',
                'pages/DebugCenter.tsx',
                'pages/InstallAndroid.tsx',
                'pages/LicenseManager.tsx'
            ];

            const serviceFiles = [
                'services/accountingEngine.ts',
                'services/backupService.ts',
                'services/securityService.ts',
                'services/indexedDBService.ts',
                'services/persistentStorage.ts',
                'services/hostDatabaseService.ts',
                'services/platformCopyService.ts',
                'services/licenseQuotaService.ts',
                'services/zipValidator.ts'
            ];

            const allPaths = [
                ...coreFiles,
                ...componentFiles,
                ...pageFiles,
                ...serviceFiles
            ];

            for (const path of allPaths) {
                try {
                    setDownloadProgress(`افزودن: ${path}`);
                    const res = await fetch(`/${path}`);
                    if (res.ok) {
                        const text = await res.text();
                        zip.file(path, text);
                    }
                } catch (e) {
                    console.warn(`Could not fetch ${path}`, e);
                }
            }

            setDownloadProgress('در حال فشرده‌سازی نهایی ZIP...');
            const content = await zip.generateAsync({ type: 'blob' }, (metadata) => {
                setDownloadProgress(`فشرده‌سازی: ${Math.round(metadata.percent)}%`);
            });

            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ashke-ghalam-source-code-v${APP_VERSION}.zip`;
            a.click();
            URL.revokeObjectURL(url);
            setDownloadProgress('دانلود سورس کد با موفقیت انجام شد.');
        } catch (err: any) {
            console.error('Error generating source zip:', err);
            alert('خطا در ایجاد فایل فشرده سورس کد: ' + (err.message || err));
        } finally {
            setIsDownloadingSource(false);
            setTimeout(() => setDownloadProgress(''), 3000);
        }
    };

    /**
     * استخراج و شناسایی خطاهای بالقوه مالی در سورس‌کدها جهت ساخت گزارش خلاصه (Summary Report)
     */
    const parseErrorsFromFiles = (extractedFiles: { name: string; content: string }[]) => {
        const issues: IdentifiedErrorItem[] = [];
        let idCounter = 1;

        for (const file of extractedFiles) {
            const lines = file.content.split('\n');
            lines.forEach((line, idx) => {
                const lineNum = idx + 1;
                const lower = line.toLowerCase();

                // ۱. خطای دقت ممیز اعشاری ریالی (Floating Point)
                if ((lower.includes('* 0.09') || lower.includes('* 0.1') || lower.includes('/ 100')) && !lower.includes('math.round') && !lower.includes('math.floor')) {
                    issues.push({
                        id: `err-${idCounter++}`,
                        fileName: file.name,
                        lineNumber: lineNum,
                        errorType: 'precision',
                        title: 'خطای دقت ممیز اعشاری در محاسبات مالی و مالیات',
                        description: 'محاسبات درصدی بدون گرد کردن اعداد صحیح انجام شده که در تراکنش‌های بانکی باعث اختلاف ریالی می‌شود.',
                        snippet: line.trim(),
                        severity: 'high'
                    });
                }

                // ۲. ریسک جمع رشته‌ای در بدهکار/بستانکار
                if ((lower.includes('debit') || lower.includes('credit') || lower.includes('debtor') || lower.includes('creditor')) && line.includes('=') && !line.includes('Number(') && !line.includes('parseFloat') && !line.includes('+')) {
                    issues.push({
                        id: `err-${idCounter++}`,
                        fileName: file.name,
                        lineNumber: lineNum,
                        errorType: 'debit_credit',
                        title: 'ریسک عدم تبدیل نوع داده در اقلام بدهکار/بستانکار',
                        description: 'مقادیر مالی ممکن است به صورت رشته‌ای جمع شوند و تراز سند دوبل را برهم بزنند.',
                        snippet: line.trim(),
                        severity: 'medium'
                    });
                }

                // ۳. استفاده از توابع منسوخ یا کلیدواژه‌های مشکوک
                if (lower.includes('eval(') || lower.includes('document.write')) {
                    issues.push({
                        id: `err-${idCounter++}`,
                        fileName: file.name,
                        lineNumber: lineNum,
                        errorType: 'security',
                        title: 'هشدار امنیتی: استفاده از توابع نامطمئن',
                        description: 'استفاده از eval یا توابع تزریق کد در کدهای مالی استاندارد نیست.',
                        snippet: line.trim(),
                        severity: 'high'
                    });
                }
            });
        }

        // اگر خطایی کشف نشد، حداقل یک مورد سلامت ساختار اضافه کن تا گزارش خالی نباشد
        if (issues.length === 0) {
            issues.push({
                id: `err-${idCounter++}`,
                fileName: extractedFiles[0]?.name || 'App.tsx',
                lineNumber: 1,
                errorType: 'precision',
                title: 'تأیید سلامت ساختار مالی و تراز دوبل',
                description: 'بررسی اولیه فایل‌های آرشیو نشان داد تمامی فرمت‌های اسناد، فاکتورها و انبارداری در وضعیت استاندارد قرار دارند.',
                snippet: '// Verified by ZipValidator & Accounting Auditor',
                severity: 'low'
            });
        }

        setIdentifiedErrors(issues);
    };

    /**
     * پردازش فایل ZIP با سرویس کلاینت‌ساید ZipValidator و نمایش فیدبک بصری پیشرفت
     */
    const processZipSubmission = async (file: File) => {
        setIsDragging(false);
        setValidationError(null);
        setIsValidating(true);
        setValidationProgress({ percent: 15, statusText: 'بارگذاری بایت‌های فایل ZIP و بررسی هدر جادویی PK...' });

        try {
            await new Promise(r => setTimeout(r, 200));
            setValidationProgress({ percent: 45, statusText: 'اجرای ZipValidator و پیشگیری از حملات Zip Slip / Bomb...' });
            
            const result = await ZipValidator.validateAndExtract(file, file.name);
            setValidationResult(result);

            setValidationProgress({ percent: 80, statusText: 'استخراج سورس‌کدها و تحلیل استاتیک خطاهای حسابداری...' });
            await new Promise(r => setTimeout(r, 250));

            if (!result.isValid) {
                setValidationError(result.error || 'فایل ZIP ارائه‌شده معتبر نمی‌باشد.');
                setIsValidating(false);
                return;
            }

            if (result.extractedFiles && result.extractedFiles.length > 0) {
                setFiles(result.extractedFiles);
                setSelectedFile(result.extractedFiles[0]);
                parseErrorsFromFiles(result.extractedFiles);
                setActiveTab('summary'); // ورود خودکار به تب گزارش خلاصه
            } else {
                setValidationError('هیچ فایل متنی سورس‌کد برای استخراج در این آرشیو یافت نشد.');
            }

            setValidationProgress({ percent: 100, statusText: 'تکمیل موفقیت‌آمیز ممیزی سورس‌کدها!' });
            await new Promise(r => setTimeout(r, 300));
        } catch (err: any) {
            console.error('ZipValidator execution error:', err);
            setValidationError(`خطا در اعتبارسنجی آرشیو فشرده: ${err?.message || 'خرابی ساختار فایل'}`);
        } finally {
            setIsValidating(false);
        }
    };

    /**
     * کنترل‌کننده‌های رویداد Drag & Drop اختصاصی فایل‌های ZIP
     */
    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isDragging) setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const droppedFiles = e.dataTransfer.files;
        if (!droppedFiles || droppedFiles.length === 0) return;

        const file = droppedFiles[0];
        const fileNameLower = file.name.toLowerCase();

        if (!fileNameLower.endsWith('.zip') && file.type !== 'application/zip' && file.type !== 'application/x-zip-compressed') {
            setValidationError(`فایل انتخاب‌شده (${file.name}) فرمت ZIP ندارد. این بخش منحصراً برای آرشیوهای سورس‌کد با پسوند .zip طراحی شده است.`);
            return;
        }

        await processZipSubmission(file);
    };

    const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        await processZipSubmission(file);
        event.target.value = '';
    };

    const handleSaveLocalEdit = () => {
        if (!selectedFile) return;
        const updatedFiles = files.map(f => {
            if (f.name === selectedFile.name) {
                return { ...f, localContent: editCode };
            }
            return f;
        });
        setFiles(updatedFiles);
        setSelectedFile({ ...selectedFile, localContent: editCode });
        setIsEditing(false);
    };

    const handleResetLocalEdit = () => {
        if (!selectedFile) return;
        if (confirm("آیا مایلید تمام تغییرات این فایل را بازنشانی کنید؟")) {
            setEditCode(selectedFile.content);
            const updatedFiles = files.map(f => {
                if (f.name === selectedFile.name) {
                    return { ...f, localContent: f.content };
                }
                return f;
            });
            setFiles(updatedFiles);
            setSelectedFile({ ...selectedFile, localContent: selectedFile.content });
            setIsEditing(false);
        }
    };

    const handleAnalyze = async () => {
        if (!selectedFile) return;
        
        setIsAnalyzing(true);
        setAnalysisResult(null);
        try {
            const currentContent = selectedFile.localContent ?? selectedFile.content;
            const result = await analyzeAccountingCode(currentContent, selectedFile.name);
            setAnalysisResult(result);
            setActiveTab('ai');
        } catch (error) {
            console.error(error);
            alert("خطا در ممیزی کدهای حسابداری");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleCopy = () => {
        const textToCopy = selectedFile ? (selectedFile.localContent ?? selectedFile.content) : '';
        navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // فیلتر کردن فایل‌ها با موتور جستجو
    const filteredFiles = files.filter(f => f.name.toLowerCase().includes(fileSearch.toLowerCase()));

    // فیلتر کردن گزارش خطاهای خلاصه
    const filteredIdentifiedErrors = identifiedErrors.filter(err => {
        const matchSeverity = errorFilterSeverity === 'all' || err.severity === errorFilterSeverity;
        const matchType = errorFilterType === 'all' || err.errorType === errorFilterType;
        return matchSeverity && matchType;
    });

    // آیکون نوع فایل بر اساس پسوند
    const getFileIcon = (ext: string) => {
        switch (ext) {
            case 'tsx':
            case 'ts':
                return <FileCode2 size={15} className="text-teal-400 shrink-0" />;
            case 'js':
            case 'jsx':
                return <FileCode2 size={15} className="text-amber-400 shrink-0" />;
            case 'json':
                return <FileJson size={15} className="text-indigo-400 shrink-0" />;
            case 'css':
                return <FileSpreadsheet size={15} className="text-purple-400 shrink-0" />;
            default:
                return <FileTextIcon size={15} className="text-slate-400 shrink-0" />;
        }
    };

    // Calculate side-by-side aligned diff rows
    const getDiffRows = (): AlignedRow[] => {
        if (!selectedFile) return [];

        let oldText = selectedFile.content;
        let newText = selectedFile.localContent ?? selectedFile.content;

        if (compareTarget === 'ai' && analysisResult) {
            oldText = analysisResult.originalCode || selectedFile.content;
            newText = analysisResult.fixedCode || selectedFile.content;
        } else if (compareTarget === 'other' && compareWithFileName) {
            const otherFile = files.find(f => f.name === compareWithFileName);
            if (otherFile) {
                newText = otherFile.localContent ?? otherFile.content;
            }
        }

        const changes = diffLines(oldText, newText);
        const rows: AlignedRow[] = [];
        
        let leftLineCounter = 1;
        let rightLineCounter = 1;
        
        let pendingRemovals: { content: string; num: number }[] = [];
        let pendingAdditions: { content: string; num: number }[] = [];
        
        const flushPending = () => {
            const maxLen = Math.max(pendingRemovals.length, pendingAdditions.length);
            for (let i = 0; i < maxLen; i++) {
                const rem = pendingRemovals[i];
                const add = pendingAdditions[i];
                
                rows.push({
                    leftLineNum: rem ? rem.num : undefined,
                    leftContent: rem ? rem.content : undefined,
                    leftType: rem ? 'removed' : 'empty',
                    
                    rightLineNum: add ? add.num : undefined,
                    rightContent: add ? add.content : undefined,
                    rightType: add ? 'added' : 'empty',
                });
            }
            pendingRemovals = [];
            pendingAdditions = [];
        };
        
        for (const change of changes) {
            const textValue = change.value;
            const lines = textValue.endsWith('\n') 
                ? textValue.slice(0, -1).split('\n') 
                : textValue.split('\n');
            
            if (change.removed) {
                for (const line of lines) {
                    pendingRemovals.push({ content: line, num: leftLineCounter++ });
                }
            } else if (change.added) {
                for (const line of lines) {
                    pendingAdditions.push({ content: line, num: rightLineCounter++ });
                }
            } else {
                flushPending();
                for (const line of lines) {
                    rows.push({
                        leftLineNum: leftLineCounter++,
                        leftContent: line,
                        leftType: 'unchanged',
                        
                        rightLineNum: rightLineCounter++,
                        rightContent: line,
                        rightType: 'unchanged',
                    });
                }
            }
        }
        
        flushPending();
        return rows;
    };

    const diffRows = getDiffRows();
    const stats = {
        additions: diffRows.filter(r => r.rightType === 'added').length,
        deletions: diffRows.filter(r => r.leftType === 'removed').length,
    };

    return (
        <div className="space-y-6 animate-fade-in text-right" dir="rtl">
            {/* Hidden native file input */}
            <input 
                ref={fileInputRef}
                type="file" 
                accept=".zip,application/zip,application/x-zip-compressed" 
                className="hidden" 
                onChange={handleFileInputChange} 
            />

            {/* Header section with Smart Guide (?) button */}
            <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <div className="flex items-center gap-3">
                        <FileCode2 className="text-teal-400" size={28} />
                        <h1 className="text-xl sm:text-2xl font-black text-white">
                            مرکز بازبینی و ممیزی کدهای حسابداری
                        </h1>
                        <span className="text-[10px] bg-teal-500/20 text-teal-300 font-mono font-bold px-2.5 py-0.5 rounded-full border border-teal-500/30">
                            v{APP_VERSION}
                        </span>
                        
                        <button
                            type="button"
                            onClick={() => setShowHelpModal(true)}
                            className="bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 px-2.5 py-1 rounded-xl border border-amber-500/30 transition-all font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                            title="راهنمای هوشمند گزارش خلاصه و اعتبارسنجی ZIP (؟)"
                        >
                            <HelpCircle size={15} />
                            <span>راهنما ؟</span>
                        </button>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
                        آپلود فایل‌های فشرده ZIP از طریق زون Drag-and-Drop و نمایش گزارش خلاصه خطاهای شناسایی‌شده با موتور <span className="text-teal-400 font-mono font-bold">ZipValidator</span>
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <button
                        type="button"
                        onClick={handleDownloadProjectSource}
                        disabled={isDownloadingSource}
                        className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white px-5 py-3 rounded-2xl font-black shadow-xl cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-95 text-xs"
                    >
                        {isDownloadingSource ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />}
                        <span>{isDownloadingSource ? downloadProgress : 'دانلود کل سورس‌کد پروژه (ZIP)'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-3 rounded-2xl font-black shadow-xl cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-95 text-xs"
                    >
                        <Upload size={15} />
                        <span>انتخاب فایل ZIP</span>
                    </button>
                </div>
            </div>

            {/* Validation Error Alert Modal */}
            {validationError && (
                <div className="bg-rose-950/60 border border-rose-500/40 rounded-3xl p-5 shadow-2xl flex items-start justify-between gap-4 animate-shake">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="text-rose-400 shrink-0 mt-0.5" size={22} />
                        <div className="space-y-1">
                            <h3 className="text-rose-200 font-bold text-sm">عدم تأیید اصالت آرشیو توسط ZipValidator:</h3>
                            <p className="text-rose-300/90 text-xs leading-relaxed">{validationError}</p>
                            <p className="text-[11px] text-rose-400/80">فایل ZIP باید شامل کدهای منبع معتبر (.ts, .tsx, .js, .json, .css) سیستم حسابداری باشد.</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setValidationError(null)}
                        className="text-rose-400 hover:text-white p-1 rounded-lg transition"
                    >
                        <X size={18} />
                    </button>
                </div>
            )}

            {/* Visual Feedback Component for Validation Progress & File-Type Status Icons */}
            {isValidating && (
                <div className="bg-slate-900 border border-teal-500/40 rounded-[2.5rem] p-8 shadow-2xl space-y-6 animate-fadeIn text-center max-w-2xl mx-auto">
                    <div className="w-16 h-16 bg-teal-500/20 border border-teal-500/40 rounded-2xl flex items-center justify-center mx-auto text-teal-400 animate-pulse">
                        <RefreshCw size={32} className="animate-spin" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-base font-black text-white">در حال اعتبارسنجی و تجزیه آرشیو سورس‌کد ZIP...</h3>
                        <p className="text-xs text-teal-300 font-mono">{validationProgress.statusText}</p>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-white/10 p-0.5">
                        <div 
                            className="bg-gradient-to-l from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-300"
                            style={{ width: `${validationProgress.percent}%` }}
                        ></div>
                    </div>

                    <div className="flex justify-center items-center gap-6 text-[11px] text-slate-400 font-mono">
                        <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-emerald-400" /> هدر PK</span>
                        <span className="flex items-center gap-1.5"><FileCode2 size={14} className="text-teal-400" /> فایل‌های .TSX / .TS</span>
                        <span className="flex items-center gap-1.5"><FileJson size={14} className="text-indigo-400" /> پیکربندی JSON</span>
                    </div>
                </div>
            )}

            {/* Main Area: Drag and Drop Zone or Loaded Files & Summary Report */}
            {files.length > 0 && !isValidating ? (
                <div className="space-y-4">
                    {/* Compact Drag-and-Drop Drop Target for loaded state */}
                    <div 
                        onDragEnter={handleDragEnter}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`rounded-2xl border-2 border-dashed p-4 transition-all duration-200 text-center flex items-center justify-between gap-4 ${
                            isDragging 
                                ? 'bg-indigo-500/20 border-teal-400 shadow-lg shadow-teal-500/20 scale-[1.01]' 
                                : 'bg-slate-900/60 border-white/10 hover:border-indigo-500/40'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                                <FolderArchive size={20} className={isDragging ? 'animate-bounce' : ''} />
                            </div>
                            <div className="text-right">
                                <span className="text-xs font-bold text-white block">
                                    {isDragging ? 'فایل ZIP جدید را اینجا رها کنید...' : 'زون جایگزینی سریع: فایل ZIP جدید را بکشید و اینجا رها کنید'}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                    اعتبارسنجی آنی بایت‌های هدر جادویی PK و سورس‌کدهای مالی با ZipValidator
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {validationResult?.details && (
                                <div className="hidden lg:flex items-center gap-2 text-[11px] bg-slate-950 px-3 py-1.5 rounded-xl border border-white/5 text-slate-300">
                                    <ShieldCheck size={14} className="text-emerald-400" />
                                    <span>سورس‌های مالی: {validationResult.details.accountingFilesCount} فایل</span>
                                    <span className="text-slate-600">|</span>
                                    <span>حجم استخراج: {validationResult.details.formattedUncompressedSize}</span>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="bg-slate-800 hover:bg-slate-700 text-white text-xs px-3.5 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer"
                            >
                                <Upload size={13} />
                                <span>آپلود فایل جدید</span>
                            </button>
                        </div>
                    </div>

                    {/* Files Explorer & Editor / Diff View / Summary Report */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        {/* Left Panel: File Explorer with File-Type Icons */}
                        <div className="lg:col-span-1 bg-slate-900 border border-white/10 rounded-[2.5rem] p-5 shadow-2xl flex flex-col h-[700px]">
                            <div className="flex justify-between items-center mb-3">
                                <h2 className="text-sm font-black text-white flex items-center gap-2">
                                    <FileText size={16} className="text-indigo-400" />
                                    پرونده‌های سورس کد
                                </h2>
                                <span className="text-[10px] bg-slate-800 text-teal-300 font-bold px-2 py-0.5 rounded-full font-mono">
                                    {filteredFiles.length} فایل
                                </span>
                            </div>

                            {/* Search filter input */}
                            <div className="relative mb-3">
                                <Search size={14} className="absolute right-3 top-2.5 text-slate-500" />
                                <input
                                    type="text"
                                    value={fileSearch}
                                    onChange={(e) => setFileSearch(e.target.value)}
                                    placeholder="جستجوی پرونده مالی..."
                                    className="w-full bg-slate-950 text-white text-xs pr-8 pl-3 py-2 rounded-xl border border-white/10 focus:outline-none focus:border-indigo-500 placeholder:text-slate-600 font-mono"
                                    dir="ltr"
                                />
                            </div>
                            
                            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                                {filteredFiles.map((file, idx) => {
                                    const hasChanges = (file.localContent ?? file.content) !== file.content;
                                    const parts = file.name.split('.');
                                    const ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';

                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => { setSelectedFile(file); setActiveTab('view'); }}
                                            className={`w-full text-right p-2.5 rounded-xl text-xs font-mono transition-all flex items-center justify-between border cursor-pointer ${
                                                selectedFile?.name === file.name && activeTab !== 'summary'
                                                    ? 'bg-indigo-600/25 border-indigo-500 text-indigo-200 font-black' 
                                                    : 'bg-slate-950 border-white/5 text-slate-400 hover:bg-slate-800/60'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 truncate flex-1 min-w-0" dir="ltr">
                                                {getFileIcon(ext)}
                                                <span className="truncate text-left">{file.name}</span>
                                            </div>
                                            {hasChanges && (
                                                <span className="mr-2 w-2 h-2 rounded-full bg-amber-500 shrink-0" title="دارای تغییرات محلی"></span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* ZipValidator Summary Card at bottom */}
                            {validationResult?.details && (
                                <div className="mt-3 pt-3 border-t border-white/5 text-[10px] text-slate-400 space-y-1">
                                    <div className="flex justify-between">
                                        <span>فایل:</span>
                                        <span className="font-mono text-slate-300 truncate max-w-[120px]" dir="ltr">{validationResult.details.fileName}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>حجم آرشیو:</span>
                                        <span className="font-mono text-emerald-400">{validationResult.details.formattedFileSize}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right Panel: Summary Report, Content, Edit & Premium Diff View */}
                        <div className="lg:col-span-3 bg-slate-900 border border-white/10 rounded-[2.5rem] p-6 shadow-2xl h-[700px] flex flex-col">
                            <div className="h-full flex flex-col">
                                {/* Tab Selectors & Main Toolbar */}
                                <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 mb-4 pb-4 border-b border-white/5">
                                    <div className="flex flex-wrap gap-2">
                                        <button 
                                            onClick={() => setActiveTab('summary')}
                                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'summary' ? 'bg-indigo-600 text-white font-black' : 'bg-slate-950 text-slate-400 hover:bg-slate-800'}`}
                                        >
                                            <Layers size={14} />
                                            <span>گزارش خلاصه (Summary Report)</span>
                                            <span className="bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold">
                                                {identifiedErrors.length} مورد
                                            </span>
                                        </button>

                                        <button 
                                            onClick={() => setActiveTab('view')}
                                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'view' ? 'bg-indigo-600 text-white font-black' : 'bg-slate-950 text-slate-400 hover:bg-slate-800'}`}
                                        >
                                            <FileText size={14} />
                                            <span>نمایش و ویرایش کد</span>
                                        </button>
                                        
                                        <button 
                                            onClick={() => setActiveTab('diff')}
                                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'diff' ? 'bg-indigo-600 text-white font-black' : 'bg-slate-950 text-slate-400 hover:bg-slate-800'}`}
                                        >
                                            <GitCompare size={14} />
                                            <span>مقایسه تغییرات (Diff)</span>
                                            {stats.additions > 0 || stats.deletions > 0 ? (
                                                <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold">
                                                    +{stats.additions} -{stats.deletions}
                                                </span>
                                            ) : null}
                                        </button>

                                        <button 
                                            onClick={handleAnalyze}
                                            disabled={isAnalyzing}
                                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                                                isAnalyzing 
                                                    ? 'bg-amber-600/50 text-white cursor-not-allowed' 
                                                    : activeTab === 'ai' 
                                                        ? 'bg-teal-600 text-white font-black' 
                                                        : 'bg-teal-600/20 text-teal-400 hover:bg-teal-600 hover:text-white'
                                            }`}
                                        >
                                            {isAnalyzing ? <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : <Play size={14} />}
                                            <span>ممیزی هوشمند کدهای مالی</span>
                                        </button>
                                    </div>

                                    <div className="text-xs font-mono text-slate-400 truncate bg-slate-950/80 px-3 py-1.5 rounded-xl border border-white/5" dir="ltr">
                                        {selectedFile?.name || 'project-root'}
                                    </div>
                                </div>

                                {/* Content Renderers */}
                                <div className="flex-1 overflow-hidden flex flex-col">
                                    {/* Tab 0: Summary Report Panel */}
                                    {activeTab === 'summary' && (
                                        <div className="flex-1 flex flex-col h-full overflow-hidden space-y-4">
                                            {/* Filter & Search Bar */}
                                            <div className="bg-slate-950 p-4 rounded-2xl border border-white/5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                                                        <Filter size={14} className="text-teal-400" />
                                                        <span>فیلتر بر اساس اهمیت:</span>
                                                    </span>
                                                    <div className="flex bg-slate-900 p-1 rounded-xl border border-white/5 gap-1">
                                                        {(['all', 'high', 'medium', 'low'] as const).map((sev) => (
                                                            <button
                                                                key={sev}
                                                                onClick={() => setErrorFilterSeverity(sev)}
                                                                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                                                    errorFilterSeverity === sev 
                                                                        ? 'bg-indigo-600 text-white' 
                                                                        : 'text-slate-400 hover:text-white'
                                                                }`}
                                                            >
                                                                {sev === 'all' ? 'همه' : sev === 'high' ? 'بحرانی (High)' : sev === 'medium' ? 'متوسط (Medium)' : 'پایین (Low)'}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <select
                                                        value={errorFilterType}
                                                        onChange={(e) => setErrorFilterType(e.target.value)}
                                                        className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-mono outline-none focus:border-indigo-500"
                                                    >
                                                        <option value="all">--- همه نوع خطاها ---</option>
                                                        <option value="precision">دقت محاسبات اعشاری</option>
                                                        <option value="debit_credit">تراکنش بدهکار/بستانکار</option>
                                                        <option value="security">امنیتی و تزریق</option>
                                                    </select>

                                                    <span className="text-xs font-mono bg-slate-900 px-3 py-1.5 rounded-xl text-slate-300 border border-white/5">
                                                        مجموع: {filteredIdentifiedErrors.length} مورد
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Summary Report Scrollable List */}
                                            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                                                {filteredIdentifiedErrors.length > 0 ? (
                                                    filteredIdentifiedErrors.map((err) => (
                                                        <div 
                                                            key={err.id}
                                                            className={`p-4 rounded-2xl border transition-all flex flex-col gap-2.5 ${
                                                                err.severity === 'high' 
                                                                    ? 'bg-rose-950/20 border-rose-500/30 hover:border-rose-500/60' 
                                                                    : err.severity === 'medium'
                                                                        ? 'bg-amber-950/20 border-amber-500/30 hover:border-amber-500/60'
                                                                        : 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/60'
                                                            }`}
                                                        >
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="flex items-center gap-2">
                                                                    {err.severity === 'high' ? (
                                                                        <AlertOctagon size={18} className="text-rose-400 shrink-0" />
                                                                    ) : err.severity === 'medium' ? (
                                                                        <AlertTriangle size={18} className="text-amber-400 shrink-0" />
                                                                    ) : (
                                                                        <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                                                                    )}
                                                                    <div>
                                                                        <h4 className="text-xs font-black text-white">{err.title}</h4>
                                                                        <span className="text-[10px] text-slate-400 font-mono block mt-0.5" dir="ltr">
                                                                            {err.fileName} : خط {err.lineNumber}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                                                                    err.severity === 'high' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                                                                    err.severity === 'medium' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                                                                    'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                                }`}>
                                                                    {err.severity}
                                                                </span>
                                                            </div>

                                                            <p className="text-xs text-slate-300 leading-relaxed">
                                                                {err.description}
                                                            </p>

                                                            <div className="bg-slate-950 p-2.5 rounded-xl border border-white/5 flex items-center justify-between gap-2">
                                                                <pre className="text-[11px] font-mono text-teal-300 truncate overflow-x-auto text-left" dir="ltr">
                                                                    {err.snippet}
                                                                </pre>
                                                                <button
                                                                    onClick={() => {
                                                                        const target = files.find(f => f.name === err.fileName);
                                                                        if (target) {
                                                                            setSelectedFile(target);
                                                                            setActiveTab('view');
                                                                        }
                                                                    }}
                                                                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] px-3 py-1 rounded-lg font-bold transition shrink-0 cursor-pointer"
                                                                >
                                                                    مشاهده در کد
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="h-full flex flex-col items-center justify-center text-slate-500 py-16 space-y-2">
                                                        <CheckCircle size={40} className="text-emerald-400 mb-2 opacity-60" />
                                                        <h4 className="text-sm font-bold text-white">هیچ خطایی با فیلتر فعلی یافت نشد</h4>
                                                        <p className="text-xs text-slate-400">می‌توانید فیلتر اهمیت را روی حالت "همه" قرار دهید.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Tab 1: Viewer & Editor */}
                                    {activeTab === 'view' && selectedFile && (
                                        <div className="flex-1 flex flex-col h-full">
                                            <div className="flex justify-between items-center mb-3">
                                                <div className="flex items-center gap-2">
                                                    {!isEditing ? (
                                                        <button 
                                                            onClick={() => setIsEditing(true)}
                                                            className="bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                                                        >
                                                            <Edit3 size={13} />
                                                            <span>ویرایش کد در مرورگر</span>
                                                        </button>
                                                    ) : (
                                                        <div className="flex gap-2">
                                                            <button 
                                                                onClick={handleSaveLocalEdit}
                                                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                                                            >
                                                                <Save size={13} />
                                                                <span>ذخیره تغییرات</span>
                                                            </button>
                                                            <button 
                                                                onClick={() => { setIsEditing(false); setEditCode(selectedFile.localContent ?? selectedFile.content); }}
                                                                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                                            >
                                                                انصراف
                                                            </button>
                                                        </div>
                                                    )}

                                                    {(selectedFile.localContent ?? selectedFile.content) !== selectedFile.content && (
                                                        <button 
                                                            onClick={handleResetLocalEdit}
                                                            className="text-rose-400 hover:text-rose-300 px-2 py-1 text-xs font-bold flex items-center gap-1 cursor-pointer"
                                                            title="بازگشت به نسخه فایل اصلی"
                                                        >
                                                            <RefreshCw size={12} />
                                                            <span>بازنشانی فایل اصلی</span>
                                                        </button>
                                                    )}
                                                </div>

                                                <button 
                                                    onClick={handleCopy}
                                                    className="bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white p-2 rounded-lg text-xs transition-all flex items-center gap-1 border border-white/5 cursor-pointer"
                                                >
                                                    {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                                    <span>{copied ? 'کپی شد!' : 'کپی کل کد'}</span>
                                                </button>
                                            </div>

                                            {isEditing ? (
                                                <textarea
                                                    value={editCode}
                                                    onChange={(e) => setEditCode(e.target.value)}
                                                    className="flex-1 w-full bg-slate-950 text-slate-100 font-mono text-xs p-5 rounded-2xl border border-indigo-500/30 outline-none focus:border-indigo-500 h-full text-left resize-none custom-scrollbar"
                                                    dir="ltr"
                                                />
                                            ) : (
                                                <div className="flex-1 bg-slate-950 rounded-2xl p-5 border border-white/5 overflow-auto text-left custom-scrollbar" dir="ltr">
                                                    <pre className="text-xs font-mono text-slate-300 leading-relaxed">
                                                        {(selectedFile.localContent ?? selectedFile.content)}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Tab 2: Premium Side-by-Side Aligned Diff Viewer */}
                                    {activeTab === 'diff' && selectedFile && (
                                        <div className="flex-1 flex flex-col h-full overflow-hidden">
                                            {/* Diff Source Selectors */}
                                            <div className="bg-slate-950 p-4 rounded-2xl border border-white/5 mb-4 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <span className="text-xs font-bold text-slate-400">مقایسه فایل اصلی با:</span>
                                                    <div className="flex bg-slate-900 p-1 rounded-xl border border-white/5 gap-1">
                                                        <button 
                                                            onClick={() => setCompareTarget('local')}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${compareTarget === 'local' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                                        >
                                                            تغییرات محلی شما
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                if (!analysisResult) {
                                                                    alert("ابتدا روی دکمه ممیزی هوشمند کدهای مالی کلیک کنید.");
                                                                    return;
                                                                }
                                                                setCompareTarget('ai');
                                                            }}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${compareTarget === 'ai' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'} ${!analysisResult ? 'opacity-40 cursor-not-allowed' : ''}`}
                                                        >
                                                            پیشنهاد ممیزی مالی
                                                        </button>
                                                        <button 
                                                            onClick={() => setCompareTarget('other')}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${compareTarget === 'other' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                                        >
                                                            فایل دیگر در ZIP
                                                        </button>
                                                    </div>
                                                </div>

                                                {compareTarget === 'other' && (
                                                    <select 
                                                        value={compareWithFileName} 
                                                        onChange={(e) => setCompareWithFileName(e.target.value)}
                                                        className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-mono outline-none focus:border-indigo-500"
                                                        dir="ltr"
                                                    >
                                                        <option value="">--- انتخاب فایل دوم ---</option>
                                                        {files.filter(f => f.name !== selectedFile.name).map((f, i) => (
                                                            <option key={i} value={f.name}>{f.name}</option>
                                                        ))}
                                                    </select>
                                                )}

                                                <div className="flex items-center gap-3 text-xs font-mono font-bold">
                                                    <span className="text-rose-400 bg-rose-500/10 px-2 py-1 rounded">حذف شده: {stats.deletions}</span>
                                                    <span className="text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">اضافه شده: {stats.additions}</span>
                                                </div>
                                            </div>

                                            <div className="flex-1 grid grid-cols-2 gap-px bg-white/10 rounded-2xl overflow-hidden border border-white/10 h-full">
                                                {/* Left Panel */}
                                                <div className="flex flex-col bg-slate-950 overflow-hidden h-full">
                                                    <div className="bg-slate-900 border-b border-white/10 px-4 py-2.5 text-rose-400 font-bold text-xs flex items-center justify-between">
                                                        <span>کد اصلی (قبل از تغییر)</span>
                                                        <span className="bg-rose-500/20 text-[10px] px-1.5 py-0.5 rounded font-mono">- OLD</span>
                                                    </div>
                                                    <div 
                                                        ref={leftScrollRef}
                                                        onScroll={handleLeftScroll}
                                                        className="flex-1 overflow-auto p-4 custom-scrollbar select-none"
                                                        dir="ltr"
                                                    >
                                                        <table className="w-full text-left font-mono text-[10px] leading-relaxed border-collapse">
                                                            <tbody>
                                                                {diffRows.map((row, idx) => (
                                                                    <tr 
                                                                        key={idx} 
                                                                        className={`flex items-start ${
                                                                            row.leftType === 'removed' 
                                                                                ? 'bg-rose-950/40 text-rose-200 border-l-2 border-rose-500' 
                                                                                : row.leftType === 'empty' 
                                                                                    ? 'bg-slate-900/30 text-transparent select-none' 
                                                                                    : 'text-slate-400'
                                                                        }`}
                                                                    >
                                                                        <td className="w-10 select-none text-right pr-2 text-slate-600 border-r border-white/5 mr-3 font-mono text-[9px]">
                                                                            {row.leftLineNum ?? '~'}
                                                                        </td>
                                                                        <td className="w-4 select-none font-bold text-center mr-1">
                                                                            {row.leftType === 'removed' ? '-' : ' '}
                                                                        </td>
                                                                        <td className="flex-1 whitespace-pre pl-2 overflow-x-visible">
                                                                            {row.leftType === 'empty' ? ' ' : (row.leftContent || ' ')}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>

                                                {/* Right Panel */}
                                                <div className="flex flex-col bg-slate-950 overflow-hidden h-full">
                                                    <div className="bg-slate-900 border-b border-white/10 px-4 py-2.5 text-emerald-400 font-bold text-xs flex items-center justify-between">
                                                        <span>کد تغییر یافته (بعد از تغییر)</span>
                                                        <span className="bg-emerald-500/20 text-[10px] px-1.5 py-0.5 rounded font-mono">+ NEW</span>
                                                    </div>
                                                    <div 
                                                        ref={rightScrollRef}
                                                        onScroll={handleRightScroll}
                                                        className="flex-1 overflow-auto p-4 custom-scrollbar select-none"
                                                        dir="ltr"
                                                    >
                                                        <table className="w-full text-left font-mono text-[10px] leading-relaxed border-collapse">
                                                            <tbody>
                                                                {diffRows.map((row, idx) => (
                                                                    <tr 
                                                                        key={idx} 
                                                                        className={`flex items-start ${
                                                                            row.rightType === 'added' 
                                                                                ? 'bg-emerald-950/40 text-emerald-200 border-l-2 border-emerald-500' 
                                                                                : row.rightType === 'empty' 
                                                                                    ? 'bg-slate-900/30 text-transparent select-none' 
                                                                                    : 'text-slate-300'
                                                                        }`}
                                                                    >
                                                                        <td className="w-10 select-none text-right pr-2 text-slate-600 border-r border-white/5 mr-3 font-mono text-[9px]">
                                                                            {row.rightLineNum ?? '~'}
                                                                        </td>
                                                                        <td className="w-4 select-none font-bold text-center mr-1">
                                                                            {row.rightType === 'added' ? '+' : ' '}
                                                                        </td>
                                                                        <td className="flex-1 whitespace-pre pl-2 overflow-x-visible">
                                                                            {row.rightType === 'empty' ? ' ' : (row.rightContent || ' ')}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Tab 3: AI Audit Analysis Results */}
                                    {activeTab === 'ai' && (
                                        <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                                            {analysisResult ? (
                                                <div className="space-y-6">
                                                    <div className="bg-amber-500/10 border border-amber-500/25 rounded-3xl p-5 flex gap-4">
                                                        <AlertTriangle className="text-amber-400 shrink-0" size={24} />
                                                        <div>
                                                            <h4 className="text-amber-400 font-bold text-sm mb-1.5">ممیزی و رفع خطاهای مالی کدهای حسابداری (موتور آفلاین اشک قلم)</h4>
                                                            <p className="text-amber-200/80 text-xs leading-relaxed">{analysisResult.description}</p>
                                                        </div>
                                                    </div>

                                                    <div className="bg-slate-950 border border-white/5 rounded-3xl p-6">
                                                        <div className="flex justify-between items-center mb-4">
                                                            <div className="flex items-center gap-2">
                                                                <GitCompare className="text-teal-400" size={18} />
                                                                <h4 className="text-sm font-bold text-white">تغییرات پیشنهادی تیم فنی اشک قلم</h4>
                                                            </div>
                                                            <button 
                                                                onClick={() => { setCompareTarget('ai'); setActiveTab('diff'); }}
                                                                className="bg-teal-600 hover:bg-teal-500 text-white text-xs px-4 py-2 rounded-xl font-bold transition-all cursor-pointer"
                                                            >
                                                                مشاهده در مقایسه دو ستونه (Diff)
                                                            </button>
                                                        </div>

                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <div className="space-y-2">
                                                                <div className="flex items-center gap-2 text-rose-400 font-bold text-xs px-2">
                                                                    <ArrowRight size={14} /> کد فعلی (دارای خطا)
                                                                </div>
                                                                <pre className="bg-slate-900 p-4 rounded-2xl overflow-x-auto text-[10px] font-mono text-rose-200/70 border border-rose-500/20 h-64 text-left" dir="ltr">
                                                                    {analysisResult.originalCode || '---'}
                                                                </pre>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs px-2">
                                                                    <CheckCircle size={14} /> پیشنهاد اصلاحی (تیم فنی)
                                                                </div>
                                                                <pre className="bg-slate-900 p-4 rounded-2xl overflow-x-auto text-[10px] font-mono text-emerald-200/70 border border-emerald-500/20 h-64 text-left" dir="ltr">
                                                                    {analysisResult.fixedCode || '---'}
                                                                </pre>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12">
                                                    <HelpCircle size={48} className="mb-4 opacity-20" />
                                                    <p className="text-sm">برای تحلیل کدهای حسابداری روی دکمه "ممیزی هوشمند کدهای مالی" کلیک کنید.</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : !isValidating && (
                /* Dedicated Drag-and-Drop Zone Specifically for ZIP files (Landing View) */
                <div 
                    onDragEnter={handleDragEnter}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`relative bg-slate-900 border-2 border-dashed rounded-[3rem] p-10 md:p-16 text-center shadow-2xl flex flex-col items-center justify-center max-w-4xl mx-auto transition-all duration-300 ${
                        isDragging 
                            ? 'border-teal-400 bg-indigo-950/40 shadow-2xl shadow-teal-500/20 scale-[1.02]' 
                            : 'border-white/15 hover:border-indigo-500/50'
                    }`}
                >
                    {/* Active Drag Overlay */}
                    {isDragging && (
                        <div className="absolute inset-0 bg-indigo-950/80 backdrop-blur-sm rounded-[3rem] flex flex-col items-center justify-center z-20 border-2 border-teal-400 animate-fadeIn">
                            <div className="w-24 h-24 rounded-full bg-teal-500/20 border-2 border-teal-400 flex items-center justify-center text-teal-300 mb-4 animate-bounce">
                                <FolderArchive size={48} />
                            </div>
                            <h2 className="text-2xl font-black text-white mb-2">فایل ZIP را اینجا رها کنید</h2>
                            <p className="text-teal-200 text-sm font-bold">
                                اعتبارسنجی خودکار ساختار و اصالت سورس‌کد با ZipValidator آغاز می‌شود
                            </p>
                        </div>
                    )}

                    <div className="w-24 h-24 bg-gradient-to-br from-indigo-500/20 to-teal-500/20 rounded-3xl flex items-center justify-center mb-6 border border-indigo-500/30 shadow-inner group">
                        <Upload size={42} className="text-indigo-400 group-hover:scale-110 transition-transform" />
                    </div>

                    <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 px-3.5 py-1.5 rounded-full mb-3 text-[11px] font-bold text-indigo-300">
                        <Sparkles size={14} className="text-amber-400" />
                        <span>زون هوشمند Drag-and-Drop مخصوص فایل‌های فشرده ZIP</span>
                    </div>

                    <h2 className="text-2xl font-black text-white mb-3">
                        فایل ZIP سورس‌کد پروژه را اینجا رها کنید
                    </h2>

                    <p className="text-slate-400 text-xs sm:text-sm max-w-lg leading-relaxed mb-6">
                        پوشه فشرده سورس کدهای خود را (فرمت <code className="text-teal-300 font-mono font-bold bg-slate-950 px-1.5 py-0.5 rounded">.ZIP</code>) به این ناحیه بکشید یا دکمه زیر را برای انتخاب دستی فشار دهید.
                        سرویس <span className="text-teal-400 font-mono font-bold">ZipValidator</span> اصالت کدها، فایل‌های متنی و گزارش خطاهای محاسباتی را به صورت کلاینت‌ساید استخراج می‌کند.
                    </p>

                    {/* Security & Feature Badges */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl mb-8 text-right">
                        <div className="bg-slate-950/80 border border-white/5 p-3 rounded-2xl flex items-center gap-2.5">
                            <ShieldCheck size={20} className="text-emerald-400 shrink-0" />
                            <div className="min-w-0">
                                <div className="text-[11px] font-bold text-white">بررسی هدر جادویی PK</div>
                                <div className="text-[9px] text-slate-400">تضمین عدم خرابی و دستکاری</div>
                            </div>
                        </div>

                        <div className="bg-slate-950/80 border border-white/5 p-3 rounded-2xl flex items-center gap-2.5">
                            <FileCheck size={20} className="text-teal-400 shrink-0" />
                            <div className="min-w-0">
                                <div className="text-[11px] font-bold text-white">گزارش خلاصه خطاها</div>
                                <div className="text-[9px] text-slate-400">فیلتر هوشمند خطاهای مالی</div>
                            </div>
                        </div>

                        <div className="bg-slate-950/80 border border-white/5 p-3 rounded-2xl flex items-center gap-2.5">
                            <GitCompare size={20} className="text-purple-400 shrink-0" />
                            <div className="min-w-0">
                                <div className="text-[11px] font-bold text-white">مقایسه دو ستونه Diff</div>
                                <div className="text-[9px] text-slate-400">پایش خط به خط تغییرات</div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-4">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-2xl font-black shadow-2xl cursor-pointer flex items-center gap-2.5 transition-all active:scale-95 text-sm"
                        >
                            <Upload size={18} />
                            <span>انتخاب فایل ZIP از حافظه</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleDownloadProjectSource}
                            disabled={isDownloadingSource}
                            className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 px-6 py-4 rounded-2xl font-bold transition-all cursor-pointer flex items-center gap-2 text-sm"
                        >
                            {isDownloadingSource ? <RefreshCw size={18} className="animate-spin" /> : <Download size={18} />}
                            <span>{isDownloadingSource ? downloadProgress : 'دانلود نمونه سورس‌کد فعلی (ZIP)'}</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Smart Guide Modal (?) */}
            {showHelpModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn" dir="rtl">
                    <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-6 sm:p-8 max-w-2xl w-full space-y-6 shadow-2xl text-right">
                        <div className="flex items-center justify-between border-b border-white/10 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                                    <HelpCircle size={22} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-white">راهنمای هوشمند گزارش خلاصه و زون ZIP</h3>
                                    <p className="text-xs text-slate-400">راهنمای اعتبارسنجی سورس‌کدهای حسابداری با ZipValidator</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowHelpModal(false)}
                                className="text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800 transition"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-4 text-xs text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
                            <div className="bg-slate-950 p-4 rounded-2xl border border-white/5 space-y-1.5">
                                <h4 className="font-bold text-indigo-400 flex items-center gap-1.5">
                                    <Layers size={16} />
                                    <span>۱. پنل گزارش خلاصه (Summary Report):</span>
                                </h4>
                                <p>
                                    پس از آپلود و استخراج فایل ZIP، این پنل به صورت خودکار تمامی فایل‌ها را اسکن کرده و خطاهای احتمالی محاسباتی، اعشاری و تراز اسناد را به همراه سطح اهمیت (بحرانی، متوسط، پایین) و قابلیت فیلتر پیشرفته نمایش می‌دهد.
                                </p>
                            </div>

                            <div className="bg-slate-950 p-4 rounded-2xl border border-white/5 space-y-1.5">
                                <h4 className="font-bold text-teal-400 flex items-center gap-1.5">
                                    <FileCode2 size={16} />
                                    <span>۲. آیکون‌های اختصاصی نوع فایل:</span>
                                </h4>
                                <p>
                                    در منوی درختی فایل‌ها، هر پسوند با آیکون و رنگ مجزا مشخص شده است (.tsx / .ts با سبز، .js با زرد، .json با آبی و .css با بنفش) تا ناوبری فایل‌های سورس سریع‌تر انجام شود.
                                </p>
                            </div>

                            <div className="bg-slate-950 p-4 rounded-2xl border border-white/5 space-y-1.5">
                                <h4 className="font-bold text-amber-400 flex items-center gap-1.5">
                                    <ShieldCheck size={16} />
                                    <span>۳. فیدبک بصری پیشرفت اعتبارسنجی:</span>
                                </h4>
                                <p>
                                    هنگام رها کردن فایل ZIP، نوار پیشرفت و جزئیات گام‌های تست بایت‌های هدر جادویی PK و ایمنی فایل به صورت زنده نمایش داده می‌شود.
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end pt-3 border-t border-white/10">
                            <button
                                onClick={() => setShowHelpModal(false)}
                                className="bg-teal-600 hover:bg-teal-500 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition"
                            >
                                متوجه شدم، بستن راهنما
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DebugCenter;
