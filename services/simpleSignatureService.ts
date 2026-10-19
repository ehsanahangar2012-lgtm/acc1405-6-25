import { idbService } from './indexedDBService';
import { API_CONFIG } from '../config';
import { generateUUID, packPayloadToToken, unpackPayloadFromToken } from '../utils';
import { persistentStorage } from './persistentStorage';
import { workspaceService } from './workspaceService';

export interface SignatureRequest {
  id: string;
  token: string;
  documentId: string;
  documentType: string;
  documentPreview?: string;
  createdAt: string;
  expiresAt: string;
  status: 'PENDING' | 'SIGNED' | 'EXPIRED';
  signedAt?: string;
  signerName?: string;
  signatureData?: string;
}

class SimpleSignatureService {
  async createRequest(documentId: string, documentType: string, documentPreview?: string): Promise<string> {
    const rawToken = generateUUID();
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const safePreview = documentPreview || JSON.stringify({ documentId, documentType, message: 'Preview unavailable' });
    const request: SignatureRequest = {
      id: generateUUID(),
      token: rawToken,
      documentId,
      documentType,
      documentPreview: safePreview,
      createdAt,
      expiresAt,
      status: 'PENDING'
    };

    // The payload is link metadata only. The server-held record is authoritative for signing.
    const fullToken = packPayloadToToken(rawToken, {
      id: request.id,
      docId: documentId,
      type: documentType,
      preview: safePreview,
      exp: expiresAt,
      created: createdAt
    });
    request.token = fullToken;

    const secureHeaders = await workspaceService.getSecureHeaders();
    const response = await fetch(API_CONFIG.SIGNATURE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...secureHeaders },
      body: JSON.stringify({ action: 'createRequest', request })
    });
    let result: any = null;
    try { result = await response.json(); } catch {}
    if (!response.ok || !result?.success || !result?.request?.token ||
        result.request.token !== fullToken) {
      throw new Error(result?.error || 'سرور درخواست امضای معتبر ایجاد نکرد');
    }

    const serverRequest = result.request as SignatureRequest;
    await idbService.save('signature_requests', serverRequest);
    try {
      await persistentStorage.saveData('sig_' + rawToken, serverRequest);
      await persistentStorage.saveData('sig_' + fullToken, serverRequest);
      await persistentStorage.saveData('public_sig_' + rawToken, serverRequest);
      await persistentStorage.saveData('public_sig_' + fullToken, serverRequest);
    } catch (e) {
      console.warn('ذخیره نسخهٔ ابری کمکی ناموفق بود؛ نسخهٔ سرور مرجع است:', e);
    }
    return fullToken;
  }

  async getRequest(token: string): Promise<SignatureRequest | null> {
    try {
      const rawUuid = token.split('~')[0];

      // ۱. ابتدا تلاش برای خواندن از دیتابیس محلی
      let request = (await idbService.getByIndex('signature_requests', 'token', token).catch(() => null)) as SignatureRequest;
      if (!request) {
        request = (await idbService.getByIndex('signature_requests', 'token', rawUuid).catch(() => null)) as SignatureRequest;
      }
      
      // ۲. در صورتی که رکورد محلی وجود نداشت، تلاش از سرور امضا با توکن کامل و اولیه
      if (!request || !request.documentPreview) {
        try {
          let response = await fetch(`${API_CONFIG.SIGNATURE_API}?action=getRequest&token=${encodeURIComponent(token)}`);
          if (!response.ok) {
            response = await fetch(`${API_CONFIG.SIGNATURE_API}?action=getRequest&token=${encodeURIComponent(rawUuid)}`);
          }
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.request) {
              request = result.request;
            }
          }
        } catch (e) {
          console.warn('دریافت از signature API ناموفق بود، بررسی کانال ابری ثانویه...', e);
        }
      }

      // ۳. بررسی کانال تضمین‌شده ابری persistentStorage جهت استفاده کاربران غیرلاگین و عمومی
      if (!request || !request.documentPreview) {
        try {
          let cloudReq = await persistentStorage.loadData('sig_' + token);
          if (!cloudReq) {
            cloudReq = await persistentStorage.loadData('sig_' + rawUuid);
          }
          if (!cloudReq) {
            cloudReq = await persistentStorage.loadData('public_sig_' + token);
          }
          if (!cloudReq) {
            cloudReq = await persistentStorage.loadData('public_sig_' + rawUuid);
          }
          if (cloudReq && (cloudReq.documentPreview || cloudReq.token)) {
            request = cloudReq;
          }
        } catch (e) {
          console.warn('خطا در دریافت ابری امضا:', e);
        }
      }

      // ۴. Unpack embedded payload from token if offline / remote client without DB access
      if (!request || !request.documentPreview) {
        const unpacked = unpackPayloadFromToken(token);
        if (unpacked && unpacked.payload) {
          const p = unpacked.payload;
          request = {
            id: p.id || unpacked.uuid,
            token: token,
            documentId: p.docId || 'DOC-1',
            documentType: p.type || 'فاکتور',
            documentPreview: typeof p.preview === 'string' ? p.preview : JSON.stringify(p.preview || {}),
            createdAt: p.created || new Date().toISOString(),
            expiresAt: p.exp || new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
            status: 'PENDING'
          };
        }
      }

      if (!request) return null;

      // ذخیره در IndexedDB محلی به عنوان کش سریع
      await idbService.save('signature_requests', request).catch(() => {});
      
      if (new Date(request.expiresAt) < new Date()) {
        request.status = 'EXPIRED';
        await idbService.save('signature_requests', request).catch(() => {});
        return null;
      }
      
      return request;
    } catch (error) {
      console.error('خطا در دریافت درخواست امضا:', error);
      return null;
    }
  }

  async signRequest(token: string, signerName: string, signatureData: string, documentId: string): Promise<boolean> {
    try {
      // Server acceptance is required before local/cloud state can become SIGNED.
      const response = await fetch(API_CONFIG.SIGNATURE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'signRequest', token, signerName, signatureData })
      });
      let result: any = null;
      try { result = await response.json(); } catch {}
      if (!response.ok || !result?.success || result?.request?.status !== 'SIGNED') {
        console.warn('سرور امضای نهایی را نپذیرفت:', result?.error || response.status);
        return false;
      }

      const signedAt = result.request.signedAt || new Date().toISOString();
      const existing = await idbService.getByIndex('signature_requests', 'token', token).catch(() => null) as SignatureRequest | null;
      const request: SignatureRequest = {
        ...(existing || result.request),
        ...result.request,
        token,
        documentId: result.request.documentId || existing?.documentId || documentId,
        status: 'SIGNED',
        signedAt,
        signerName: result.request.signerName || signerName,
        signatureData: result.request.signatureData || signatureData
      };
      await idbService.save('signature_requests', request);

      try {
        await persistentStorage.saveData('sig_' + token, request);
        await persistentStorage.saveData('public_sig_' + token, request);
      } catch (e) {
        console.warn('به‌روزرسانی نسخهٔ ابری کمکی ناموفق بود؛ وضعیت سرور ثبت شده است:', e);
      }
      return true;
    } catch (error) {
      console.error('خطا در ثبت امضا روی سرور:', error);
      return false;
    }
  }

  async getSignedRequests(): Promise<SignatureRequest[]> {
    return await idbService.getAllByIndex('signature_requests', 'status', 'SIGNED');
  }

  async syncSignedRequests(): Promise<void> {
    try {
      const allRequests = await idbService.getAll('signature_requests') as SignatureRequest[];
      if (!allRequests) return;
      
      const pendingRequests = allRequests.filter(r => r.status === 'PENDING');
      if (pendingRequests.length === 0) return;
      
      const { setContractSignature, setInvoiceSignature, setVoucherSignature, updateCheckTransfer } = (await import('../store')).useStore.getState();

      for (const req of pendingRequests) {
        let signedData: SignatureRequest | null = null;

        // کانال اول: signature-api-simple.php
        try {
          const response = await fetch(`${API_CONFIG.SIGNATURE_API}?action=getRequest&token=${req.token}`);
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.request && result.request.status === 'SIGNED') {
              signedData = result.request as SignatureRequest;
            }
          }
        } catch {}

        // کانال دوم: persistentStorage
        if (!signedData) {
          try {
            const cloudReq = await persistentStorage.loadData('sig_' + req.token);
            if (cloudReq && cloudReq.status === 'SIGNED') {
              signedData = cloudReq;
            }
          } catch {}
        }

        if (signedData && signedData.status === 'SIGNED') {
          // بروزرسانی درخواست امضا در IndexedDB محلی
          await idbService.save('signature_requests', signedData).catch(() => {});
          
          const docId = req.documentId;
          const sigData = signedData.signatureData || '';
          
          if (req.documentType === 'قرارداد' || req.documentType === 'contract') {
            setContractSignature(docId, sigData, 'person');
          } else if (req.documentType === 'فاکتور' || req.documentType === 'invoice') {
            setInvoiceSignature(docId, sigData, 'customer');
          } else if (req.documentType === 'رسید' || req.documentType === 'voucher') {
            setVoucherSignature(docId, sigData);
          } else if (req.documentType === 'CHECK_TRANSFER') {
            updateCheckTransfer(docId, { signature: sigData, status: 'CONFIRMED' });
          }
          
          console.log(`سند از نوع ${req.documentType} با شناسه ${docId} از راه دور امضا شد.`);
        }
      }
    } catch (error) {
      console.error('خطا در همگام‌سازی امضاهای از راه دور:', error);
    }
  }
}

export const simpleSignatureService = new SimpleSignatureService();
