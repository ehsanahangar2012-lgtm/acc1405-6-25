import { Invoice, Check, Person, Product, Transaction } from '../types';
import { getPersianDate, calculateDaysDiff } from '../utils';

export const professionalFeatures = {
  // 1. تسویه خودکار
  autoSettle: (personId: string, people: Person[], checks: Check[]) => {
    const person = people.find(p => p.id === personId);
    if (!person || person.balance <= 0) return null;
    
    const availableChecks = checks.filter(c => 
      c.personId === personId && c.status === 'PENDING'
    ).sort((a, b) => a.amount - b.amount);
    
    let remaining = person.balance;
    const selected: Check[] = [];
    
    for (const check of availableChecks) {
      if (remaining <= 0) break;
      if (check.amount <= remaining) {
        selected.push(check);
        remaining -= check.amount;
      }
    }
    
    return { selected, remaining, settled: person.balance - remaining };
  },

  // 2. گزارش مالیاتی
  taxReport: (invoices: Invoice[], startDate: string, endDate: string) => {
    const filtered = invoices.filter(i => 
      i.type === 'فروش' && i.date >= startDate && i.date <= endDate
    );
    
    const totalSales = filtered.reduce((s, i) => s + i.finalTotal, 0);
    const totalTax = filtered.reduce((s, i) => s + i.tax, 0);
    const vat = totalSales * 0.09;
    
    return {
      period: `${startDate} - ${endDate}`,
      totalSales,
      totalTax,
      vat,
      invoiceCount: filtered.length,
      avgInvoice: totalSales / filtered.length || 0
    };
  },

  // 3. یادآوری هوشمند
  smartReminders: (checks: Check[]) => {
    const today = getPersianDate();
    return checks.filter(c => c.status === 'PENDING').map(c => {
      const days = calculateDaysDiff(today, c.dueDate);
      let priority: 'INFO' | 'WARNING' | 'URGENT' = 'INFO';
      
      if (days <= 0) priority = 'URGENT';
      else if (days <= 3) priority = 'WARNING';
      else if (days <= 7) priority = 'INFO';
      else return null;
      
      return { check: c, days, priority };
    }).filter(Boolean);
  },

  // 4. تحلیل مشتری
  customerAnalysis: (people: Person[], invoices: Invoice[]) => {
    const analysis = people.map(p => {
      const purchases = invoices.filter(i => i.personId === p.id && i.type === 'فروش');
      const total = purchases.reduce((s, i) => s + i.finalTotal, 0);
      const lastPurchase = purchases.sort((a, b) => b.date.localeCompare(a.date))[0];
      const daysSince = lastPurchase ? calculateDaysDiff(lastPurchase.date, getPersianDate()) : 999;
      
      return {
        person: p,
        totalPurchases: total,
        purchaseCount: purchases.length,
        avgPurchase: total / purchases.length || 0,
        lastPurchaseDate: lastPurchase?.date,
        daysSinceLastPurchase: daysSince,
        churnRisk: daysSince > 90,
        loyaltyScore: purchases.length * 10 + (daysSince < 30 ? 50 : 0)
      };
    });
    
    return {
      topCustomers: analysis.sort((a, b) => b.totalPurchases - a.totalPurchases).slice(0, 10),
      churnRisk: analysis.filter(a => a.churnRisk),
      loyal: analysis.filter(a => a.loyaltyScore > 80)
    };
  },

  // 5. پیشنهاد کالا
  smartSuggestions: (customerId: string, invoices: Invoice[], products: Product[]) => {
    const history = invoices.filter(i => i.personId === customerId && i.type === 'فروش');
    const productFreq: any = {};
    
    history.forEach(inv => {
      inv.items.forEach(item => {
        productFreq[item.productId] = (productFreq[item.productId] || 0) + item.quantity;
      });
    });
    
    const sorted = Object.entries(productFreq).sort((a: any, b: any) => b[1] - a[1]);
    return sorted.slice(0, 5).map(([id]) => products.find(p => p.id === id)).filter(Boolean);
  },

  // 6. محاسبه اعتبار
  creditLimit: (personId: string, invoices: Invoice[], transactions: Transaction[]) => {
    const sales = invoices.filter(i => i.personId === personId && i.type === 'فروش');
    const payments = transactions.filter(t => t.personId === personId && !t.isDebit);
    
    const totalSales = sales.reduce((s, i) => s + i.finalTotal, 0);
    const totalPaid = payments.reduce((s, t) => s + t.amount, 0);
    const paymentRate = totalSales > 0 ? (totalPaid / totalSales) * 100 : 0;
    
    let limit = 10000000;
    if (paymentRate > 90) limit = 100000000;
    else if (paymentRate > 70) limit = 50000000;
    else if (paymentRate > 50) limit = 20000000;
    
    return { limit, paymentRate, score: Math.round(paymentRate) };
  },

  // 7. تخفیف پلکانی
  calculateDiscount: (amount: number) => {
    if (amount >= 100000000) return { percent: 15, amount: amount * 0.15 };
    if (amount >= 50000000) return { percent: 10, amount: amount * 0.10 };
    if (amount >= 10000000) return { percent: 5, amount: amount * 0.05 };
    return { percent: 0, amount: 0 };
  },

  // 8. KPI داشبورد
  executiveKPIs: (invoices: Invoice[], transactions: Transaction[], checks: Check[], products: Product[]) => {
    const sales = invoices.filter(i => i.type === 'فروش');
    const purchases = invoices.filter(i => i.type === 'خرید');
    
    const totalSales = sales.reduce((s, i) => s + i.finalTotal, 0);
    const totalPurchases = purchases.reduce((s, i) => s + i.finalTotal, 0);
    const profit = totalSales - totalPurchases;
    const profitMargin = totalSales > 0 ? (profit / totalSales) * 100 : 0;
    
    const receivables = transactions.filter(t => t.isDebit).reduce((s, t) => s + t.amount, 0);
    const payables = transactions.filter(t => !t.isDebit).reduce((s, t) => s + t.amount, 0);
    const cashPosition = payables - receivables;
    
    const pendingChecks = checks.filter(c => c.status === 'PENDING').reduce((s, c) => s + c.amount, 0);
    
    const lowStock = products.filter(p => p.stock < (p.minStock || 10));
    
    return {
      cashPosition,
      profitMargin: Math.round(profitMargin),
      totalSales,
      totalPurchases,
      profit,
      receivables,
      payables,
      pendingChecks,
      lowStockCount: lowStock.length,
      alerts: [
        cashPosition < 0 && 'موقعیت نقدی منفی',
        pendingChecks > totalSales * 0.5 && 'چکهای معوق بالا',
        lowStock.length > 5 && `${lowStock.length} کالا کمبود موجودی`
      ].filter(Boolean)
    };
  },

  // 9. موجودی امن
  safetyStockAlert: (products: Product[], invoices: Invoice[]) => {
    return products.map(p => {
      const sales = invoices.filter(i => i.type === 'فروش' && 
        calculateDaysDiff(i.date, getPersianDate()) <= 30
      );
      
      let totalSold = 0;
      sales.forEach(inv => {
        const item = inv.items.find(i => i.productId === p.id);
        if (item) totalSold += item.quantity;
      });
      
      const avgDaily = totalSold / 30;
      const safetyStock = Math.ceil(avgDaily * 15);
      const needsReorder = p.stock < safetyStock;
      
      return needsReorder ? {
        product: p,
        currentStock: p.stock,
        safetyStock,
        reorderQty: safetyStock - p.stock,
        avgDailySales: avgDaily.toFixed(1)
      } : null;
    }).filter(Boolean);
  },

  // 10. DSO (Days Sales Outstanding)
  calculateDSO: (invoices: Invoice[], transactions: Transaction[]) => {
    const sales = invoices.filter(i => i.type === 'فروش');
    const totalSales = sales.reduce((s, i) => s + i.finalTotal, 0);
    const receivables = transactions.filter(t => t.isDebit).reduce((s, t) => s + t.amount, 0);
    
    const dso = totalSales > 0 ? (receivables / totalSales) * 365 : 0;
    return Math.round(dso);
  }
};
