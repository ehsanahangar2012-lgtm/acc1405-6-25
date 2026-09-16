// Component نمایش Conflicts و درخواست تأیید از کاربر
import React, { useState } from 'react';
import { AlertTriangle, Check, X, Info } from 'lucide-react';
import type { SyncConflict } from '../services/syncApprovalService';

interface ConflictResolutionModalProps {
  conflicts: SyncConflict[];
  onResolve: (resolutions: Array<{ id: string; action: 'keep_local' | 'keep_remote' | 'delete' }>) => void;
  onCancel: () => void;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  conflicts,
  onResolve,
  onCancel,
}) => {
  const [resolutions, setResolutions] = useState<Record<string, 'keep_local' | 'keep_remote' | 'delete'>>({});

  const getSeverityColor = (severity: SyncConflict['severity']) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 border-red-500 text-red-900';
      case 'high': return 'bg-orange-100 border-orange-500 text-orange-900';
      case 'medium': return 'bg-yellow-100 border-yellow-500 text-yellow-900';
      default: return 'bg-blue-100 border-blue-500 text-blue-900';
    }
  };

  const getConflictLabel = (type: SyncConflict['conflictType']) => {
    switch (type) {
      case 'delete_vs_update': return 'حذف شده در یک سیستم، تغییر کرده در سیستم دیگر';
      case 'update_vs_update': return 'تغییر متفاوت در دو سیستم';
      case 'delete_vs_create': return 'حذف شده در یک سیستم، ایجاد شده در سیستم دیگر';
    }
  };

  const handleResolve = () => {
    const resolvedConflicts = conflicts.map(c => ({
      id: c.id,
      action: resolutions[c.id] || 'keep_local',
    }));
    onResolve(resolvedConflicts);
  };

  const allResolved = conflicts.every(c => resolutions[c.id]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8" />
            <div>
              <h2 className="text-2xl font-bold">تعارض در همگامسازی</h2>
              <p className="text-orange-100 mt-1">
                {conflicts.length} مورد نیاز به تأیید دارد
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {conflicts.map((conflict) => (
            <div
              key={conflict.id}
              className={`border-r-4 rounded-lg p-4 ${getSeverityColor(conflict.severity)}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-lg">{conflict.type}</h3>
                  <p className="text-sm opacity-75">{getConflictLabel(conflict.conflictType)}</p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-white bg-opacity-50">
                  {conflict.severity === 'critical' ? 'بحرانی' : 
                   conflict.severity === 'high' ? 'مهم' :
                   conflict.severity === 'medium' ? 'متوسط' : 'کم'}
                </span>
              </div>

              {/* Data Comparison */}
              <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div className="bg-white bg-opacity-50 rounded p-3">
                  <p className="font-semibold mb-2">📱 داده محلی:</p>
                  {conflict.localData ? (
                    <pre className="text-xs overflow-auto max-h-32">
                      {JSON.stringify(conflict.localData, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-gray-500 italic">حذف شده</p>
                  )}
                </div>
                <div className="bg-white bg-opacity-50 rounded p-3">
                  <p className="font-semibold mb-2">☁️ داده سرور:</p>
                  {conflict.remoteData ? (
                    <pre className="text-xs overflow-auto max-h-32">
                      {JSON.stringify(conflict.remoteData, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-gray-500 italic">حذف شده</p>
                  )}
                </div>
              </div>

              {/* Resolution Options */}
              <div className="flex gap-2">
                <button
                  onClick={() => setResolutions({ ...resolutions, [conflict.id]: 'keep_local' })}
                  className={`flex-1 py-2 px-4 rounded transition-colors ${
                    resolutions[conflict.id] === 'keep_local'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white hover:bg-blue-50 text-gray-700'
                  }`}
                >
                  نگهداری محلی
                </button>
                <button
                  onClick={() => setResolutions({ ...resolutions, [conflict.id]: 'keep_remote' })}
                  className={`flex-1 py-2 px-4 rounded transition-colors ${
                    resolutions[conflict.id] === 'keep_remote'
                      ? 'bg-green-600 text-white'
                      : 'bg-white hover:bg-green-50 text-gray-700'
                  }`}
                >
                  نگهداری سرور
                </button>
                <button
                  onClick={() => setResolutions({ ...resolutions, [conflict.id]: 'delete' })}
                  className={`flex-1 py-2 px-4 rounded transition-colors ${
                    resolutions[conflict.id] === 'delete'
                      ? 'bg-red-600 text-white'
                      : 'bg-white hover:bg-red-50 text-gray-700'
                  }`}
                >
                  حذف هر دو
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-6 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center gap-3 mb-4 text-sm text-gray-600 dark:text-gray-400">
            <Info className="w-5 h-5" />
            <p>
              لطفاً برای هر مورد تصمیم بگیرید. این تصمیمات قابل بازگشت نیستند.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleResolve}
              disabled={!allResolved}
              className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-400 text-white py-3 px-6 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" />
              تأیید و اعمال ({Object.keys(resolutions).length}/{conflicts.length})
            </button>
            <button
              onClick={onCancel}
              className="px-6 py-3 border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              <X className="w-5 h-5" />
              انصراف
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
