import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { WifiOff, Wifi, Clock, AlertCircle } from 'lucide-react';

const OfflineManager = () => {
    const { isOnline, offlineQueue, processOfflineQueue, lastSyncTime } = useStore();
    const [showOfflineIndicator, setShowOfflineIndicator] = useState(false);

    useEffect(() => {
        // Only show offline indicator when actually offline
        setShowOfflineIndicator(!isOnline && offlineQueue.length > 0);
        
        // Auto-sync when coming back online
        if (isOnline && offlineQueue.length > 0) {
            processOfflineQueue();
        }
    }, [isOnline, offlineQueue.length]);

    if (!showOfflineIndicator && offlineQueue.length === 0) return null;

    return (
        <div className="fixed top-4 left-4 z-[2000] no-print">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg border backdrop-blur-md transition-all ${
                !isOnline ? 'bg-amber-600/90 text-white border-amber-500' : 
                offlineQueue.length > 0 ? 'bg-blue-600/90 text-white border-blue-500' :
                'bg-emerald-600/90 text-white border-emerald-500'
            }`}>
                {!isOnline ? <WifiOff size={16} /> : 
                 offlineQueue.length > 0 ? <Clock size={16} /> : 
                 <Wifi size={16} />}
                
                <div className="text-xs">
                    {!isOnline ? (
                        <div>
                            <div className="font-bold">حالت آفلاین</div>
                            <div className="opacity-80">عملیات ذخیره می‌شود</div>
                        </div>
                    ) : offlineQueue.length > 0 ? (
                        <div>
                            <div className="font-bold">{offlineQueue.length} عملیات در انتظار</div>
                            <div className="opacity-80">در حال همگام‌سازی...</div>
                        </div>
                    ) : (
                        <div>
                            <div className="font-bold">همگام شده</div>
                            {lastSyncTime && (
                                <div className="opacity-80">آخرین بروزرسانی: {lastSyncTime}</div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OfflineManager;