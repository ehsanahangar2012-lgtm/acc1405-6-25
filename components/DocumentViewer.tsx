import React from 'react';

interface DocumentViewerProps {
  documentUrl?: string;
  documentData?: string;
  title?: string;
  onClose?: () => void;
}

/**
 * کامپوننت نمایش اسناد PDF
 * برای نمایش فاکتورها، قراردادها و سایر اسناد
 */
export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  documentUrl,
  documentData,
  title = 'مشاهده سند',
  onClose
}) => {
  return (
    <div className="w-full h-full bg-white rounded-lg shadow-lg">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="text-lg font-bold text-gray-800">{title}</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            ×
          </button>
        )}
      </div>
      
      <div className="p-6 text-center text-gray-500">
        <div className="text-6xl mb-4">📄</div>
        <p className="text-lg mb-2">نمایش اسناد</p>
        <p className="text-sm">این قابلیت در حال توسعه است</p>
        
        {documentUrl && (
          <div className="mt-4">
            <p className="text-xs text-gray-400 mb-2">URL سند:</p>
            <p className="text-xs font-mono bg-gray-100 p-2 rounded break-all">
              {documentUrl}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentViewer;