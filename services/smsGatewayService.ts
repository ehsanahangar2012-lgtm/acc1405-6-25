/**
 * SMS Gateway & Smart Automation Service
 * وب‌سرویس پیامک اختصاصی حسابداری - کاوه‌نگار، ملی‌پیامک، SMS.ir و فراپیامک
 */

export type SmsProvider = 'KAVEHNEGAR' | 'MELLI_SMS' | 'SMS_IR' | 'FARAPAYAMAK' | 'CUSTOM_REST';

export interface SmsGatewayConfig {
    provider: SmsProvider;
    apiKey: string;
    senderNumber: string;
    balanceCredits: number;
    autoSendInvoice: boolean;
    autoSendCheckReminder: boolean;
    checkReminderDaysBefore: number;
    autoSendDebtNotice: boolean;
    invoicePatternCode?: string;
    checkPatternCode?: string;
}

export interface SmsLogEntry {
    id: string;
    recipientPhone: string;
    recipientName: string;
    messageText: string;
    type: 'INVOICE' | 'CHECK_REMINDER' | 'DEBT_NOTICE' | 'PROMOTIONAL' | 'CUSTOM';
    status: 'DELIVERED' | 'SENT' | 'FAILED';
    sentAt: string;
    provider: SmsProvider;
    costCredits: number;
}

const STORAGE_KEY_SMS_CONFIG = 'ashk_sms_gateway_config';
const STORAGE_KEY_SMS_LOGS = 'ashk_sms_gateway_logs';

export class SmsGatewayService {
    static getConfig(): SmsGatewayConfig {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_SMS_CONFIG);
            if (raw) return JSON.parse(raw);
        } catch (_) {}
        return {
            provider: 'KAVEHNEGAR',
            apiKey: 'sk-kav-8942-ashk-secret-key-1404',
            senderNumber: '3000500600',
            balanceCredits: 450, // تعداد پیامک باقیمانده
            autoSendInvoice: true,
            autoSendCheckReminder: true,
            checkReminderDaysBefore: 3,
            autoSendDebtNotice: false,
            invoicePatternCode: 'p_invoice_1404',
            checkPatternCode: 'p_check_reminder'
        };
    }

    static saveConfig(config: SmsGatewayConfig): void {
        localStorage.setItem(STORAGE_KEY_SMS_CONFIG, JSON.stringify(config));
    }

    static getLogs(): SmsLogEntry[] {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_SMS_LOGS);
            if (raw) return JSON.parse(raw);
        } catch (_) {}
        return [
            {
                id: 'sms-log-1',
                recipientPhone: '09121234567',
                recipientName: 'حاج احمد رضایی',
                messageText: 'مشتری گرامی حاج احمد رضایی، فاکتور شماره ۱۰۴۲ به مبلغ ۱۲,۵۰۰,۰۰۰ تومان صادر گردید. با تشکر - فروشگاه بازرگانی اشک قلم',
                type: 'INVOICE',
                status: 'DELIVERED',
                sentAt: '۱۴۰۴/۱۱/۲۸ - ۱۰:۴۵',
                provider: 'KAVEHNEGAR',
                costCredits: 1
            },
            {
                id: 'sms-log-2',
                recipientPhone: '09359876543',
                recipientName: 'شرکت پترو صنعت',
                messageText: 'همکار گرامی، چک شماره ۹۸۱۴۰ به مبلغ ۳۵,۰۰۰,۰۰۰ تومان در تاریخ ۱۴۰۴/۱۲/۰۲ سررسید می‌گردد.',
                type: 'CHECK_REMINDER',
                status: 'DELIVERED',
                sentAt: '۱۴۰۴/۱۱/۲۹ - ۰۹:۰۰',
                provider: 'KAVEHNEGAR',
                costCredits: 1
            }
        ];
    }

    static addLog(entry: SmsLogEntry): void {
        const logs = this.getLogs();
        logs.unshift(entry);
        localStorage.setItem(STORAGE_KEY_SMS_LOGS, JSON.stringify(logs.slice(0, 200)));
    }

    static async sendSms(params: {
        toPhone: string;
        recipientName?: string;
        message: string;
        type?: 'INVOICE' | 'CHECK_REMINDER' | 'DEBT_NOTICE' | 'PROMOTIONAL' | 'CUSTOM';
    }): Promise<{ success: boolean; message: string; remainingCredits: number }> {
        const config = this.getConfig();

        if (config.balanceCredits <= 0) {
            return {
                success: false,
                message: 'اعتبار پیامکی شما به پایان رسیده است. لطفاً پنل پیامک را شارژ کنید.',
                remainingCredits: 0
            };
        }

        // شبیه‌سازی فراخوانی وب‌سرویس
        await new Promise(r => setTimeout(r, 800));

        // کسر ۱ اعتبار پیامکی
        config.balanceCredits -= 1;
        this.saveConfig(config);

        const log: SmsLogEntry = {
            id: `sms-${Date.now()}`,
            recipientPhone: params.toPhone,
            recipientName: params.recipientName || 'طرف‌حساب',
            messageText: params.message,
            type: params.type || 'CUSTOM',
            status: 'DELIVERED',
            sentAt: new Date().toLocaleDateString('fa-IR') + ' - ' + new Date().toLocaleTimeString('fa-IR'),
            provider: config.provider,
            costCredits: 1
        };
        this.addLog(log);

        return {
            success: true,
            message: `پیامک با موفقیت به شماره ${params.toPhone} ارسال شد.`,
            remainingCredits: config.balanceCredits
        };
    }

    static rechargeCredits(amount: number): number {
        const config = this.getConfig();
        config.balanceCredits += amount;
        this.saveConfig(config);
        return config.balanceCredits;
    }
}
