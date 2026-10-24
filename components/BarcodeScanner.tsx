import React, { useRef, useEffect, useState } from 'react';
import { X, Camera, Zap, Upload, AlertCircle, Sparkles, CheckCircle2, HelpCircle } from 'lucide-react';
import { scanBarcodeFromSource, isNativeBarcodeDetectorSupported } from '../services/barcodeService';
import SmartSectionGuide from './SmartSectionGuide';

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [detectedCode, setDetectedCode] = useState<string | null>(null);
  const scanIntervalRef = useRef<any>(null);

  const playSuccessSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // ignore audio errors
    }
  };

  const handleSuccess = (code: string) => {
    if (!code || detectedCode) return;
    setDetectedCode(code);
    playSuccessSound();
    setTimeout(() => {
      onScan(code);
      onClose();
    }, 400);
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let isActive = true;

    const startCamera = async () => {
      try {
        setCameraError(null);
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        });
        if (videoRef.current && isActive) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setScanning(true);

          // اسکن دوره‌ای فریم‌ها
          scanIntervalRef.current = setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) return;
            try {
              const code = await scanBarcodeFromSource(videoRef.current);
              if (code) {
                handleSuccess(code);
              }
            } catch {
              // ignore frame decode err
            }
          }, 300);
        }
      } catch (err: any) {
        if (isActive) {
          console.warn('دسترسی به دوربین برقرار نشد:', err);
          setCameraError('امکان دسترسی به دوربین وجود ندارد. می‌توانید تصویر بارکد را بارگذاری یا کد را دستی وارد کنید.');
        }
      }
    };

    startCamera();

    return () => {
      isActive = false;
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = async () => {
        const code = await scanBarcodeFromSource(img);
        if (code) {
          handleSuccess(code);
        } else {
          alert('بارکدی در تصویر ارسالی یافت نشد. لطفاً کد را به صورت دستی وارد نمایید.');
        }
        URL.revokeObjectURL(img.src);
      };
    } catch {
      alert('خطا در پردازش تصویر بارکد');
    }
  };

  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      handleSuccess(manualCode.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col font-sans" dir="rtl">
      {/* Header */}
      <div className="p-4 bg-slate-900 border-b border-white/10 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center">
            <Camera size={20} />
          </div>
          <div>
            <h3 className="text-white font-black text-sm sm:text-base">اسکنر بارکد و QR Code آفلاین</h3>
            <p className="text-[11px] text-slate-400">شناسایی فوری کد کالا، فاکتور، رسید و چک صیادی</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SmartSectionGuide />
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            title="بستن"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Camera View / Fallback */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="w-full h-full object-cover" 
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Scan Frame */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
          <div className="relative w-64 h-64 sm:w-80 sm:h-80 border-2 border-teal-400/80 rounded-3xl shadow-2xl shadow-teal-500/30 flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 border-4 border-teal-400 rounded-3xl opacity-50 animate-pulse" />
            <div className="absolute w-full h-1 bg-linear-to-r from-transparent via-teal-400 to-transparent top-0 animate-bounce" />
            {detectedCode ? (
              <div className="bg-emerald-500/90 text-white p-4 rounded-2xl flex flex-col items-center gap-2 animate-scale-up">
                <CheckCircle2 size={32} />
                <span className="text-xs font-black">کد شناسایی شد: {detectedCode}</span>
              </div>
            ) : (
              <span className="text-white/70 text-xs font-bold bg-black/60 px-3 py-1.5 rounded-full backdrop-blur-xs">
                بارکد را در کادر تنظیم کنید
              </span>
            )}
          </div>
        </div>

        {/* Camera Error / No permission */}
        {cameraError && (
          <div className="absolute inset-0 bg-slate-900/95 p-6 flex flex-col items-center justify-center text-center z-10">
            <AlertCircle size={48} className="text-amber-400 mb-4" />
            <h4 className="text-white font-bold text-base mb-2">دوربین در دسترس نیست</h4>
            <p className="text-slate-400 text-xs max-w-md mb-6">{cameraError}</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-2xl font-bold text-xs flex items-center gap-2"
            >
              <Upload size={16} />
              انتخاب عکس بارکد از گالری
            </button>
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="bg-slate-900 border-t border-white/10 p-4 sm:p-6 space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />

        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 bg-slate-950 border border-white/10 rounded-2xl px-4 py-3.5 text-white font-mono text-sm outline-none focus:border-teal-500 placeholder-slate-500"
            placeholder="یا کد بارکد را به صورت دستی تایپ کنید..."
            value={manualCode}
            onChange={e => setManualCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
          />
          <button
            onClick={handleManualSubmit}
            className="bg-teal-600 hover:bg-teal-500 text-white px-6 rounded-2xl font-bold text-xs shadow-lg active:scale-95 transition-all"
          >
            تایید کد
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 p-3.5 rounded-2xl transition-all"
            title="آپلود تصویر بارکد"
          >
            <Upload size={20} />
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
          <span>موتور شناسایی آفلاین: Code128, EAN-13, QR Code</span>
          <button onClick={onClose} className="text-rose-400 hover:underline font-bold">
            انصراف و بازگشت
          </button>
        </div>
      </div>
    </div>
  );
};

export default BarcodeScanner;
