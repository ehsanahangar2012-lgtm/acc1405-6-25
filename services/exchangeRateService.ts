import { fetchWithTimeout } from '../utils';

const EXCHANGE_APIS = [
  'https://api.exchangerate.host/latest?base=USD&symbols=IRR',
  'https://open.er-api.com/v6/latest/USD',
  'https://api.exchangerate-api.com/v4/latest/USD'
];

export const exchangeRateService = {
  async fetchRates() {
    // تلاش برای دریافت از منابع مختلف
    for (const api of EXCHANGE_APIS) {
      try {
        const response = await fetchWithTimeout(api, {}, 2000);
        const data = await response.json();
        
        // تبدیل به ریال (نرخ بازار آزاد تقریبی)
        let usdToIRR = data.rates?.IRR || data.rates?.['IRR'];
        
        // اگر نرخ دریافت نشد، از نرخ پیش‌فرض استفاده کن
        if (!usdToIRR || usdToIRR < 10000) {
          usdToIRR = 620000; // نرخ تقریبی بازار آزاد
        }
        
        const eurToUSD = data.rates?.EUR || 0.92;
        const eurToIRR = usdToIRR / eurToUSD;

        return {
          USD: Math.round(usdToIRR),
          EUR: Math.round(eurToIRR),
          lastUpdated: new Date().toLocaleString('fa-IR')
        };
      } catch (error) {
        console.warn(`خطا در دریافت از ${api}:`, error);
        continue;
      }
    }
    
    // اگر همه APIها شکست خوردند، نرخ پیش‌فرض
    console.error('خطا در دریافت نرخ ارز از تمام منابع');
    return {
      USD: 620000,
      EUR: 670000,
      lastUpdated: new Date().toLocaleString('fa-IR')
    };
  },

  startAutoUpdate(updateCallback: (rates: any) => void, intervalMinutes = 60) {
    // بروزرسانی اولیه
    this.fetchRates().then(rates => {
      if (rates) updateCallback(rates);
    });

    // بروزرسانی دورهای
    const interval = setInterval(async () => {
      const rates = await this.fetchRates();
      if (rates) updateCallback(rates);
    }, intervalMinutes * 60 * 1000);

    return () => clearInterval(interval);
  }
};
