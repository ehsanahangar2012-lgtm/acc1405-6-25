import { idbService } from './indexedDBService';
import { API_CONFIG } from '../config';
import { generateUUID, packPayloadToToken, unpackPayloadFromToken } from '../utils';
import { persistentStorage } from './persistentStorage';

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
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    const request: SignatureRequest = {
      id: generateUUID(),
      token: rawToken,
      documentId,
      documentType,
      documentPreview,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: 'PENDING'
    };

    // Pack request data into smart resilient token
    const fullToken = packPayloadToToken(rawToken, {
      id: request.id,
      docId: documentId,
      type: documentType,
      preview: documentPreview,
      exp: request.expiresAt,
      created: request.createdAt
    });

    request.token = fullToken;

    // ۱. ذخیره محلی در IndexedDB
    await idbService.save('signature_requests', request).catch(() => {});

    // ۲. ذخیره روی سرور اختصاصی امضا
    try {
      await fetch(API_CONFIG.SIGNATURE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createRequest',
          request
        })
      });
    } catch (e) {
      console.warn('پاسخ اولیه سرور امضا ناموفق بود:', e);
    }

    // ۳. ذخیره در مخزن امن و پایدار ابری (Persistent Cloud Storage) به عنوان کانال تضمین‌شده
    try {
      await persistentStorage.saveData('sig_' + rawToken, request);
      await persistentStorage.saveData('sig_' + fullToken, request);
    } catch (e) {
      console.warn('خطا در ذخیره ابری درخواست امضا:', e);
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
      
      // ۲. در صورتی که رکورد محلی وجود نداشت، تلاش از سرور امضا
      if (!request || !request.documentPreview) {
        try {
          const response = await fetch(`${API_CONFIG.SIGNATURE_API}?action=getRequest&token=${encodeURIComponent(token)}`);
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

      // ۳. بررسی کانال تضمین‌شده ابری persistentStorage در صورت عدم دریافت
      if (!request || !request.documentPreview) {
        try {
          let cloudReq = await persistentStorage.loadData('sig_' + token);
          if (!cloudReq) {
            cloudReq = await persistentStorage.loadData('sig_' + rawUuid);
          }
          if (cloudReq && (cloudReq.token === token || cloudReq.token === rawUuid)) {
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
      // ۱. بروزرسانی محلی در IndexedDB
      let request = await idbService.getByIndex('signature_requests', 'token', token) as SignatureRequest;
      const signedAt = new Date().toISOString();
      if (request) {
        request.status = 'SIGNED';
        request.signedAt = signedAt;
        request.signerName = signerName;
        request.signatureData = signatureData;
        await idbService.save('signature_requests', request).catch(() => {});
      } else {
        request = {
          id: token,
          token,
          documentId,
          documentType: 'سند',
          createdAt: signedAt,
          expiresAt: signedAt,
          status: 'SIGNED',
          signedAt,
          signerName,
          signatureData
        };
      }

      // ۲. ثبت روی سرور اختصاصی امضا
      let apiSuccess = false;
      try {
        const response = await fetch(API_CONFIG.SIGNATURE_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'signRequest',
            token,
            signerName,
            signatureData
          })
        });
        if (response.ok) {
          const res = await response.json();
          apiSuccess = res.success;
        }
      } catch (e) {
        console.warn('خطا در ارسال مستقیم به signature API:', e);
      }

      // ۳. ثبت قطعی در کانال ابری persistentStorage
      try {
        const existing = await persistentStorage.loadData('sig_' + token) || {};
        const updatedCloudData = {
          ...existing,
          ...request,
          status: 'SIGNED',
          signedAt,
          signerName,
          signatureData
        };
        await persistentStorage.saveData('sig_' + token, updatedCloudData);
      } catch (e) {
        console.warn('خطا در ذخیره ابری وضعیت امضا:', e);
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
