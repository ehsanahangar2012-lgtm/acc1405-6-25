import React from 'react';
import { PlatformContentService } from '../services/platformContentService';
import { getAppPlatform } from '../utils';
import { Monitor, Smartphone, Globe } from 'lucide-react';

export const EnvironmentIndicator: React.FC = () => {
  const platform = getAppPlatform();
  const details = PlatformContentService.getDetails(platform);

  return (
    <div className="hidden lg:flex items-center gap-1.5 fixed top-3 left-4 z-[40] bg-slate-900/80 backdrop-blur-md border border-slate-800/80 px-2.5 py-1 rounded-xl text-[11px] font-bold text-slate-300 shadow-sm no-print" dir="rtl">
      {platform === 'windows' && <Monitor size={13} className="text-teal-400" />}
      {platform === 'android' && <Smartphone size={13} className="text-emerald-400" />}
      {(platform === 'web' || platform === 'pwa') && <Globe size={13} className="text-sky-400" />}
      <span className="text-slate-200">{details.badgeText}</span>
    </div>
  );
};
