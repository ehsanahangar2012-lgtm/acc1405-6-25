import { AppUser } from '../types';
import { securityService } from './securityService';
import { auditTrail } from './auditTrailService';
import { workspaceService } from './workspaceService';

interface ActiveOTP {
    code: string;
    username: string;
    email: string;
    expiresAt: number;
    attempts: number;
}
interface RecoveryKeyThrottle { failures: number; blockedUntil: number; }

class RecoveryService {
    private activeOTPs = new Map<string, ActiveOTP>();
    private otpRequestedAt = new Map<string, number>();
    private failedRecoveryKeyAttempts = new Map<string, RecoveryKeyThrottle>();

    private secureRandom(length: number): Uint8Array {
        if (typeof window === 'undefined' || !window.crypto?.getRandomValues) {
            throw new Error('مولد اعداد تصادفی امن در این محیط در دسترس نیست.');
        }
        const bytes = new Uint8Array(length);
        window.crypto.getRandomValues(bytes);
        return bytes;
    }

    generateRecoveryKey(): string {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const bytes = this.secureRandom(8);
        const part = (start: number) =>
            Array.from(bytes.slice(start, start + 4), value => alphabet[value % alphabet.length]).join('');
        return `ASHK-REC-${part(0)}-${part(4)}`;
    }

    // A key or e-mail is accepted only if explicitly configured for this account.
    getEffectiveRecoveryKey(user: AppUser): string {
        return user.recoveryKey?.trim().toUpperCase() || '';
    }

    getEffectiveEmail(user: AppUser): string {
        return user.email?.trim() || '';
    }

    generateOTP(user: AppUser): { code: string; expiresAt: number; email: string } {
        const email = this.getEffectiveEmail(user);
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error('برای این حساب ایمیل بازیابی معتبر ثبت نشده است.');
        }
        const key = user.username.toLowerCase();
        const now = Date.now();
        if (now - (this.otpRequestedAt.get(key) || 0) < 30000) {
            throw new Error('برای درخواست کد جدید، ۳۰ ثانیه صبر کنید.');
        }
        const random = this.secureRandom(4);
        const randomValue = random[0] * 0x1000000 + random[1] * 0x10000 + random[2] * 0x100 + random[3];
        const code = String(100000 + (randomValue % 900000));
        const expiresAt = now + 5 * 60 * 1000;
        this.otpRequestedAt.set(key, now);
        this.activeOTPs.set(key, { code, username: user.username, email, expiresAt, attempts: 0 });
        return { code, expiresAt, email };
    }

    verifyOTP(username: string, inputCode: string): { success: boolean; message: string } {
        const key = username.toLowerCase();
        const active = this.activeOTPs.get(key);
        if (!active) {
            return { success: false, message: 'کد تأیید درخواست نشده یا منقضی شده است. دوباره درخواست کد دهید.' };
        }
        if (Date.now() > active.expiresAt) {
            this.activeOTPs.delete(key);
            return { success: false, message: 'مهلت پنج‌دقیقه‌ای کد تأیید به پایان رسیده است.' };
        }
        if (active.attempts >= 5) {
            this.activeOTPs.delete(key);
            return { success: false, message: 'تعداد تلاش‌های ناموفق بیش از حد مجاز است. کد تازه درخواست کنید.' };
        }
        active.attempts += 1;
        if (active.code !== inputCode.trim()) {
            return { success: false, message: `کد واردشده صحیح نیست. ${5 - active.attempts} تلاش باقی مانده است.` };
        }
        this.activeOTPs.delete(key);
        return { success: true, message: 'احراز هویت با موفقیت تأیید شد.' };
    }

    verifyRecoveryKey(user: AppUser, inputKey: string): { success: boolean; message: string } {
        const key = user.username.toLowerCase();
        const prior = this.failedRecoveryKeyAttempts.get(key) || { failures: 0, blockedUntil: 0 };
        if (Date.now() < prior.blockedUntil) {
            return { success: false, message: 'به دلیل تلاش‌های ناموفق، این روش بازیابی موقتاً مسدود شده است.' };
        }
        const expectedKey = this.getEffectiveRecoveryKey(user);
        if (expectedKey && inputKey.trim().toUpperCase() === expectedKey) {
            this.failedRecoveryKeyAttempts.delete(key);
            return { success: true, message: 'کلید بازیابی اختصاصی تأیید شد.' };
        }
        const failures = prior.failures + 1;
        this.failedRecoveryKeyAttempts.set(key, {
            failures: failures >= 5 ? 0 : failures,
            blockedUntil: failures >= 5 ? Date.now() + 15 * 60 * 1000 : 0
        });
        return {
            success: false,
            message: expectedKey
                ? 'کلید پشتیبان اضطراری معتبر نیست.'
                : 'برای این حساب کلید بازیابی اختصاصی تنظیم نشده است.'
        };
    }

    verifySecurityAnswer(user: AppUser, answer: string): boolean {
        if (!user.securityAnswerHash) return false;
        const inputHash = securityService.hashPassword(answer.trim().toLowerCase());
        return user.securityAnswerHash === inputHash;
    }

    maskEmail(email: string): string {
        if (!email || !email.includes('@')) return '***@***.***';
        const [name, domain] = email.split('@');
        if (name.length <= 3) return `${name[0] || '*'}***@${domain}`;
        return `${name.slice(0, 2)}***${name.slice(-1)}@${domain}`;
    }

    // Recovery codes go only to the explicitly configured first-party backend.
    async dispatchRecoveryEmail(user: AppUser, otp: string, email: string): Promise<boolean> {
        const recipientEmail = (email || this.getEffectiveEmail(user)).trim();
        if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) return false;
        if (!workspaceService.isRemoteCloudConfigured()) return false;
        const baseUrl = workspaceService.getBaseUrl().replace(/\/+$/, '');
        if (!baseUrl) return false;

        let sent = false;
        let statusDetail = 'ارسال از طریق سرور اصلی تأیید نشد';
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        try {
            const response = await fetch(`${baseUrl}/host-backend/recovery-api.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...workspaceService.getHeaders() },
                body: JSON.stringify({
                    email: recipientEmail,
                    username: user.username,
                    fullName: user.fullName,
                    otpCode: otp
                }),
                signal: controller.signal
            });
            const result = await response.json().catch(() => ({}));
            sent = response.ok && result?.success === true;
            if (!sent) statusDetail = result?.error || `پاسخ سرور ${response.status}`;
        } catch (error) {
            statusDetail = error instanceof Error ? error.message : 'خطای ارتباط با سرور';
        } finally {
            clearTimeout(timeout);
        }
        auditTrail.log(
            user.id, user.fullName, 'UPDATE', 'user', user.id, undefined,
            `درخواست بازیابی رمز برای ${user.username}؛ وضعیت ارسال: ${sent ? 'موفق' : 'ناموفق'}؛ ${statusDetail}`,
            'MEDIUM'
        ).catch(() => {});
        return sent;
    }
}

export const recoveryService = new RecoveryService();
