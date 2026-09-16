import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, CheckCircle, AlertCircle, RefreshCw, Upload, Image as ImageIcon } from 'lucide-react';
import { CameraService } from '../services/cameraService';
import { isAndroidApp } from '../utils';

interface CameraGuideProps {
    onCapture: (base64: string) => void;
    onClose: () => void;
    title?: string;
    description?: string;
}

export const CameraGuide: React.FC<CameraGuideProps> = ({ 
    onCapture, 
    onClose,
    title = 'اسکن چک با دوربین',
    description = 'چک یا سند را روی سطح صاف قرار داده و درون کادر تنظیم کنید'
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [permissionError, setPermissionError] = useState<string | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const isAndroid = isAndroidApp();

    const tips = [
        '✓ سند را روی سطح صاف و بدون چین‌خوردگی قرار دهید',
        '✓ نور محیط را تنظیم کنید تا بازتاب نور کاهش یابد',
        '✓ دوربین را به صورت عمود بر سند نگه دارید',
        '✓ تمام گوشه‌های سند یا شناسه صیادی داخل کادر باشد'
    ];

    useEffect(() => {
        startCamera();
        return () => stopCamera();
    }, []);

    const startCamera = async () => {
        setPermissionError(null);
        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const mediaStream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } 
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                }
                setStream(mediaStream);
            } else {
                setPermissionError('دسترسی مستقیم به استریم وب‌کم پشتیبانی نمی‌شود. از دکمه دوربین مستقیم استفاده کنید.');
            }
        } catch (err: any) {
            console.warn('Camera stream failed:', err);
            setPermissionError('دسترسی به دوربین توسط سیستم‌عامل محدود شده یا مسدود است.');
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
    };

    const capture = () => {
        if (!videoRef.current) return;
        
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth || 1280;
        canvas.height = videoRef.current.videoHeight || 720;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        
        const base64 = canvas.toDataURL('image/jpeg', 0.92);
        stopCamera();
        onCapture(base64);
    };

    const handleNativeCapture = async () => {
        setIsCapturing(true);
        try {
            stopCamera();
            const photoData = await CameraService.capturePhoto({ quality: 90 });
            if (photoData) {
                onCapture(photoData);
            }
        } catch (err: any) {
            setPermissionError(err.message || 'خطا در اجرای دوربین دستگاه');
        } finally {
            setIsCapturing(false);
        }
    };

    const handlePickFromGallery = async () => {
        try {
            stopCamera();
            const photoData = await CameraService.pickPhotoFromGallery();
            if (photoData) {
                onCapture(photoData);
            }
        } catch (err) {
            console.warn('Pick from gallery error:', err);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col no-print select-none" dir="rtl">
            <div className="flex-1 relative overflow-hidden flex items-center justify-center">
                {!permissionError ? (
                    <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        muted 
                        className="w-full h-full object-cover" 
                    />
                ) : (
                    <div className="p-6 text-center max-w-sm mx-auto space-y-4 text-slate-300">
                        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                            <AlertCircle size={32} />
                        </div>
                        <h4 className="text-white font-bold text-base">{permissionError}</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            در سیستم‌عامل اندروید، لطفاً با فشردن دکمه زیر به دوربین گوشی اجازه دسترسی دهید یا از گالری فایل را بارگذاری کنید.
                        </p>
                        <div className="flex flex-col gap-2 pt-2">
                            <button 
                                onClick={handleNativeCapture}
                                disabled={isCapturing}
                                className="w-full bg-teal-600 hover:bg-teal-500 text-white py-3 px-4 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-lg"
                            >
                                <Camera size={16} />
                                {isCapturing ? 'در حال بازکردن دوربین...' : 'درخواست مجوز و فعال‌سازی دوربین'}
                            </button>
                            <button 
                                onClick={handlePickFromGallery}
                                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                            >
                                <ImageIcon size={16} />
                                انتخاب تصویر از گالری
                            </button>
                        </div>
                    </div>
                )}
                
                {/* Guide overlay */}
                {!permissionError && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4">
                        <div className="w-full max-w-md aspect-[1.6] border-2 border-teal-400/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] relative">
                            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-teal-600 text-white px-3.5 py-1 rounded-full text-[11px] font-black shadow-md whitespace-nowrap">
                                {title}
                            </div>
                            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-slate-300 text-[10px] whitespace-nowrap bg-black/50 px-2 py-0.5 rounded">
                                {description}
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Tips Header */}
                <div className="absolute top-4 left-4 right-4 bg-black/70 backdrop-blur-md rounded-2xl p-3 space-y-1.5 border border-white/10">
                    <div className="flex items-center justify-between text-xs text-white font-bold pb-1 border-b border-white/10">
                        <span>راهنمای ثبت باکیفیت:</span>
                        <span className="text-[10px] text-teal-400 font-mono">{isAndroid ? 'اندروید' : 'دسکتاپ/وب'}</span>
                    </div>
                    {tips.slice(0, 2).map((tip, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-slate-300 text-[11px]">
                            <CheckCircle size={12} className="text-teal-400 shrink-0" />
                            <span>{tip}</span>
                        </div>
                    ))}
                </div>
            </div>
            
            {/* Action Bar */}
            <div className="bg-slate-950/95 border-t border-white/10 p-4 sm:p-5 flex justify-between items-center gap-3">
                <button 
                    type="button"
                    onClick={onClose} 
                    className="p-3.5 bg-white/10 hover:bg-white/20 rounded-2xl text-white transition-colors"
                    title="انصراف و بستن"
                >
                    <X size={20} />
                </button>

                <div className="flex items-center gap-3">
                    <button 
                        type="button"
                        onClick={handlePickFromGallery}
                        className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                        title="انتخاب از گالری"
                    >
                        <ImageIcon size={16} className="text-indigo-400" />
                        <span className="hidden sm:inline">گالری</span>
                    </button>

                    {!permissionError ? (
                        <button 
                            type="button"
                            onClick={capture} 
                            className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-tr from-teal-600 to-emerald-500 rounded-full flex items-center justify-center shadow-xl shadow-teal-900/50 active:scale-95 hover:scale-105 transition-all border-4 border-white/20"
                            title="ثبت عکس"
                        >
                            <Camera size={28} className="text-white" />
                        </button>
                    ) : (
                        <button 
                            type="button"
                            onClick={handleNativeCapture}
                            className="px-6 py-3.5 bg-teal-600 hover:bg-teal-500 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow-lg"
                        >
                            <Camera size={18} />
                            <span>عکس مستقیم</span>
                        </button>
                    )}

                    <button 
                        type="button"
                        onClick={handleNativeCapture}
                        className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                        title="استفاده از دوربین پیش‌فرض سیستم"
                    >
                        <Camera size={16} className="text-teal-400" />
                        <span className="hidden sm:inline">دوربین نیتیو</span>
                    </button>
                </div>

                <div className="w-10"></div>
            </div>
        </div>
    );
};

