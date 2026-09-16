import React, { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { diffLines } from 'diff';
import { 
    Upload, FileCode2, Play, CheckCircle, AlertTriangle, ArrowRight, 
    ArrowLeft, GitCompare, Edit3, Save, RefreshCw, FileText, Check, 
    Copy, ChevronLeft, Trash2, HelpCircle 
} from 'lucide-react';
import { analyzeAccountingCode } from '../services/geminiService';

interface UploadedFile {
    name: string;
    content: string;
    localContent?: string; // Content with local modifications
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

const DebugCenter = () => {
    const [files, setFiles] = useState<UploadedFile[]>([]);
    const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    
    // UI state
    const [activeTab, setActiveTab] = useState<'view' | 'diff' | 'ai'>('view');
    const [isEditing, setIsEditing] = useState(false);
    const [editCode, setEditCode] = useState('');
    const [copied, setCopied] = useState(false);
    
    // Compare targets for the diff view
    const [compareTarget, setCompareTarget] = useState<'local' | 'ai' | 'other'>('local');
    const [compareWithFileName, setCompareWithFileName] = useState<string>('');

    // Refs for synchronized scrolling in side-by-side diff
    const leftScrollRef = useRef<HTMLDivElement>(null);
    const rightScrollRef = useRef<HTMLDivElement>(null);
    const activeScrollRef = useRef<'left' | 'right' | null>(null);

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
            setActiveTab('view');
        }
    }, [selectedFile]);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const zip = await JSZip.loadAsync(file);
            const extractedFiles: UploadedFile[] = [];

            const promises: Promise<void>[] = [];

            zip.forEach((relativePath, zipEntry) => {
                if (!zipEntry.dir && (
                    relativePath.endsWith('.ts') || 
                    relativePath.endsWith('.tsx') || 
                    relativePath.endsWith('.js') || 
                    relativePath.endsWith('.jsx') ||
                    relativePath.endsWith('.json') ||
                    relativePath.endsWith('.css')
                )) {
                    const promise = zipEntry.async("string").then(content => {
                        extractedFiles.push({ 
                            name: relativePath, 
                            content,
                            localContent: content 
                        });
                    });
                    promises.push(promise);
                }
            });

            await Promise.all(promises);
            
            // Sort files alphabetically
            extractedFiles.sort((a, b) => a.name.localeCompare(b.name));
            
            setFiles(extractedFiles);
            if (extractedFiles.length > 0) {
                setSelectedFile(extractedFiles[0]);
            }
        } catch (error) {
            console.error("Error extracting ZIP", error);
            alert("خطا در استخراج فایل ZIP");
        }
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
        alert("تغییرات شما به صورت موقت در مرورگر ذخیره شد. حالا می‌توانید تب مقایسه تغییرات را مشاهده کنید.");
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
            alert("خطا در ارتباط با سرور دپارتمان IT اشک قلم برای تحلیل کد حسابداری");
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
            // Safe split of lines avoiding trailing empty strings due to terminal \n
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
            {/* Header section */}
            <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-2xl font-black text-white flex items-center gap-3">
                        <FileCode2 className="text-teal-400" size={28} />
                        مرکز بازبینی و ممیزی کدهای حسابداری (دپارتمان IT اشک قلم)
                    </h1>
                    <p className="text-sm text-slate-400 mt-2">
                        یک فایل ZIP از سورس کد پروژه آپلود کنید تا مقایسه کد، خطایابی و تحلیل ساختار مالی به صورت خودکار انجام شود.
                    </p>
                </div>
                <div>
                    <label className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl font-black shadow-xl cursor-pointer flex items-center gap-2 transition-all active:scale-95">
                        <Upload size={18} />
                        <span>آپلود فایل ZIP پروژه</span>
                        <input type="file" accept=".zip" className="hidden" onChange={handleFileUpload} />
                    </label>
                </div>
            </div>

            {files.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Left Panel: File Explorer */}
                    <div className="lg:col-span-1 bg-slate-900 border border-white/10 rounded-[2.5rem] p-6 shadow-2xl flex flex-col h-[700px]">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-black text-white flex items-center gap-2">
                                <FileText size={18} className="text-indigo-400" />
                                پرونده‌های سورس
                            </h2>
                            <span className="text-[10px] bg-slate-800 text-slate-300 font-bold px-2 py-1 rounded-full">
                                {files.length} فایل
                            </span>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                            {files.map((file, idx) => {
                                const hasChanges = (file.localContent ?? file.content) !== file.content;
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => setSelectedFile(file)}
                                        className={`w-full text-right p-3 rounded-xl text-xs font-mono transition-all flex items-center justify-between border ${
                                            selectedFile?.name === file.name 
                                                ? 'bg-indigo-600/25 border-indigo-500 text-indigo-200 font-black' 
                                                : 'bg-slate-950 border-white/5 text-slate-400 hover:bg-slate-800/60'
                                        }`}
                                    >
                                        <span className="truncate flex-1 text-left" dir="ltr">{file.name}</span>
                                        {hasChanges && (
                                            <span className="mr-2 w-2 h-2 rounded-full bg-amber-500 shrink-0" title="دارای تغییرات محلی"></span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Panel: Content, Edit & Premium Diff View */}
                    <div className="lg:col-span-3 bg-slate-900 border border-white/10 rounded-[2.5rem] p-6 shadow-2xl h-[700px] flex flex-col">
                        {selectedFile ? (
                            <div className="h-full flex flex-col">
                                {/* Tab Selectors & Main Toolbar */}
                                <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 mb-4 pb-4 border-b border-white/5">
                                    <div className="flex flex-wrap gap-2">
                                        <button 
                                            onClick={() => setActiveTab('view')}
                                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'view' ? 'bg-indigo-600 text-white font-black' : 'bg-slate-950 text-slate-400 hover:bg-slate-800'}`}
                                        >
                                            <FileText size={14} />
                                            <span>نمایش و ویرایش کد</span>
                                        </button>
                                        
                                        <button 
                                            onClick={() => setActiveTab('diff')}
                                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'diff' ? 'bg-indigo-600 text-white font-black' : 'bg-slate-950 text-slate-400 hover:bg-slate-800'}`}
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
                                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                                                isAnalyzing 
                                                    ? 'bg-amber-600/50 text-white cursor-not-allowed' 
                                                    : activeTab === 'ai' 
                                                        ? 'bg-teal-600 text-white font-black' 
                                                        : 'bg-teal-600/20 text-teal-400 hover:bg-teal-600 hover:text-white'
                                            }`}
                                        >
                                            {isAnalyzing ? <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : <Play size={14} />}
                                            <span>تحلیل کدهای مالی (دپارتمان IT اشک قلم)</span>
                                        </button>
                                    </div>

                                    <div className="text-xs font-mono text-slate-400 truncate bg-slate-950/80 px-3 py-1.5 rounded-xl border border-white/5" dir="ltr">
                                        {selectedFile.name}
                                    </div>
                                </div>

                                {/* Content Renderers */}
                                <div className="flex-1 overflow-hidden flex flex-col">
                                    {/* Tab 1: Viewer & Editor */}
                                    {activeTab === 'view' && (
                                        <div className="flex-1 flex flex-col h-full">
                                            <div className="flex justify-between items-center mb-3">
                                                <div className="flex items-center gap-2">
                                                    {!isEditing ? (
                                                        <button 
                                                            onClick={() => setIsEditing(true)}
                                                            className="bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
                                                        >
                                                            <Edit3 size={13} />
                                                            <span>ویرایش کد در مرورگر</span>
                                                        </button>
                                                    ) : (
                                                        <div className="flex gap-2">
                                                            <button 
                                                                onClick={handleSaveLocalEdit}
                                                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
                                                            >
                                                                <Save size={13} />
                                                                <span>ذخیره تغییرات</span>
                                                            </button>
                                                            <button 
                                                                onClick={() => { setIsEditing(false); setEditCode(selectedFile.localContent ?? selectedFile.content); }}
                                                                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                                                            >
                                                                انصراف
                                                            </button>
                                                        </div>
                                                    )}

                                                    {(selectedFile.localContent ?? selectedFile.content) !== selectedFile.content && (
                                                        <button 
                                                            onClick={handleResetLocalEdit}
                                                            className="text-rose-400 hover:text-rose-300 px-2 py-1 text-xs font-bold flex items-center gap-1"
                                                            title="بازگشت به نسخه فایل اصلی"
                                                        >
                                                            <RefreshCw size={12} />
                                                            <span>بازنشانی فایل اصلی</span>
                                                        </button>
                                                    )}
                                                </div>

                                                <button 
                                                    onClick={handleCopy}
                                                    className="bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white p-2 rounded-lg text-xs transition-all flex items-center gap-1 border border-white/5"
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
                                    {activeTab === 'diff' && (
                                        <div className="flex-1 flex flex-col h-full overflow-hidden">
                                            {/* Diff Source Selectors */}
                                            <div className="bg-slate-950 p-4 rounded-2xl border border-white/5 mb-4 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <span className="text-xs font-bold text-slate-400">مقایسه فایل اصلی با:</span>
                                                    <div className="flex bg-slate-900 p-1 rounded-xl border border-white/5 gap-1">
                                                        <button 
                                                            onClick={() => setCompareTarget('local')}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${compareTarget === 'local' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                                        >
                                                            تغییرات محلی شما
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                if (!analysisResult) {
                                                                    alert("ابتدا باید روی دکمه تحلیل کدهای مالی کلیک کنید.");
                                                                    return;
                                                                }
                                                                setCompareTarget('ai');
                                                            }}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${compareTarget === 'ai' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'} ${!analysisResult ? 'opacity-40 cursor-not-allowed' : ''}`}
                                                        >
                                                            پیشنهاد دپارتمان IT اشک قلم
                                                        </button>
                                                        <button 
                                                            onClick={() => setCompareTarget('other')}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${compareTarget === 'other' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                                        >
                                                            فایل دیگر در ZIP
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Select other file dropdown */}
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

                                                {/* Stats Indicator */}
                                                <div className="flex items-center gap-3 text-xs font-mono font-bold">
                                                    <span className="text-rose-400 bg-rose-500/10 px-2 py-1 rounded">حذف شده: {stats.deletions}</span>
                                                    <span className="text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">اضافه شده: {stats.additions}</span>
                                                </div>
                                            </div>

                                            {/* Diff Side-by-Side Split Code Area */}
                                            <div className="flex-1 grid grid-cols-2 gap-px bg-white/10 rounded-2xl overflow-hidden border border-white/10 h-full">
                                                {/* Left Panel: Original / Old Version */}
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

                                                {/* Right Panel: Changed / New Version */}
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
                                                            <h4 className="text-amber-400 font-bold text-sm mb-1.5">ممیزی و رفع خطاهای مالی کدهای حسابداری (دپارتمان IT اشک قلم)</h4>
                                                            <p className="text-amber-200/80 text-xs leading-relaxed">{analysisResult.description}</p>
                                                        </div>
                                                    </div>

                                                    <div className="bg-slate-950 border border-white/5 rounded-3xl p-6">
                                                        <div className="flex justify-between items-center mb-4">
                                                            <div className="flex items-center gap-2">
                                                                <GitCompare className="text-teal-400" size={18} />
                                                                <h4 className="text-sm font-bold text-white">تغییرات پیشنهادی دپارتمان IT اشک قلم</h4>
                                                            </div>
                                                            <button 
                                                                onClick={() => { setCompareTarget('ai'); setActiveTab('diff'); }}
                                                                className="bg-teal-600 hover:bg-teal-500 text-white text-xs px-4 py-2 rounded-xl font-bold transition-all"
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
                                                    <p className="text-sm">برای تحلیل کدهای حسابداری روی دکمه "تحلیل کدهای مالی (دپارتمان IT اشک قلم)" کلیک کنید.</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-12">
                                <FileCode2 size={64} className="mb-4 opacity-20 text-indigo-400" />
                                <h3 className="text-lg font-black text-white mb-2">پرونده‌ای انتخاب نشده است</h3>
                                <p className="text-xs text-slate-400 text-center max-w-sm">یک فایل از منوی سمت راست انتخاب کنید تا محتوای آن برای تحلیل، ادیت زنده و مقایسه نمایش داده شود.</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* Empty / Landing Upload view */
                <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-12 text-center shadow-2xl flex flex-col items-center justify-center max-w-2xl mx-auto py-24">
                    <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mb-6 border border-indigo-500/20">
                        <Upload size={36} className="text-indigo-400 animate-pulse" />
                    </div>
                    <h2 className="text-xl font-black text-white mb-3">دیباگ و تحلیل حرفه‌ای پروژه مالی</h2>
                    <p className="text-slate-400 text-sm max-w-md leading-relaxed mb-8">
                        پوشه فشرده سورس کدهای خود را (فرمت ZIP) در سیستم آپلود کنید. به سادگی به صورت درختی فایل‌ها را کاوش کنید، خطاها را با دپارتمان IT اشک قلم پیدا کنید و با مقایسه تغییرات (Diff)، کیفیت کد خود را تضمین کنید.
                    </p>
                    <label className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-2xl font-black shadow-2xl cursor-pointer flex items-center gap-2 transition-all active:scale-95 text-sm">
                        <Upload size={18} />
                        <span>شروع با آپلود فایل ZIP</span>
                        <input type="file" accept=".zip" className="hidden" onChange={handleFileUpload} />
                    </label>
                </div>
            )}
        </div>
    );
};

export default DebugCenter;
