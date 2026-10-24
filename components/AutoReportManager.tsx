import React, { useState } from 'react';
import { Calendar, Clock, Mail, FileText, Settings, Play, Pause } from 'lucide-react';

interface AutoReport {
  id: string;
  name: string;
  type: 'financial' | 'sales' | 'inventory' | 'customers';
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string;
  recipients: string[];
  format: 'pdf' | 'excel' | 'both';
  active: boolean;
  lastRun?: string;
  nextRun?: string;
}

const AutoReportManager: React.FC = () => {
  const [reports, setReports] = useState<AutoReport[]>([
    {
      id: '1',
      name: 'گزارش روزانه فروش',
      type: 'sales',
      frequency: 'daily',
      time: '08:00',
      recipients: ['manager@company.com'],
      format: 'pdf',
      active: true,
      lastRun: '1404/12/01 08:00',
      nextRun: '1404/12/02 08:00'
    },
    {
      id: '2',
      name: 'گزارش ماهانه مالی',
      type: 'financial',
      frequency: 'monthly',
      time: '09:00',
      recipients: ['accounting@company.com', 'ceo@company.com'],
      format: 'both',
      active: true,
      lastRun: '1404/11/01 09:00',
      nextRun: '1404/12/01 09:00'
    }
  ]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newReport, setNewReport] = useState<Partial<AutoReport>>({
    name: '',
    type: 'sales',
    frequency: 'daily',
    time: '08:00',
    recipients: [],
    format: 'pdf',
    active: true
  });

  const toggleReport = (id: string) => {
    setReports(prev => prev.map(report => 
      report.id === id ? { ...report, active: !report.active } : report
    ));
  };

  const addReport = () => {
    if (!newReport.name) return;
    
    const report: AutoReport = {
      id: Date.now().toString(),
      name: newReport.name,
      type: newReport.type || 'sales',
      frequency: newReport.frequency || 'daily',
      time: newReport.time || '08:00',
      recipients: newReport.recipients || [],
      format: newReport.format || 'pdf',
      active: true
    };
    
    setReports(prev => [...prev, report]);
    setNewReport({});
    setShowAddForm(false);
  };

  const getTypeLabel = (type: string) => {
    const labels = {
      financial: 'مالی',
      sales: 'فروش',
      inventory: 'انبار',
      customers: 'مشتریان'
    };
    return labels[type as keyof typeof labels];
  };

  const getFrequencyLabel = (frequency: string) => {
    const labels = {
      daily: 'روزانه',
      weekly: 'هفتگی',
      monthly: 'ماهانه'
    };
    return labels[frequency as keyof typeof labels];
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">گزارشگیری خودکار</h2>
          <p className="text-gray-600">مدیریت گزارشهای زمانبندی شده</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          گزارش جدید
        </button>
      </div>

      <div className="grid gap-4">
        {reports.map(report => (
          <div key={report.id} className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-blue-600" />
                <div>
                  <h3 className="font-semibold">{report.name}</h3>
                  <p className="text-sm text-gray-600">
                    {getTypeLabel(report.type)} • {getFrequencyLabel(report.frequency)} • {report.time}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleReport(report.id)}
                  className={`p-2 rounded-lg ${
                    report.active 
                      ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {report.active ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </button>
                <button className="p-2 text-gray-600 hover:text-gray-800">
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">گیرندگان:</span>
                <div className="mt-1">
                  {report.recipients.map((email, index) => (
                    <div key={index} className="flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {email}
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <span className="text-gray-600">آخرین اجرا:</span>
                <div className="mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {report.lastRun || 'هنوز اجرا نشده'}
                </div>
              </div>
              
              <div>
                <span className="text-gray-600">اجرای بعدی:</span>
                <div className="mt-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {report.nextRun || 'نامشخص'}
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <span className={`px-2 py-1 rounded-full text-xs ${
                report.active 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {report.active ? 'فعال' : 'غیرفعال'}
              </span>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                {report.format === 'both' ? 'PDF + Excel' : report.format.toUpperCase()}
              </span>
            </div>
          </div>
        ))}
      </div>

      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-h-96 overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">گزارش خودکار جدید</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">نام گزارش</label>
                <input
                  type="text"
                  value={newReport.name || ''}
                  onChange={(e) => setNewReport(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-2 border rounded-lg"
                  placeholder="نام گزارش را وارد کنید"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">نوع گزارش</label>
                <select
                  value={newReport.type || 'sales'}
                  onChange={(e) => setNewReport(prev => ({ ...prev, type: e.target.value as any }))}
                  className="w-full p-2 border rounded-lg"
                >
                  <option value="sales">فروش</option>
                  <option value="financial">مالی</option>
                  <option value="inventory">انبار</option>
                  <option value="customers">مشتریان</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">تناوب</label>
                  <select
                    value={newReport.frequency || 'daily'}
                    onChange={(e) => setNewReport(prev => ({ ...prev, frequency: e.target.value as any }))}
                    className="w-full p-2 border rounded-lg"
                  >
                    <option value="daily">روزانه</option>
                    <option value="weekly">هفتگی</option>
                    <option value="monthly">ماهانه</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">زمان</label>
                  <input
                    type="time"
                    value={newReport.time || '08:00'}
                    onChange={(e) => setNewReport(prev => ({ ...prev, time: e.target.value }))}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">فرمت خروجی</label>
                <select
                  value={newReport.format || 'pdf'}
                  onChange={(e) => setNewReport(prev => ({ ...prev, format: e.target.value as any }))}
                  className="w-full p-2 border rounded-lg"
                >
                  <option value="pdf">PDF</option>
                  <option value="excel">Excel</option>
                  <option value="both">هر دو</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddForm(false)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                لغو
              </button>
              <button
                onClick={addReport}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                ایجاد
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutoReportManager;