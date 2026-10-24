/**
 * Android SMS Relay Bridge Service
 * پل ارتباطی بی‌سیم پیامک بین ویندوز، وب‌سرور و اپلیکیشن اندروید
 * ارسال دستور پیامک از سیستم ویندوز و اجرای آن از طریق سیم‌کارت تلفن همراه اندروید
 */

import { persistentStorage } from './persistentStorage';
import { triggerDeviceSms } from './smsGatewayService';
import { isAndroidApp, getPersianDate, toPersianDigits } from '../utils';

export interface SmsRelayJob {
    id: string;
    targetPhone: string;
    recipientName: string;
    messageText: string;
    invoiceNumber?: string;
    amount?: number;
    sourcePlatform: 'windows' | 'web' | 'android';
    status: 'PENDING' | 'SENT' | 'FAILED';
    createdAt: string;
    timestamp: number;
    sentAt?: string;
}

const STORAGE_KEY_RELAY_JOBS = 'sms_relay_queue';

export class SmsRelayBridgeService {
    /**
     * ثبت درخواست ارسال پیامک در صف پل ارتباطی (از طرف ویندوز یا وب)
     */
    static async queueSms(params: {
        targetPhone: string;
        recipientName: string;
        messageText: string;
        invoiceNumber?: string;
        amount?: number;
        sourcePlatform?: 'windows' | 'web';
    }): Promise<{ success: boolean; job: SmsRelayJob; message: string }> {
        const job: SmsRelayJob = {
            id: `relay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            targetPhone: params.targetPhone,
            recipientName: params.recipientName,
            messageText: params.messageText,
            invoiceNumber: params.invoiceNumber,
            amount: params.amount,
            sourcePlatform: params.sourcePlatform || 'windows',
            status: 'PENDING',
            createdAt: getPersianDate() + ' ' + new Date().toLocaleTimeString('fa-IR'),
            timestamp: Date.now()
        };

        const existingJobs = await this.getJobs();
        const updated = [job, ...existingJobs].slice(0, 100);
        await persistentStorage.saveData(STORAGE_KEY_RELAY_JOBS, updated);

        // اعلان رویداد در مرورگر
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ashk_sms_relay_updated', { detail: job }));
        }

        return {
            success: true,
            job,
            message: `پیامک به صف پل ارتباطی اندروید اضافه شد. اپلیکیشن موبایل با سیم‌کارت آن را ارسال خواهد کرد.`
        };
    }

    /**
     * دریافت لیست پیامک‌های در صف
     */
    static async getJobs(): Promise<SmsRelayJob[]> {
        try {
            const data = await persistentStorage.loadData(STORAGE_KEY_RELAY_JOBS);
            if (Array.isArray(data)) {
                return data;
            }
        } catch {}
        return [];
    }

    /**
     * دریافت تعداد پیامک‌های معلق در انتظار ارسال
     */
    static async getPendingCount(): Promise<number> {
        const jobs = await this.getJobs();
        return jobs.filter(j => j.status === 'PENDING').length;
    }

    /**
     * ارسال یک درخواست پیامک از طریق برنامه پیامک گوشی اندروید
     */
    static async dispatchJobOnAndroid(jobId: string): Promise<boolean> {
        const jobs = await this.getJobs();
        const job = jobs.find(j => j.id === jobId);
        if (!job) return false;

        // فراخوانی برنامه پیامک سیم‌کارت گوشی
        triggerDeviceSms(job.targetPhone, job.messageText);

        job.status = 'SENT';
        job.sentAt = getPersianDate() + ' ' + new Date().toLocaleTimeString('fa-IR');

        await persistentStorage.saveData(STORAGE_KEY_RELAY_JOBS, jobs);

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ashk_sms_relay_updated', { detail: job }));
        }

        return true;
    }

    /**
     * پاکسازی یا تغییر وضعیت کلیه پیامک‌های معلق
     */
    static async clearAllJobs(): Promise<void> {
        await persistentStorage.saveData(STORAGE_KEY_RELAY_JOBS, []);
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ashk_sms_relay_updated'));
        }
    }
}
