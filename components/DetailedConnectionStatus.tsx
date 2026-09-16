import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, X } from 'lucide-react';
import { realConnectionService } from '../services/realConnectionService';

export const DetailedConnectionStatus: React.FC = () => {
  const [details, setDetails] = useState(realConnectionService.getConnectionDetails());
  const [checking, setChecking] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const unsubscribe = realConnectionService.subscribe(() => {
      setDetails(realConnectionService.getConnectionDetails());
      setIsDismissed(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleForceCheck = async () => {
    setChecking(true);
    await realConnectionService.forceCheck();
    setDetails(realConnectionService.getConnectionDetails());
    setChecking(false);
  };

  if (details.overallOnline || isDismissed) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-80 z-[1000] no-print animate-slide-up">
      <div className="bg-rose-600/95 backdrop-blur-xl border border-rose-500/30 rounded-2xl px-4 py-3 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            <WifiOff size={16} className="text-white shrink-0" />
            <span className="text-white text-xs font-bold">آفلاین</span>
          </div>
          
          <button
            onClick={handleForceCheck}
            disabled={checking}
            className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-2 py-1 rounded-lg text-white text-[10px] font-bold transition-all disabled:opacity-50 shrink-0"
          >
            <RefreshCw size={10} className={checking ? 'animate-spin' : ''} />
          </button>
          
          <button
            onClick={() => setIsDismissed(true)}
            className="text-white/70 hover:text-white transition-colors shrink-0 p-1"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DetailedConnectionStatus;
