// سرویس تشخیص اتصال واقعی به هاست
import { API_CONFIG, IS_BROWSER_PREVIEW } from '../config';
import { workspaceService } from './workspaceService';

class RealConnectionService {
  private isHostOnline = false;
  private checkInterval: number | null = null;
  private listeners: Set<(status: boolean) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      this.startMonitoring();
    }
  }

  // شروع مانیتورینگ مداوم
  startMonitoring() {
    if (typeof window === 'undefined') return;
    
    // چک اولیه
    this.checkConnections();

    // چک هر 30 ثانیه
    this.checkInterval = window.setInterval(() => {
      this.checkConnections();
    }, 30000);

    // گوش دادن به تغییرات آنلاین/آفلاین مرورگر
    window.addEventListener('online', () => this.checkConnections());
    window.addEventListener('offline', () => this.updateStatus(false));
  }

  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  // چک اتصال واقعی به هاست
  private async checkHostConnection(): Promise<boolean> {
    if (IS_BROWSER_PREVIEW || typeof window === 'undefined' || !workspaceService.isRemoteCloudConfigured()) return false;
    
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(API_CONFIG.HEALTH_API, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });

      clearTimeout(timeout);
      return response.ok;
    } catch {
      return false;
    }
  }

  // چک همزمان اتصال
  private async checkConnections() {
    if (IS_BROWSER_PREVIEW) {
      this.isHostOnline = false;
      this.updateStatus(false);
      return;
    }
    if (typeof navigator === 'undefined') return;
    
    if (!navigator.onLine) {
      this.updateStatus(false);
      return;
    }

    // Standalone Windows/Android clients should not contact the hosted health endpoint.
    // Their online indicator follows the device network state until a remote workspace is configured.
    if (!workspaceService.isRemoteCloudConfigured()) {
      this.isHostOnline = false;
      this.updateStatus(true);
      return;
    }

    const hostOnline = await this.checkHostConnection();
    this.isHostOnline = hostOnline;
    this.updateStatus(hostOnline);
  }

  private updateStatus(isOnline: boolean) {
    this.listeners.forEach(listener => listener(isOnline));
  }

  // ثبت listener برای تغییرات وضعیت
  subscribe(listener: (status: boolean) => void) {
    this.listeners.add(listener);
    // فراخوانی فوری با وضعیت فعلی
    listener(this.isOnline());
    return () => this.listeners.delete(listener);
  }

  // وضعیت فعلی
  isOnline(): boolean {
    if (IS_BROWSER_PREVIEW) return false;
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    return this.isHostOnline || navigator.onLine;
  }

  // جزئیات اتصال
  getConnectionDetails() {
    if (typeof navigator === 'undefined') {
      return {
        browserOnline: false,
        hostOnline: false,
        overallOnline: false
      };
    }
    
    return {
      browserOnline: navigator.onLine,
      hostOnline: this.isHostOnline,
      overallOnline: this.isOnline()
    };
  }

  // فورس چک (برای استفاده دستی)
  async forceCheck(): Promise<boolean> {
    await this.checkConnections();
    return this.isOnline();
  }
}

export const realConnectionService = new RealConnectionService();
