import { useState } from 'react';
import { useFinancialStore } from '../store-financial';
import { Briefcase, Plus, TrendingUp } from 'lucide-react';
import { JalaliDatePicker } from '../components/Shared';

export default function ProjectManagement() {
  const { projects, projectTransactions, addProject, addProjectTransaction, getProjectProfitability } = useFinancialStore();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [newProject, setNewProject] = useState({ id: '', code: '', name: '', startDate: '', endDate: '', budget: 0, status: 'ACTIVE' as const, clientId: '' });

  const handleAdd = () => {
    if (newProject.name && newProject.code && newProject.budget > 0) {
      addProject({ ...newProject, id: Date.now().toString() });
      setNewProject({ id: '', code: '', name: '', startDate: '', endDate: '', budget: 0, status: 'ACTIVE', clientId: '' });
      setShowAdd(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Briefcase className="w-8 h-8 text-indigo-500" />
          <h1 className="text-2xl font-bold">مدیریت پروژهها</h1>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          پروژه جدید
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {projects.map(project => {
          const profitability = getProjectProfitability(project.id);
          return (
            <div key={project.id} className="bg-slate-900/40 border border-white/10 rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow"
                 onClick={() => setSelectedProject(project.id)}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-slate-200">{project.name}</h3>
                <span className={`px-2 py-1 rounded text-xs ${
                  project.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                  project.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {project.status === 'ACTIVE' ? 'فعال' : project.status === 'COMPLETED' ? 'تکمیل شده' : 'لغو شده'}
                </span>
              </div>
              <div className="text-sm text-slate-400 mb-4">کد: {project.code}</div>
              <div className="space-y-2 text-sm text-slate-300">
                <div className="flex justify-between">
                  <span>بودجه:</span>
                  <span className="font-bold">{project.budget.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>درآمد:</span>
                  <span className="font-bold text-green-600">{profitability.revenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>هزینه:</span>
                  <span className="font-bold text-red-600">{profitability.expenses.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span>سود:</span>
                  <span className={`font-bold ${profitability.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {profitability.profit.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-white/10 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 text-slate-100">پروژه جدید</h3>
            <div className="space-y-4">
              <input type="text" placeholder="کد پروژه" value={newProject.code} onChange={e => setNewProject({ ...newProject, code: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded text-slate-200" />
              <input type="text" placeholder="نام پروژه" value={newProject.name} onChange={e => setNewProject({ ...newProject, name: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded text-slate-200" />
              <JalaliDatePicker
                label="تاریخ شروع"
                value={newProject.startDate}
                onChange={(v: string) => setNewProject({ ...newProject, startDate: v })}
              />
              <input type="number" placeholder="بودجه" value={newProject.budget || ''} onChange={e => setNewProject({ ...newProject, budget: Number(e.target.value) })} className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded text-slate-200" />
              <div className="flex gap-2">
                <button onClick={handleAdd} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">ثبت</button>
                <button onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">انصراف</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
