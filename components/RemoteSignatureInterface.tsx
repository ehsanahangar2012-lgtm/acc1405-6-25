import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Check, X, RotateCcw, Download } from 'lucide-react';

interface SignatureInterfaceProps {
  onSign: (signatureData: string, signatureImage: string) => void;
  onCancel: () => void;
  signerName: string;
  documentTitle: string;
}

export const SignatureInterface: React.FC<SignatureInterfaceProps> = ({
  onSign,
  onCancel,
  signerName,
  documentTitle,
}) => {
  const sigPadRef = useRef<SignatureCanvas>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [agreed, setAgreed] = useState(false);

  const handleClear = () => {
    sigPadRef.current?.clear();
    setIsEmpty(true);
  };

  const handleSign = () => {
    if (!sigPadRef.current || isEmpty || !agreed) return;

    const signatureData = sigPadRef.current.toDataURL();
    const signatureImage = sigPadRef.current.toDataURL('image/png');
    
    onSign(signatureData, signatureImage);
  };

  const handleEnd = () => {
    setIsEmpty(sigPadRef.current?.isEmpty() || false);
  };

  return (
    <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full">
      <h2 className="text-2xl font-bold mb-4 text-center">امضای دیجیتال</h2>
      
      <div className="mb-4 p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-gray-700 mb-2">
          <strong>امضاکننده:</strong> {signerName}
        </p>
        <p className="text-sm text-gray-700">
          <strong>سند:</strong> {documentTitle}
        </p>
      </div>

      {/* Signature Pad */}
      <div className="border-2 border-gray-300 rounded-lg mb-4 bg-white">
        <SignatureCanvas
          ref={sigPadRef}
          canvasProps={{
            className: 'w-full h-64 cursor-crosshair',
          }}
          onEnd={handleEnd}
        />
      </div>

      <div className="flex justify-between mb-4">
        <button
          onClick={handleClear}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
        >
          <RotateCcw className="w-4 h-4" />
          پاک کردن
        </button>
        <p className="text-sm text-gray-500 self-center">
          لطفاً در کادر بالا امضا کنید
        </p>
      </div>

      {/* Agreement Checkbox */}
      <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 w-5 h-5"
          />
          <span className="text-sm text-gray-700">
            با امضای این سند، تأیید میکنم که محتوای سند را به طور کامل مطالعه کردهام و با تمام شرایط و مفاد آن موافقم. 
            این امضای دیجیتال دارای اعتبار قانونی بوده و معادل امضای فیزیکی من است.
          </span>
        </label>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleSign}
          disabled={isEmpty || !agreed}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
        >
          <Check className="w-5 h-5" />
          تأیید و امضا
        </button>
        <button
          onClick={onCancel}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
        >
          <X className="w-5 h-5" />
          انصراف
        </button>
      </div>

      <p className="text-xs text-gray-500 text-center mt-4">
        امضای شما با استانداردهای رمزنگاری AES-256 محافظت میشود
      </p>
    </div>
  );
};
