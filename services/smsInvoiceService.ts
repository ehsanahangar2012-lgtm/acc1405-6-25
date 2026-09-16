import { Invoice, Person, CompanyProfile, InvoiceType } from '../types';
import { formatCurrency, toPersianDigits, getPersianDate, isAndroidApp } from '../utils';
import { simpleSignatureService } from './simpleSignatureService';
import { SmsGatewayService, triggerDeviceSms } from './smsGatewayService';

export interface SmsInvoiceSendResult {
    success: boolean;
    message: string;
    targetPhone?: string;
    url?: string;
    provider?: string;
    openedDeviceApp?: boolean;
    smsText?: string;
}

export class SmsInvoiceService {
    /**
     * استانداردسازی شماره موبایل ایران
     */
    static normalizeMobile(phone: string): string | null {
        if (!phone) return null;
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.startsWith('98') && cleaned.length === 12) {
            return '0' + cleaned.substring(2);
        }
        if (cleaned.startsWith('0098') && cleaned.length === 14) {
            return '0' + cleaned.substring(4);
        }
        if (cleaned.startsWith('9') && cleaned.length === 10) {
            return '0' + cleaned;
        }
        if (cleaned.startsWith('09') && cleaned.length === 11) {
            return cleaned;
        }
        return null;
    }

    /**
     * ایجاد لینک کوتاه یا قابل دسترس امضا و پرداخت صورتحساب
     */
    static async generateInvoiceSignUrl(invoice: Invoice): Promise<string> {
        try {
            const payload = JSON.stringify({
                invoiceId: invoice.id,
                invoiceNumber: (invoice.prefix || '') + invoice.number,
                personName: invoice.personName,
                finalTotal: invoice.finalTotal,
                date: invoice.date
            });
            const token = await simpleSignatureService.createRequest(invoice.id, 'INVOICE', payload);
            const baseUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
            return `${baseUrl}#/sign/${token}`;
        } catch (e) {
            const baseUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
            return `${baseUrl}#/invoices?view=${invoice.id}`;
        }
    }

    /**
     * ساخت متن استاندارد و خوانای پیامک صورتحساب
     */
    static buildInvoiceSmsText(invoice: Invoice, company?: CompanyProfile, signUrl?: string): string {
        const invNum = (invoice.prefix || '') + toPersianDigits(invoice.number);
        const totalFormatted = formatCurrency(invoice.finalTotal).replace(' ریال', '');
        const companyName = company?.name || 'مجموعه بازرگانی اشک قلم';
        const typeLabel = invoice.type === InvoiceType.PROFORMA ? 'پیش‌فاکتور' : invoice.type === InvoiceType.PURCHASE ? 'فاکتور خرید' : 'فاکتور';

        let text = `خریدار گرامی ${invoice.personName}،\n${typeLabel} شماره ${invNum} به مبلغ ${totalFormatted} ریال صادر گردید.`;
        if (signUrl) {
            text += `\nمشاهده، امضا و پرداخت:\n${signUrl}`;
        }
        text += `\n${companyName}`;
        return text;
    }

    /**
     * ارسال مستقیم پیامک از طریق برنامه پیامک گوشی اندروید (بدون نیاز به پنل و هزینه)
     */
    static async sendViaAndroidDevice(
        invoice: Invoice,
        person?: Person,
        company?: CompanyProfile
    ): Promise<SmsInvoiceSendResult> {
        const rawPhone = person?.phone || '';
        const phone = this.normalizeMobile(rawPhone);

        if (!phone) {
            return {
                success: false,
                message: 'شماره تلفن همراه معتبر برای طرف حساب یافت نشد.'
            };
        }

        const signUrl = await this.generateInvoiceSignUrl(invoice);
        const smsText = this.buildInvoiceSmsText(invoice, company, signUrl);

        // فعال‌سازی پیام‌رسان پیش‌فرض گوشی با Intent
        triggerDeviceSms(phone, smsText);

        // ثبت در تاریخچه لاگ محلی
        const historyKey = `sms_history_${invoice.id}`;
        const logItem = {
            date: getPersianDate(),
            timestamp: Date.now(),
            phone,
            text: smsText,
            url: signUrl,
            status: 'SENT',
            provider: 'ANDROID_DEVICE'
        };
        try {
            localStorage.setItem(historyKey, JSON.stringify(logItem));
        } catch {}

        return {
            success: true,
            message: `برنامه پیامک گوشی اندروید با شماره ${toPersianDigits(phone)} و متن فاکتور آماده ارسال شد.`,
            targetPhone: phone,
            url: signUrl,
            provider: 'ANDROID_DEVICE',
            openedDeviceApp: true,
            smsText
        };
    }

    /**
     * ارسال خودکار یا دستی صورتحساب به مشتری (پشتیبانی از اندروید و وب‌سرویس)
     */
    static async sendInvoiceNotification(
        invoice: Invoice,
        person?: Person,
        company?: CompanyProfile,
        options?: { preferAndroidDevice?: boolean }
    ): Promise<SmsInvoiceSendResult> {
        const rawPhone = person?.phone || '';
        const phone = this.normalizeMobile(rawPhone);

        if (!phone) {
            return {
                success: false,
                message: 'شماره تلفن همراه معتبر برای طرف حساب یافت نشد.'
            };
        }

        const config = SmsGatewayService.getConfig();
        const isAndroid = isAndroidApp();
        const shouldSendViaDevice = options?.preferAndroidDevice || config.provider === 'ANDROID_DEVICE' || isAndroid;

        if (shouldSendViaDevice) {
            return this.sendViaAndroidDevice(invoice, person, company);
        }

        const signUrl = await this.generateInvoiceSignUrl(invoice);
        const invNum = (invoice.prefix || '') + toPersianDigits(invoice.number);
        const smsText = this.buildInvoiceSmsText(invoice, company, signUrl);

        // تلاش برای ارسال از طریق وب‌سرویس ابری
        try {
            const payload = {
                action: 'send_invoice_sms',
                phone,
                message: smsText,
                invoiceId: invoice.id,
                invoiceNumber: invNum,
                amount: invoice.finalTotal,
                customerName: invoice.personName,
                signUrl
            };

            const response = await fetch('/api.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                return {
                    success: true,
                    message: `پیامک فاکتور با موفقیت از طریق پنل پیامک به شماره ${toPersianDigits(phone)} ارسال شد.`,
                    targetPhone: phone,
                    url: signUrl,
                    smsText
                };
            }
        } catch (err) {
            console.warn('Host SMS endpoint not reachable, fallback to device SMS...', err);
        }

        // در صورت عدم دسترسی به پنل یا اجرای آفلاین، فراخوانی برنامه پیامک گوشی
        triggerDeviceSms(phone, smsText);

        const historyKey = `sms_history_${invoice.id}`;
        const logItem = {
            date: getPersianDate(),
            timestamp: Date.now(),
            phone,
            text: smsText,
            url: signUrl,
            status: 'SENT',
            provider: 'ANDROID_DEVICE'
        };
        try {
            localStorage.setItem(historyKey, JSON.stringify(logItem));
        } catch {}

        return {
            success: true,
            message: `پیامک فاکتور در برنامه پیام‌رسان گوشی همراه آماده گردید.`,
            targetPhone: phone,
            url: signUrl,
            openedDeviceApp: true,
            smsText
        };
    }
}
