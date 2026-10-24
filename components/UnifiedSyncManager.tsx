import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { unifiedStorage } from '../services/unifiedStorageService';
import { autoSyncService } from '../services/autoSyncService';
import { Cloud, CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react';

const UnifiedSyncManager = () => {
    const { isOnline, config } = useStore();
    const [status, setStatus] = useState<'idle' | 'syncing' | 'error' | 'success'>('idle');
    const [queueSize, setQueueSize] = useState(0);

    useEffect(() => {
        if (!isOnline) return;

        const interval = setInterval(async () => {
            setStatus('syncing');
            try {
                await unifiedStorage.processRetryQueue();
                await autoSyncService.loadFromHost();
                try {
                    const { simpleSignatureService } = await import('../services/simpleSignatureService');
                    await simpleSignatureService.syncSignedRequests();
                } catch (sigErr) {
                    console.error('Error syncing remote signatures:', sigErr);
                }
                setStatus('success');
                setTimeout(() => setStatus('idle'), 2000);
            } catch {
                setStatus('error');
                setTimeout(() => setStatus('idle'), 3000);
            }
        }, (config.syncInterval || 30) * 1000);

        return () => clearInterval(interval);
    }, [isOnline, config.syncInterval]);

    useEffect(() => {
        unifiedStorage.loadQueue();
        const updateQueue = () => {
            const queue = JSON.parse(localStorage.getItem('unified-retry-queue') || '[]');
            setQueueSize(queue.length);
        };
        updateQueue();
        const interval = setInterval(updateQueue, 5000);
        return () => clearInterval(interval);
    }, []);

    if (!isOnline) return null;

    return (
        <div className="fixed bottom-20 md:bottom-4 right-4 z-[1500] no-print">
            <div className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-full shadow-xl border backdrop-blur-md transition-all ${
                status === 'syncing' ? 'bg-indigo-600/90 text-white border-indigo-500' :
                status === 'error' ? 'bg-rose-600/90 text-white border-rose-500' :
                status === 'success' ? 'bg-emerald-600/90 text-white border-emerald-500' :
                'bg-slate-900/80 text-slate-400 border-white/10'
            }`}>
                {status === 'syncing' && <RefreshCw size={12} className="animate-spin" />}
                {status === 'error' && <AlertTriangle size={12} />}
                {status === 'success' && <CheckCircle size={12} />}
                {status === 'idle' && <Cloud size={12} />}
                
                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">
                    {status === 'syncing' ? 'همگام‌سازی...' :
                     status === 'error' ? 'خطا' :
                     status === 'success' ? 'موفق' : 'آنلاین'}
                </span>
                
                {queueSize > 0 && (
                    <span className="text-[8px] bg-white/20 px-1.5 py-0.5 rounded-full">
                        {queueSize}
                    </span>
                )}
            </div>
        </div>
    );
};

export default UnifiedSyncManager;
