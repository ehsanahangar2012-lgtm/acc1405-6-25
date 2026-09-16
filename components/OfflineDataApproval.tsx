import React, { useState, useEffect } from 'react';
import { offlineApproval, OfflineDataItem, ApprovalStats } from '../services/offlineApprovalService';
import { smartSync, SyncConflict } from '../services/smartSyncService';
import { CheckCircle, XCircle, AlertTriangle, Clock, FileText, Package, Users, FileCheck } from 'lucide-react';

export default function OfflineDataApproval() {
  const [pendingItems, setPendingItems] = useState<OfflineDataItem[]>([]);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [stats, setStats] = useState<ApprovalStats | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const pending = await offlineApproval.getPendingApprovals();
      const conflictQueue = smartSync.getConflictQueue();
      const statistics = await offlineApproval.getStats();
      
      setPendingItems(pending);
      setConflicts(conflictQueue);
      setStats(statistics);
    } catch (error) {
      console.error('خطا در بارگذاری دادهها:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const currentUser = localStorage.getItem('currentUser') || 'admin';
      await offlineApproval.approveItem(id, currentUser);
      await loadData();
    } catch (error) {
      console.error('خطا در تایید:', error);
      alert('خطا در تایید داده');
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('دلیل رد را وارد کنید:');
    if (!reason) return;

    try {
      const currentUser = localStorage.getItem('currentUser') || 'admin';
      await offlineApproval.rejectItem(id, currentUser, reason);
      await loadData();
    } catch (error) {
      console.error('خطا در رد:', error);
      alert('خطا در رد داده');
    }
  };

  const handleBulkApprove = async () => {
    if (selectedItems.size === 0) {
      alert('لطفا حداقل یک مورد را انتخاب کنید');
      return;
    }

    if (!confirm(`آیا از تایید ${selectedItems.size} مورد اطمینان دارید؟`)) return;

    try {
      const currentUser = localStorage.getItem('currentUser') || 'admin';
      const count = await offlineApproval.approveMultiple(Array.from(selectedItems), currentUser);
      alert(`${count} مورد با موفقیت تایید شد`);
      setSelectedItems(new Set());
      await loadData();
    } catch (error) {
      console.error('خطا در تایید دسته‌جمعی:', error);
      alert('خطا در تایید دسته‌جمعی');
    }
  };

  const handleBulkReject = async () => {
    if (selectedItems.size === 0) {
      alert('لطفا حداقل یک مورد را انتخاب کنید');
      return;
    }

    const reason = prompt('دلیل رد دسته‌جمعی را وارد کنید:');
    if (!reason) return;

    try {
      const currentUser = localStorage.getItem('currentUser') || 'admin';
      const count = await offlineApproval.rejectMultiple(Array.from(selectedItems), currentUser, reason);
      alert(`${count} مورد با موفقیت رد شد`);
      setSelectedItems(new Set());
      await loadData();
    } catch (error) {
      console.error('خطا در رد دسته‌جمعی:', error);
      alert('خطا در رد دسته‌جمعی');
    }
  };

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedItems(newSelection);
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'invoice': return <FileText className="w-5 h-5" />;
      case 'product': return <Package className="w-5 h-5" />;
      case 'customer': return <Users className="w-5 h-5" />;
      case 'voucher': return <FileCheck className="w-5 h-5" />;
      default: return <FileText className="w-5 h-5" />;
    }
  };

  const getOperationLabel = (operation: string) => {
    switch (operation) {
      case 'create': return 'ایجاد';
      case 'update': return 'ویرایش';
      case 'delete': return 'حذف';
      default: return operation;
    }
  };

  const getEntityTypeLabel = (type: string) => {
    switch (type) {
      case 'invoice': return 'فاکتور';
      case 'product': return 'کالا';
      case 'customer': return 'مشتری';
      case 'voucher': return 'سند';
      case 'check': return 'چک';
      default: return type;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Clock className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-600">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">تایید دادههای آفلاین</h1>
        <p className="text-gray-600">مدیریت و تایید دادههای ثبت شده در حالت آفلاین</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">در انتظار تایید</p>
                <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
              </div>
              <Clock className="w-8 h-8 text-orange-500" />
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">تایید شده</p>
                <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">رد شده</p>
                <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">تضادها</p>
                <p className="text-2xl font-bold text-yellow-600">{conflicts.length}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedItems.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <p className="text-blue-900">
              {selectedItems.size} مورد انتخاب شده
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleBulkApprove}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                تایید همه
              </button>
              <button
                onClick={handleBulkReject}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                رد همه
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conflicts Section */}
      {conflicts.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-yellow-500" />
            تضادهای سینک
          </h2>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-900 mb-2">
              {conflicts.length} تضاد شناسایی شده که نیاز به بررسی دارد
            </p>
            {conflicts.map(conflict => (
              <div key={conflict.id} className="bg-white p-3 rounded mt-2">
                <p className="font-semibold">{getEntityTypeLabel(conflict.entityType)}</p>
                <p className="text-sm text-gray-600">نوع تضاد: {conflict.conflictType}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Items */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">دادههای در انتظار تایید</h2>
        
        {pendingItems.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <p className="text-gray-600">هیچ داده‌ای در انتظار تایید نیست</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingItems.map(item => (
              <div key={item.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    checked={selectedItems.has(item.id)}
                    onChange={() => toggleSelection(item.id)}
                    className="mt-1"
                  />
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getEntityIcon(item.entityType)}
                      <h3 className="font-semibold text-lg">
                        {getEntityTypeLabel(item.entityType)} - {getOperationLabel(item.operation)}
                      </h3>
                      {item.conflictInfo?.hasConflict && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
                          تضاد
                        </span>
                      )}
                    </div>
                    
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>زمان: {new Date(item.timestamp).toLocaleString('fa-IR')}</p>
                      <p>کاربر: {item.userId}</p>
                      <p>دستگاه: {item.deviceId}</p>
                    </div>

                    {item.conflictInfo?.hasConflict && (
                      <div className="mt-2 p-2 bg-yellow-50 rounded text-sm">
                        <p className="text-yellow-800">
                          این داده با اطلاعات سرور تضاد دارد و نیاز به بررسی دقیق دارد
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(item.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      تایید
                    </button>
                    <button
                      onClick={() => handleReject(item.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      رد
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
