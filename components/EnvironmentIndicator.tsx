import React from 'react';
import { isLocalhost, FEATURES, CURRENT_ENV, ENV_MESSAGE } from '../config';
import { useStore } from '../store';

export const EnvironmentIndicator: React.FC = () => {
  const { addNotification } = useStore();
  
  React.useEffect(() => {
    const message = FEATURES.USE_SERVER_API 
      ? '🔗 حالت هاست - اتصال به سرور'
      : '💾 حالت لوکال - ذخیره محلی';
    
    addNotification('info', message);
  }, []);

  return null;
};
