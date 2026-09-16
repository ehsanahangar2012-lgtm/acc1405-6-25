import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { hostDB } from '../services/hostDatabaseService';
import { syncQueue } from '../services/syncQueueService';
import { autoSyncService } from '../services/autoSyncService';
import { Database, Cloud, CheckCircle2, AlertCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';

export const HostDatabaseSync = () => {
    const addNotification = useStore(s => s.addNotification);
    const [status, setStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
    const [lastSync, setLastSync] = useState<string | null>(null);
    const [queueCount, setQueueCount] = useState(0);
    const [isConnected, setIsConnected] = useState(true);
    const [syncStats, setSyncStats] = useState({ processed: 0, failed: 0, remaining: 0 });

    const checkConnection = async () => {
        const connected = await hostDB.checkConnection();
        setIsConnected(connected);
        return connected;
    };

    const syncAll = async () => {
        if (status === 'syncing') return;
        
        setStatus('syncing');
        
        try {
            // ۱. بررسی اتصال سریع
            const connected = await checkConnection();
            if (!connected) {
                throw new Error('No connection to host');
            }

            // ۲. پردازش صف ناهمگام و همگام‌سازی تجمیعی توسط autoSyncService بدون لگ ویندوز
            await autoSyncService.loadFromHost(true);
            const queueResult = await hostDB.processQueue();
            setSyncStats({ processed: queueResult.processed, failed: queueResult.failed, remaining: queueResult.remaining || 0 });
            await autoSyncService.syncToHost(true);

            setStatus('success');
            setLastSync(new Date().toLocaleString('fa-IR'));
            setQueueCount(queueResult.remaining);
            
            setTimeout(() => setStatus('idle'), 2500);
        } catch (error: any) {
            const msg = String(error?.message || error).toLowerCase();
            if (msg.includes('no connection') || msg.includes('failed to fetch') || msg.includes('offline') || msg.includes('network')) {
                console.warn('Host sync status (offline):', error?.message || error);
            } else {
                console.error('Host sync error:', error);
            }
            setStatus('error');
            setTimeout(() => setStatus('idle'), 2500);
        }
    };

    useEffect(() => {
        // بررسی وضعیت صف بدون فشار به حافظه
        const checkQueue = () => {
            const stats = syncQueue.getStats();
            setQueueCount(stats.total);
        };
        
        checkQueue();
        const queueInterval = setInterval(checkQueue, 45000);
        
        // بررسی دوره‌ای اتصال
        checkConnection();
        const connectionInterval = setInterval(checkConnection, 45000);
        
        return () => {
            clearInterval(queueInterval);
            clearInterval(connectionInterval);
        };
    }, []);

    if (status === 'idle' && queueCount === 0 && isConnected) return null;

    return (
        <div className="fixed bottom-4 left-4 z-[1000] no-print hidden md:block">
            <div className={`px-3 py-2 rounded-xl shadow-lg flex items-center gap-2 text-white text-xs font-bold transition-all backdrop-blur-md ${
                status === 'syncing' ? 'bg-blue-600/90' :
                status === 'success' ? 'bg-emerald-600/90' :
                status === 'error' ? 'bg-rose-600/90' :
                !isConnected ? 'bg-orange-600/90' :
                'bg-slate-700/90'
            }`}>
                {status === 'syncing' && <RefreshCw size={14} className="animate-spin" />}
                {status === 'success' && <CheckCircle2 size={14} />}
                {status === 'error' && <AlertCircle size={14} />}
                {status === 'idle' && (isConnected ? <Database size={14} /> : <WifiOff size={14} />)}
                
                <span className="text-[10px]">
                    {status === 'syncing' && 'همگامسازی...'}
                    {status === 'success' && 'موفق'}
                    {status === 'error' && 'خطا'}
                    {status === 'idle' && !isConnected && 'آفلاین'}
                    {status === 'idle' && isConnected && queueCount > 0 && `${queueCount} در صف`}
                </span>
                
                <button 
                    onClick={syncAll}
                    disabled={status === 'syncing' || !isConnected}
                    className="p-1 hover:bg-white/10 rounded transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={12} />
                </button>
            </div>
        </div>
    );
};
