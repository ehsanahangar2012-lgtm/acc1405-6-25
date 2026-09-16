import React, { useEffect, useState } from 'react';
import { auditTrail, AuditLog } from '../services/auditTrailService';
import { useStore } from '../store';
import { Shield, Download, Filter, Search } from 'lucide-react';

export const AuditTrailViewer: React.FC = () => {
  const { currentUser } = useStore();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [filters, setFilters] = useState({
    userId: '',
    action: '',
    entity: '',
    startDate: '',
    endDate: '',
    searchTerm: ''
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filters, logs]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const allLogs = await auditTrail.getLogs();
      setLogs(allLogs);
      setFilteredLogs(allLogs);
    } catch (error) {
      console.error('خطا در بارگذاری لاگها:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...logs];

    if (filters.userId) {
      filtered = filtered.filter(log => log.userId === filters.userId);
    }

    if (filters.action) {
      filtered = filtered.filter(log => log.action === filters.action);
    }

    if (filters.entity) {
      filtered = filtered.filter(log => log.entity.includes(filters.entity));
    }

    if (filters.startDate) {
      filtered = filtered.filter(log => log.timestamp >= filters.startDate);
    }

    if (filters.endDate) {
      filtered = filtered.filter(log => log.timestamp <= filters.endDate);
    }

    if (filters.searchTerm) {
      filtered = filtered.filter(log =>
        log.userName.includes(filters.searchTerm) ||
        log.entity.includes(filters.searchTerm) ||
        log.action.includes(filters.searchTerm)
      );
    }

    setFilteredLogs(filtered);
  };

  const exportReport = async () => {
    try {
      const blob = await auditTrail.exportReport(
        filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        filters.endDate || new Date().toISOString()
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-trail-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('خطا در صدور گزارش:', error);
    }
  };

  const getSeverityColor = (severity: AuditLog['severity']) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-300';
      case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getActionColor = (action: AuditLog['action']) => {
    switch (action) {
      case 'DELETE': return 'text-red-600';
      case 'CREATE': return 'text-green-600';
      case 'UPDATE': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  if (!currentUser || currentUser.roleId !== 'admin') {
    return (
      <div className="p-6 text-center">
        <Shield className="mx-auto mb-4 text-gray-400" size={48} />
        <p className="text-gray-600">فقط مدیران سیستم به این بخش دسترسی دارند</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* هدر */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="text-blue-500" size={32} />
          <div>
            <h1 className="text-2xl font-bold">گزارش حسابرسی (Audit Trail)</h1>
            <p className="text-sm text-gray-600">ردیابی تمام عملیات کاربران</p>
          </div>
        </div>
        <button
          onClick={exportReport}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          <Download size={20} />
          صدور گزارش CSV
        </button>
      </div>

      {/* فیلترها */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={20} className="text-gray-600" />
          <h3 className="font-bold">فیلترها</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">جستجو</label>
            <div className="relative">
              <Search className="absolute right-3 top-2.5 text-gray-400" size={20} />
              <input
                type="text"
                value={filters.searchTerm}
                onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                className="w-full pr-10 p-2 border rounded"
                placeholder="نام کاربر، موجودیت..."
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">عملیات</label>
            <select
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}
              className="w-full p-2 border rounded"
            >
              <option value="">همه</option>
              <option value="CREATE">ایجاد</option>
              <option value="UPDATE">ویرایش</option>
              <option value="DELETE">حذف</option>
              <option value="VIEW">مشاهده</option>
              <option value="LOGIN">ورود</option>
              <option value="LOGOUT">خروج</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">موجودیت</label>
            <input
              type="text"
              value={filters.entity}
              onChange={(e) => setFilters({ ...filters, entity: e.target.value })}
              className="w-full p-2 border rounded"
              placeholder="invoice, product..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">از تاریخ</label>
            <input
              type="datetime-local"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">تا تاریخ</label>
            <input
              type="datetime-local"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full p-2 border rounded"
            />
          </div>
        </div>
      </div>

      {/* لیست لاگها */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <p className="text-sm text-gray-600">
            {filteredLogs.length} رکورد از {logs.length} رکورد
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-right text-sm font-medium">زمان</th>
                <th className="px-4 py-3 text-right text-sm font-medium">کاربر</th>
                <th className="px-4 py-3 text-right text-sm font-medium">عملیات</th>
                <th className="px-4 py-3 text-right text-sm font-medium">موجودیت</th>
                <th className="px-4 py-3 text-right text-sm font-medium">IP</th>
                <th className="px-4 py-3 text-right text-sm font-medium">شدت</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    رکوردی یافت نشد
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      {new Date(log.timestamp).toLocaleString('fa-IR')}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">{log.userName}</td>
                    <td className={`px-4 py-3 text-sm font-bold ${getActionColor(log.action)}`}>
                      {log.action}
                    </td>
                    <td className="px-4 py-3 text-sm">{log.entity}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{log.ip || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold border ${getSeverityColor(log.severity)}`}>
                        {log.severity}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
