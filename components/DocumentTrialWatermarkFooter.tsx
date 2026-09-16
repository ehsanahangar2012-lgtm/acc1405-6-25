import React from 'react';

interface Props {
    className?: string;
    showAlways?: boolean;
}

export const DocumentTrialWatermarkFooter: React.FC<Props> = ({ className = '' }) => {
    return (
        <div 
            id="doc-system-print-footer" 
            className={`w-full text-center mt-auto pt-2.5 pb-1 text-[9.5px] text-slate-500 dark:text-slate-400 font-medium select-none no-break-inside ${className}`}
            dir="rtl"
        >
            <div className="flex items-center justify-center gap-2 flex-wrap text-slate-600 dark:text-slate-400">
                <span className="font-bold text-slate-700 dark:text-slate-300">سیستم حسابداری یکپارچه اشک قلم</span>
                <span className="text-slate-400">|</span>
                <span className="font-mono text-slate-600 dark:text-slate-300 dir-ltr text-[10px]">www.ashkghalam.ir</span>
            </div>
        </div>
    );
};

export default DocumentTrialWatermarkFooter;

