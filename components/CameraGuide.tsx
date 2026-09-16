import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, CheckCircle, AlertCircle } from 'lucide-react';

interface CameraGuideProps {
    onCapture: (base64: string) => void;
    onClose: () => void;
}

export const CameraGuide: React.FC<CameraGuideProps> = ({ onCapture, onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [tips, setTips] = useState<string[]>([
        '✓ چک را روی سطح صاف قرار دهید',
        '✓ نور کافی داشته باشید',
        '✓ زاویه دوربین عمود باشد',
        '✓ تمام چک در کادر باشد'
    ]);

    useEffect(() => {
        startCamera();
        return () => stopCamera();
    }, []);

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment', width: 1920, height: 1080 } 
            });
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
            setStream(mediaStream);
        } catch (err) {
            alert('دسترسی به دوربین رد شد');
        }
    };

    const stopCamera = () => {
        stream?.getTracks().forEach(track => track.stop());
    };

    const capture = () => {
        if (!videoRef.current) return;
        
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(videoRef.current, 0, 0);
        
        const base64 = canvas.toDataURL('image/jpeg', 0.95);
        stopCamera();
        onCapture(base64);
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
            <div className="flex-1 relative">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                
                {/* Guide overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-[90%] max-w-md aspect-[1.6] border-4 border-teal-400 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-teal-500 text-white px-4 py-2 rounded-full text-xs font-bold">
                            چک را در کادر قرار دهید
                        </div>
                    </div>
                </div>
                
                {/* Tips */}
                <div className="absolute top-4 left-4 right-4 bg-black/60 backdrop-blur-md rounded-2xl p-4 space-y-2">
                    {tips.map((tip, i) => (
                        <div key={i} className="flex items-center gap-2 text-white text-xs">
                            <CheckCircle size={14} className="text-teal-400" />
                            <span>{tip}</span>
                        </div>
                    ))}
                </div>
            </div>
            
            <div className="bg-slate-900 p-6 flex justify-between items-center">
                <button onClick={onClose} className="p-4 bg-white/10 rounded-full text-white">
                    <X size={24} />
                </button>
                <button onClick={capture} className="w-20 h-20 bg-teal-500 rounded-full flex items-center justify-center shadow-xl active:scale-95 transition-all">
                    <Camera size={32} className="text-white" />
                </button>
                <div className="w-16"></div>
            </div>
        </div>
    );
};
