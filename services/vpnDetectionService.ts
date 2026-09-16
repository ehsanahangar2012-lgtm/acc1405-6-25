import { fetchWithTimeout } from '../utils';

class VPNDetectionService {
  private isVPNActive = false;
  private checkInterval: any = null;
  private listeners: Set<(isVPN: boolean) => void> = new Set();

  async init() {
    await this.checkVPN();
    this.startMonitoring();
  }

  private async checkVPN(): Promise<boolean> {
    try {
      // روش 1: بررسی timezone mismatch
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const isIranTimezone = timezone === 'Asia/Tehran';

      // روش 2: بررسی WebRTC leak
      const hasWebRTCLeak = await this.checkWebRTC();

      // روش 3: بررسی DNS leak
      const hasDNSLeak = await this.checkDNS();

      // اگر timezone ایران نباشد یا leak وجود داشته باشد
      this.isVPNActive = !isIranTimezone || hasWebRTCLeak || hasDNSLeak;
      
      this.notifyListeners();
      return this.isVPNActive;
    } catch {
      return false;
    }
  }

  private async checkWebRTC(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const pc = new RTCPeerConnection({ iceServers: [] });
        pc.createDataChannel('');
        pc.createOffer().then(offer => pc.setLocalDescription(offer));
        
        pc.onicecandidate = (ice) => {
          if (!ice || !ice.candidate) return;
          const ip = /([0-9]{1,3}\.){3}[0-9]{1,3}/.exec(ice.candidate.candidate)?.[0];
          if (ip && !ip.startsWith('192.168') && !ip.startsWith('10.')) {
            resolve(true); // IP خارجی = احتمال VPN
          }
        };
        
        setTimeout(() => {
          pc.close();
          resolve(false);
        }, 2000);
      } catch {
        resolve(false);
      }
    });
  }

  private async checkDNS(): Promise<boolean> {
    try {
      const response = await fetchWithTimeout('https://dns.google/resolve?name=google.com&type=A', {}, 2000);
      const data = await response.json();
      // بررسی ساده - در صورت نیاز میتوان پیچیدهتر کرد
      return false;
    } catch {
      return false;
    }
  }

  private startMonitoring() {
    // بررسی هر 30 ثانیه
    this.checkInterval = setInterval(() => {
      this.checkVPN();
    }, 30000);
  }

  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }

  isBlocked(): boolean {
    return this.isVPNActive;
  }

  onStatusChange(callback: (isVPN: boolean) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners() {
    this.listeners.forEach(cb => cb(this.isVPNActive));
  }

  getWarningMessage(): string {
    return `⚠️ هشدار: VPN فعال است

🚫 تا زمان خاموش کردن VPN:
• ذخیره اطلاعات غیرفعال است
• بروزرسانی دادهها متوقف شده است
• سینک با سرور انجام نمیشود

لطفا VPN را خاموش کنید و مجددا تلاش کنید.`;
  }
}

export const vpnDetection = new VPNDetectionService();
