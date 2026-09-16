/**
 * SLA & Annual Maintenance Contracts Service
 * مدیریت قراردادهای پشتیبانی، گارانتی سالانه، تمدید خدمات و ریموت دسکتاپ
 */

export interface SlaContract {
    contractNumber: string;
    companyName: string;
    level: 'BRONZE' | 'SILVER' | 'GOLD_VIP';
    startDate: string;
    expireDate: string;
    remainingDays: number;
    isActive: boolean;
    supportPhone: string;
    assignedExpert: string;
    freeTaxUpdatesIncluded: boolean;
    remoteSupportHoursLeft: number;
}

export interface SupportTicket {
    id: string;
    title: string;
    category: 'TAX_MOADIAN' | 'ACCOUNTING_ISSUE' | 'HARDWARE_POS' | 'BACKUP_RECOVERY' | 'GENERAL';
    priority: 'LOW' | 'NORMAL' | 'URGENT';
    status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
    createdAt: string;
    remoteSessionId?: string; // AnyDesk / RustDesk ID
    description: string;
    response?: string;
}

const STORAGE_KEY_SLA = 'ashk_sla_contract';
const STORAGE_KEY_TICKETS = 'ashk_sla_tickets';

export class SlaSupportService {
    static getContract(): SlaContract {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_SLA);
            if (raw) return JSON.parse(raw);
        } catch (_) {}
        return {
            contractNumber: 'SLA-1404-AG92',
            companyName: 'فروشگاه بازرگانی اشک قلم',
            level: 'GOLD_VIP',
            startDate: '۱۴۰۳/۱۲/۰۱',
            expireDate: '۱۴۰۴/۱۲/۰۱',
            remainingDays: 78,
            isActive: true,
            supportPhone: '۰۹۳۵۳۱۰۸۷۶۳ (ایتا @ashkghalamCo)',
            assignedExpert: 'کارشناس رسمی پشتیبانی اشک قلم',
            freeTaxUpdatesIncluded: true,
            remoteSupportHoursLeft: 12
        };
    }

    static saveContract(contract: SlaContract): void {
        localStorage.setItem(STORAGE_KEY_SLA, JSON.stringify(contract));
    }

    static getTickets(): SupportTicket[] {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_TICKETS);
            if (raw) return JSON.parse(raw);
        } catch (_) {}
        return [
            {
                id: 'TCK-104',
                title: 'راهنمایی در اتصال کلید خصوصی سامانه مؤدیان',
                category: 'TAX_MOADIAN',
                priority: 'NORMAL',
                status: 'RESOLVED',
                createdAt: '۱۴۰۴/۱۱/۱۵ - ۱۱:۳۰',
                remoteSessionId: '984 210 334',
                description: 'کلید CSR دریافت شده اما خطای عدم تطابق شناسه حافظه می‌داد.',
                response: 'مشکل از طریق اتصال ریموت AnyDesk و تطبیق کارپوشه برطرف شد.'
            },
            {
                id: 'TCK-105',
                title: 'درخواست تعریف الگوی ارسال پیامک برای چک‌های برگشتی',
                category: 'GENERAL',
                priority: 'NORMAL',
                status: 'IN_PROGRESS',
                createdAt: '۱۴۰۴/۱۱/۲۶ - ۱۴:۲۰',
                description: 'لطفاً پترن اختصاصی پیامک چک‌های برگشتی را در پنل کاوه‌نگار فعال نمایید.'
            }
        ];
    }

    static createTicket(ticket: Omit<SupportTicket, 'id' | 'createdAt' | 'status'>): SupportTicket {
        const fullTicket: SupportTicket = {
            ...ticket,
            id: `TCK-${Math.floor(100 + Math.random() * 900)}`,
            createdAt: new Date().toLocaleDateString('fa-IR') + ' - ' + new Date().toLocaleTimeString('fa-IR'),
            status: 'OPEN'
        };
        const tickets = this.getTickets();
        tickets.unshift(fullTicket);
        localStorage.setItem(STORAGE_KEY_TICKETS, JSON.stringify(tickets));
        return fullTicket;
    }

    static calculateRenewalCost(params: {
        currentPlan: 'BRONZE' | 'SILVER' | 'GOLD_VIP';
        usersCount: number;
        includeMoadianTaxUpdates: boolean;
        includeCloudBackup: boolean;
    }): { basePrice: number; discounts: number; finalPrice: number } {
        let base = 2500000; // قیمت پایه سالانه (تومان)
        if (params.currentPlan === 'SILVER') base = 4800000;
        if (params.currentPlan === 'GOLD_VIP') base = 7900000;

        if (params.usersCount > 1) {
            base += (params.usersCount - 1) * 1200000;
        }
        if (params.includeMoadianTaxUpdates) {
            base += 1500000;
        }
        if (params.includeCloudBackup) {
            base += 900000;
        }

        // تخفیف وفاداری مشتری ۱۰ درصد
        const discounts = Math.round(base * 0.1);
        const finalPrice = base - discounts;

        return {
            basePrice: base,
            discounts,
            finalPrice
        };
    }
}
