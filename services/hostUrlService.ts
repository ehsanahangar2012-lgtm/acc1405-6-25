/**
 * سرویس مدیریت URL هاست
 * تضمین میکند لینکها از هاست اصلی برنامه آدرسدهی شوند نه از مرورگر
 */

interface HostConfig {
  baseUrl: string;
  detectedAt: string;
  source: 'env' | 'api' | 'metadata' | 'fallback';
}

class HostUrlService {
  private config: HostConfig | null = null;
  private readonly CACHE_KEY = 'host_url_config';
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 ساعت

  /**
   * دریافت Base URL از هاست
   */
  async getBaseUrl(): Promise<string> {
    // 1. بررسی cache
    if (this.config && this.isCacheValid()) {
      return this.config.baseUrl;
    }

    // 2. تلاش برای دریافت از environment variable
    const envUrl = import.meta.env.VITE_APP_BASE_URL;
    if (envUrl && this.isValidUrl(envUrl)) {
      this.config = {
        baseUrl: this.normalizeUrl(envUrl),
        detectedAt: new Date().toISOString(),
        source: 'env'
      };
      this.saveCache();
      return this.config.baseUrl;
    }

    // 3. تلاش برای دریافت از metadata.json
    try {
      const metadataUrl = this.getMetadataUrl();
      const response = await fetch(metadataUrl);
      if (response.ok) {
        const metadata = await response.json();
        if (metadata.baseUrl && this.isValidUrl(metadata.baseUrl)) {
          this.config = {
            baseUrl: this.normalizeUrl(metadata.baseUrl),
            detectedAt: new Date().toISOString(),
            source: 'metadata'
          };
          this.saveCache();
          return this.config.baseUrl;
        }
      }
    } catch (error) {
      console.warn('Failed to load metadata:', error);
    }

    // 4. تلاش برای auto-detect از host API
    try {
      const apiUrl = this.getApiUrl();
      const response = await fetch(`${apiUrl}?action=get_base_url`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.baseUrl && this.isValidUrl(data.baseUrl)) {
          this.config = {
            baseUrl: this.normalizeUrl(data.baseUrl),
            detectedAt: new Date().toISOString(),
            source: 'api'
          };
          this.saveCache();
          return this.config.baseUrl;
        }
      }
    } catch (error) {
      console.warn('Failed to auto-detect from API:', error);
    }

    // 5. Fallback به window.location (فقط در صورت عدم موفقیت)
    const fallbackUrl = this.getFallbackUrl();
    this.config = {
      baseUrl: fallbackUrl,
      detectedAt: new Date().toISOString(),
      source: 'fallback'
    };
    this.saveCache();
    
    // هشدار در console
    if (this.isLocalhost(fallbackUrl)) {
      console.warn('⚠️ Using localhost URL. Set VITE_APP_BASE_URL in .env.local for production URLs');
    }

    return this.config.baseUrl;
  }

  /**
   * دریافت URL کامل برای صفحه امضا
   */
  async getSignatureUrl(shortCode: string): Promise<string> {
    const baseUrl = await this.getBaseUrl();
    return `${baseUrl}/#/sign/${shortCode}`;
  }

  /**
   * دریافت URL کامل برای صفحه عمومی امضا
   */
  async getPublicSignatureUrl(shortCode: string): Promise<string> {
    const baseUrl = await this.getBaseUrl();
    return `${baseUrl}/#/public-sign/${shortCode}`;
  }

  /**
   * بررسی اعتبار cache
   */
  private isCacheValid(): boolean {
    if (!this.config || !this.config.baseUrl || !this.isValidUrl(this.config.baseUrl)) return false;
    const cacheAge = Date.now() - new Date(this.config.detectedAt).getTime();
    return cacheAge < this.CACHE_DURATION;
  }

  /**
   * ذخیره در cache
   */
  private saveCache(): void {
    if (this.config && this.isValidUrl(this.config.baseUrl)) {
      try {
        localStorage.setItem(this.CACHE_KEY, JSON.stringify(this.config));
      } catch (error) {
        console.warn('Failed to save host URL cache:', error);
      }
    }
  }

  /**
   * بارگذاری از cache
   */
  private loadCache(): void {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.baseUrl && this.isValidUrl(parsed.baseUrl)) {
          this.config = parsed;
        } else {
          this.clearCache();
        }
      }
    } catch (error) {
      console.warn('Failed to load host URL cache:', error);
      this.clearCache();
    }
  }

  /**
   * پاکسازی cache
   */
  clearCache(): void {
    this.config = null;
    try {
      localStorage.removeItem(this.CACHE_KEY);
    } catch {}
  }

  /**
   * اعتبارسنجی URL
   */
  private isValidUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return false;
    try {
      const parsed = new URL(trimmed);
      return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && !!parsed.hostname && parsed.hostname.length > 1;
    } catch {
      return false;
    }
  }

  /**
   * نرمالسازی URL (حذف trailing slash)
   */
  private normalizeUrl(url: string): string {
    return url.replace(/\/$/, '');
  }

  /**
   * بررسی localhost
   */
  private isLocalhost(url: string): boolean {
    return url.includes('localhost') || url.includes('127.0.0.1');
  }

  /**
   * دریافت URL metadata
   */
  private getMetadataUrl(): string {
    const origin = window.location.origin;
    const pathname = window.location.pathname.replace(/\/$/, '');
    return `${origin}${pathname}/metadata.json`;
  }

  /**
   * دریافت URL API
   */
  private getApiUrl(): string {
    const origin = window.location.origin;
    const pathname = window.location.pathname.replace(/\/$/, '');
    return `${origin}${pathname}/host-api.php`;
  }

  /**
   * دریافت Fallback URL
   */
  private getFallbackUrl(): string {
    const origin = window.location.origin;
    const pathname = window.location.pathname.replace(/index.html$/, '').replace(/\/$/, '');
    return `${origin}${pathname}`;
  }

  /**
   * دریافت اطلاعات config فعلی
   */
  getConfig(): HostConfig | null {
    return this.config;
  }

  /**
   * تنظیم دستی base URL
   */
  setBaseUrl(url: string): void {
    if (this.isValidUrl(url)) {
      this.config = {
        baseUrl: this.normalizeUrl(url),
        detectedAt: new Date().toISOString(),
        source: 'env'
      };
      this.saveCache();
    }
  }
}

export const hostUrlService = new HostUrlService();
