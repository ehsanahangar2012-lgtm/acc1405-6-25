import React, { useRef } from 'react';
import { Download, FileText, Image } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

interface SignatureCertificateProps {
  signatureData: {
    documentId: string;
    documentType: string;
    signerName: string;
    signerNationalId: string;
    signatureDate: string;
    signatureTime: string;
    ipAddress: string;
    certificateId: string;
  };
}

const SignatureCertificate: React.FC<SignatureCertificateProps> = ({ signatureData }) => {
  const certificateRef = useRef<HTMLDivElement>(null);

  const downloadAsPDF = async () => {
    if (!certificateRef.current) return;

    const canvas = await html2canvas(certificateRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff'
    });

    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);
    pdf.save(`گواهی-امضا-${signatureData.certificateId}.pdf`);
  };

  const downloadAsJPG = async () => {
    if (!certificateRef.current) return;

    const canvas = await html2canvas(certificateRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff'
    });

    const link = document.createElement('a');
    link.download = `گواهی-امضا-${signatureData.certificateId}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.9);
    link.click();
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white">
      <div ref={certificateRef} className="border-2 border-gray-300 p-8 bg-white">
        {/* هدر گواهی */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
            <FileText className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">گواهی امضای دیجیتال</h1>
          <p className="text-gray-600">منطبق با قوانین امضای الکترونیکی جمهوری اسلامی ایران</p>
        </div>

        {/* اطلاعات گواهی */}
        <div className="space-y-4 mb-8">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-3 rounded">
              <span className="text-sm text-gray-600">شماره گواهی:</span>
              <p className="font-semibold">{signatureData.certificateId}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <span className="text-sm text-gray-600">تاریخ صدور:</span>
              <p className="font-semibold">{signatureData.signatureDate}</p>
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded">
            <span className="text-sm text-gray-600">نوع سند:</span>
            <p className="font-semibold">{signatureData.documentType}</p>
          </div>

          <div className="bg-gray-50 p-3 rounded">
            <span className="text-sm text-gray-600">شناسه سند:</span>
            <p className="font-semibold">{signatureData.documentId}</p>
          </div>
        </div>

        {/* اطلاعات امضاکننده */}
        <div className="border-t pt-6 mb-8">
          <h3 className="text-lg font-semibold mb-4">اطلاعات امضاکننده</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 p-3 rounded">
              <span className="text-sm text-blue-600">نام و نام خانوادگی:</span>
              <p className="font-semibold">{signatureData.signerName}</p>
            </div>
            <div className="bg-blue-50 p-3 rounded">
              <span className="text-sm text-blue-600">کد ملی:</span>
              <p className="font-semibold">{signatureData.signerNationalId}</p>
            </div>
          </div>
        </div>

        {/* جزئیات امضا */}
        <div className="border-t pt-6 mb-8">
          <h3 className="text-lg font-semibold mb-4">جزئیات امضا</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 p-3 rounded">
              <span className="text-sm text-green-600">تاریخ امضا:</span>
              <p className="font-semibold">{signatureData.signatureDate}</p>
            </div>
            <div className="bg-green-50 p-3 rounded">
              <span className="text-sm text-green-600">زمان امضا:</span>
              <p className="font-semibold">{signatureData.signatureTime}</p>
            </div>
          </div>
          <div className="bg-green-50 p-3 rounded mt-4">
            <span className="text-sm text-green-600">آدرس IP:</span>
            <p className="font-semibold">{signatureData.ipAddress}</p>
          </div>
        </div>

        {/* تأییدیه */}
        <div className="border-t pt-6 text-center">
          <div className="bg-green-100 p-4 rounded-lg">
            <p className="text-green-800 font-semibold">
              این گواهی تأیید می‌کند که سند مذکور توسط فرد فوق‌الذکر به صورت دیجیتال امضا شده است.
            </p>
            <p className="text-sm text-green-600 mt-2">
              این گواهی منطبق با قوانین امضای الکترونیکی جمهوری اسلامی ایران صادر شده است.
            </p>
          </div>
        </div>

        {/* تاریخ صدور */}
        <div className="text-center mt-6 text-sm text-gray-500">
          <p>تاریخ صدور گواهی: {new Date().toLocaleDateString('fa-IR')}</p>
        </div>
      </div>

      {/* دکمه‌های دانلود */}
      <div className="flex justify-center gap-4 mt-6">
        <button
          onClick={downloadAsPDF}
          className="flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors"
        >
          <Download className="w-5 h-5" />
          دانلود PDF
        </button>
        <button
          onClick={downloadAsJPG}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Image className="w-5 h-5" />
          دانلود JPG
        </button>
      </div>
    </div>
  );
};

export default SignatureCertificate;