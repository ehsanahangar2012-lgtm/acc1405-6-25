import React, { useState, useEffect } from 'react';
import { FileSignature } from 'lucide-react';
import { ShareModal } from './ShareModal';
import { useStore } from '../store';

interface RequestSignatureButtonProps {
  documentId: string;
  documentType: string;
  documentNumber?: string;
  role?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientEmail?: string;
  companyName?: string;
  renderPreview?: () => React.ReactNode;
  onRequestSent?: () => void;
}

export const RequestSignatureButton: React.FC<RequestSignatureButtonProps> = ({
  documentId,
  documentType,
  documentNumber,
  recipientName,
  onRequestSent
}) => {
  const [showShareModal, setShowShareModal] = useState(false);
  const { invoices, vouchers, people, contracts, companies } = useStore();
  const [preview, setPreview] = useState<string>('');
  const [error, setError] = useState<string>('');
  
  useEffect(() => {
    console.log('RequestSignatureButton mounted', { documentId, documentType });
  }, []);
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      console.log('=== BUTTON CLICKED ===');
      console.log('documentId:', documentId);
      console.log('documentType:', documentType);
      
      let docPreview = '';
      
      if (documentType === 'فاکتور') {
        const invoice = invoices.find(inv => inv.id === documentId);
        if (!invoice) {
          throw new Error('فاکتور یافت نشد');
        }
        const person = people.find(p => p.id === invoice.personId);
        const company = companies.find(c => c.id === invoice.companyId) || companies.find(c => c.isActive) || companies[0];
        const fullDoc = { ...invoice, person, company };
        docPreview = JSON.stringify(fullDoc);
      } else if (documentType === 'رسید') {
        // برای حواله از sessionStorage استفاده کنیم
        const voucherPreview = sessionStorage.getItem(`voucher_preview_${documentId}`);
        if (voucherPreview) {
          docPreview = voucherPreview;
        } else {
          // اگر در sessionStorage نبود، از store استفاده کنیم
          const voucher = vouchers.find(v => v.id === documentId);
          if (!voucher) {
            throw new Error('حواله یافت نشد');
          }
          const voucherData = {
            type: 'voucher',
            number: voucher.number,
            date: voucher.date,
            time: voucher.time,
            voucherType: voucher.type === 'OUT' ? 'خروج' : voucher.type === 'IN' ? 'ورود' : 'برگشت',
            person: voucher.personName,
            items: voucher.items.map(i => ({ 
              name: i.productName, 
              productName: i.productName,
              quantity: i.quantity, 
              unit: i.unit,
              shelfLocation: i.shelfLocation
            })),
            totalWeight: voucher.totalWeight,
            trackingCode: voucher.trackingCode,
            supervisor: voucher.supervisor,
            vehicleNumber: voucher.vehicleNumber,
            receiverPhone: voucher.receiverPhone,
            loadingPhotos: voucher.loadingPhotos || [],
            notes: voucher.notes,
            status: voucher.status,
            signature: voucher.signature,
            supervisorSignature: voucher.supervisorSignature,
            companySignature: voucher.companySignature
          };
          docPreview = JSON.stringify(voucherData);
        }
      } else if (documentType === 'قرارداد') {
        const contract = contracts.find(c => c.id === documentId);
        if (!contract) {
          throw new Error('قرارداد یافت نشد');
        }
        const person = people.find(p => p.id === contract.personId);
        const activeComp = companies.find(c => c.id === contract.companyId) || companies.find(c => c.isActive) || companies[0];
        const fullDoc = { ...contract, person, company: activeComp, type: 'contract' };
        docPreview = JSON.stringify(fullDoc);
      } else {
        throw new Error('نوع سند نامعتبر است');
      }
      
      if (!docPreview) {
        throw new Error('خطا در آماده‌سازی پیشنمایش سند');
      }
      
      console.log('Preview length:', docPreview.length);
      setPreview(docPreview);
      setError('');
      setShowShareModal(true);
    } catch (err) {
      console.error('Error preparing signature request:', err);
      setError(err instanceof Error ? err.message : 'خطای نامشخص');
      alert(err instanceof Error ? err.message : 'خطا در آماده‌سازی درخواست امضا');
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="relative z-50 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-bold shadow-lg active:scale-95 transition-all"
        style={{ pointerEvents: 'auto' }}
      >
        <FileSignature size={16} />
        <span>درخواست امضا</span>
      </button>
      {showShareModal && (
        <ShareModal 
          isOpen={showShareModal} 
          onClose={() => setShowShareModal(false)} 
          documentId={documentId}
          documentType={documentType}
          documentPreview={preview}
        />
      )}
    </>
  );
};
