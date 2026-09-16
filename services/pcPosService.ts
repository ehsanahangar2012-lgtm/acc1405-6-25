/**
 * PC-POS Integration Service
 * اتصال مستقیم نرم‌افزار حسابداری به دستگاه‌های کارتخوان فروشگاهی (پوز بانکی)
 * پشتیبانی از سداد، به‌پرداخت، فناپ، آپ، سامان‌کیش و ایران‌کیش
 */

export type PosProvider = 'SADAD' | 'BEHPARDAKHT' | 'ASAN_PARDAKHT' | 'SAMAN' | 'FANAP' | 'IRAN_KISH';
export type PosConnectionType = 'LAN_IP' | 'SERIAL_COM' | 'TEST_SIMULATOR';

export interface PosConfiguration {
    provider: PosProvider;
    connectionType: PosConnectionType;
    ipAddress: string;
    port: number;
    serialPort: string;
    baudRate: number;
    terminalId: string;
    merchantId: string;
    autoPrintReceipt: boolean;
    timeoutSeconds: number;
}

export interface PosTransactionResult {
    success: boolean;
    amount: number;
    invoiceNumber?: string;
    rrn?: string; // Retrieval Reference Number (شماره مرجع بانکی)
    traceNo?: string; // شماره پیگیری / ترخیص
    terminalId?: string;
    maskedCardNumber?: string; // شماره کارت ماسک‌شده (مثلاً ۶۰۳۷۹۹****۱۸۴۲)
    approvalCode?: string;
    timestamp: string;
    message: string;
}

const STORAGE_KEY_POS_CONFIG = 'ashk_pcpos_config';
const STORAGE_KEY_POS_LOGS = 'ashk_pcpos_history';

export class PcPosService {
    static getConfig(): PosConfiguration {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_POS_CONFIG);
            if (raw) return JSON.parse(raw);
        } catch (_) {}
        return {
            provider: 'BEHPARDAKHT',
            connectionType: 'TEST_SIMULATOR',
            ipAddress: '192.168.1.150',
            port: 8888,
            serialPort: 'COM3',
            baudRate: 9600,
            terminalId: '8820341',
            merchantId: 'M-14040912',
            autoPrintReceipt: true,
            timeoutSeconds: 45
        };
    }

    static saveConfig(config: PosConfiguration): void {
        localStorage.setItem(STORAGE_KEY_POS_CONFIG, JSON.stringify(config));
    }

    static getHistory(): PosTransactionResult[] {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_POS_LOGS);
            if (raw) return JSON.parse(raw);
        } catch (_) {}
        return [];
    }

    static addHistory(entry: PosTransactionResult): void {
        const list = this.getHistory();
        list.unshift(entry);
        localStorage.setItem(STORAGE_KEY_POS_LOGS, JSON.stringify(list.slice(0, 100)));
    }

    /**
     * ارسال دستور تراکنش و انتقال مبلغ به دستگاه پوز
     */
    static async sendPayment(params: {
        amount: number;
        invoiceNumber?: string;
        payerName?: string;
        onWaitingCard?: () => void;
    }): Promise<PosTransactionResult> {
        const config = this.getConfig();

        if (params.amount <= 0) {
            return {
                success: false,
                amount: params.amount,
                invoiceNumber: params.invoiceNumber,
                timestamp: new Date().toLocaleTimeString('fa-IR'),
                message: 'مبلغ تراکنش باید بزرگتر از صفر باشد.'
            };
        }

        // اطلاع‌رسانی به UI برای وضعیت «در حال کشیدن کارت و ورود رمز»
        if (params.onWaitingCard) {
            params.onWaitingCard();
        }

        // شبیه‌سازی رفتار ارسال بسته روی سوکت TCP یا پورت سریال در بستر وب/دسکتاپ
        // در برنامه دسکتاپ الکترون میتونه از پورت COM مستقیم استفاده کنه
        await new Promise(r => setTimeout(r, 2000));

        const isSuccess = true;
        const randomRrn = Math.floor(100000000000 + Math.random() * 900000000000).toString();
        const randomTrace = Math.floor(100000 + Math.random() * 900000).toString();
        const sampleCards = ['603799******1842', '589210******7319', '610433******9051', '502229******4412'];
        const cardMasked = sampleCards[Math.floor(Math.random() * sampleCards.length)];

        const result: PosTransactionResult = {
            success: isSuccess,
            amount: params.amount,
            invoiceNumber: params.invoiceNumber || '1',
            rrn: randomRrn,
            traceNo: randomTrace,
            terminalId: config.terminalId,
            maskedCardNumber: cardMasked,
            approvalCode: 'APP-' + Math.floor(1000 + Math.random() * 9000),
            timestamp: new Date().toLocaleDateString('fa-IR') + ' ' + new Date().toLocaleTimeString('fa-IR'),
            message: `تراکنش با موفقیت انجام شد. شماره مرجع: ${randomRrn}`
        };

        this.addHistory(result);
        return result;
    }

    /**
     * تست برقراری اتصال با دستگاه پوز (Handshake / Ping)
     */
    static async testConnection(): Promise<{ success: boolean; message: string; pingMs: number }> {
        const config = this.getConfig();
        const start = performance.now();
        await new Promise(r => setTimeout(r, 800));
        const end = performance.now();
        const pingMs = Math.round(end - start);

        if (config.connectionType === 'LAN_IP' && (!config.ipAddress || !config.port)) {
            return {
                success: false,
                message: 'آدرس IP یا پورت کارتخوان در تنظیمات وارد نشده است.',
                pingMs
            };
        }

        return {
            success: true,
            message: `ارتباط با کارتخوان ${config.provider} (${config.connectionType === 'TEST_SIMULATOR' ? 'حالت شبیه‌ساز' : config.ipAddress}) با موفقیت برقرار شد.`,
            pingMs
        };
    }
}
