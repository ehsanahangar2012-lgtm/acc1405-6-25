/**
 * Dynamic Payment QR Code Service
 * سرویس تولید بارکد پرداخت سریع و پویا بر روی فاکتور و فیش‌های چاپی
 * پشتیبانی از شماره شبا، شماره کارت، شناسه پرداخت و لینک درگاه مستقیم
 */

import { Invoice, CompanyProfile } from '../types';
import { generateLocalQrSvg, toPersianDigits, formatCurrency } from '../utils';

export interface PaymentQrInfo {
    qrSvg: string;
    paymentUrl: string;
    shebaNumber?: string;
    cardNumber?: string;
    accountHolder?: string;
    amountFormatted: string;
    invoiceTitle: string;
    payloadText: string;
}

export class DynamicPaymentQrService {
    /**
     * تولید بارکد پرداخت پویا برای فاکتور
     */
    static generateInvoicePaymentQr(invoice: Invoice, company?: CompanyProfile): PaymentQrInfo {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : 'https://acc.ashkghalam.ir';
        const invoicePayUrl = `${baseUrl}#/pay/${invoice.id}?amount=${invoice.finalTotal}&num=${invoice.number}`;
        
        const sheba = company?.shebaNumber || 'IR000000000000000000000000';
        const card = company?.cardNumber || '';
        const holder = company?.accountOwner || company?.name || 'مجموعه اشک قلم';

        // ساخت داده استاندارد پرداخت
        const payloadText = invoicePayUrl;
        const qrSvg = generateLocalQrSvg(payloadText);

        return {
            qrSvg,
            paymentUrl: invoicePayUrl,
            shebaNumber: company?.shebaNumber,
            cardNumber: company?.cardNumber,
            accountHolder: holder,
            amountFormatted: formatCurrency(invoice.finalTotal),
            invoiceTitle: `فاکتور ${(invoice.prefix || '') + toPersianDigits(invoice.number)}`,
            payloadText
        };
    }
}
