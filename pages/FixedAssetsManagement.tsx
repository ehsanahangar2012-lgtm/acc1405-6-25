import { useState } from 'react';
import { useFinancialStore } from '../store-financial';
import { Package, Plus } from 'lucide-react';
import { JalaliDatePicker } from '../components/Shared';
import { getPersianDate } from '../utils';

export default function FixedAssetsManagement() {
  const { fixedAssets, addFixedAsset, calculateDepreciation } = useFinancialStore();
  const [showAdd, setShowAdd] = useState(false);
  const [newAsset, setNewAsset] = useState({ id: '', code: '', name: '', purchaseDate: '', purchasePrice: 0, salvageValue: 0, usefulLife: 5, depreciationMethod: 'STRAIGHT_LINE' as const, accumulatedDepreciation: 0, bookValue: 0, status: 'ACTIVE' as const });

  const generateNextAssetCode = () => {
    const prefix = 'AST-';
    let maxNum = 1000;
    fixedAssets.forEach(asset => {
      if (asset.code && asset.code.startsWith(prefix)) {
        const num = parseInt(asset.code.replace(prefix, ''), 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });
    return `${prefix}${maxNum + 1}`;
  };

  const handleAdd = () => {
    if (newAsset.name && newAsset.code && newAsset.purchasePrice > 0) {
      addFixedAsset({ ...newAsset, id: Date.now().toString(), bookValue: newAsset.purchasePrice });
      setNewAsset({ id: '', code: '', name: '', purchaseDate: '', purchasePrice: 0, salvageValue: 0, usefulLife: 5, depreciationMethod: 'STRAIGHT_LINE', accumulatedDepreciation: 0, bookValue: 0, status: 'ACTIVE' });
      setShowAdd(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Package className="w-8 h-8 text-amber-500" />
          <h1 className="text-2xl font-bold">مدیریت داراییهای ثابت</h1>
        </div>
        <button
          onClick={() => {
            setNewAsset({
              id: '',
              code: generateNextAssetCode(),
              name: '',
              purchaseDate: getPersianDate(),
              purchasePrice: 0,
              salvageValue: 0,
              usefulLife: 5,
              depreciationMethod: 'STRAIGHT_LINE',
              accumulatedDepreciation: 0,
              bookValue: 0,
              status: 'ACTIVE'
            });
            setShowAdd(true);
          }}
          className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          دارایی جدید
        </button>
      </div>

      <div className="bg-slate-900/40 border border-white/5 rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-800/50">
            <tr>
              <th className="px-4 py-3 text-right text-slate-200">کد</th>
              <th className="px-4 py-3 text-right text-slate-200">نام دارایی</th>
              <th className="px-4 py-3 text-right text-slate-200">قیمت خرید</th>
              <th className="px-4 py-3 text-right text-slate-200">استهلاک انباشته</th>
              <th className="px-4 py-3 text-right text-slate-200">ارزش دفتری</th>
              <th className="px-4 py-3 text-right text-slate-200">روش استهلاک</th>
              <th className="px-4 py-3 text-right text-slate-200">وضعیت</th>
            </tr>
          </thead>
          <tbody>
            {fixedAssets.map(asset => (
              <tr key={asset.id} className="border-b border-white/5 hover:bg-slate-800/30 text-slate-200">
                <td className="px-4 py-3">{asset.code}</td>
                <td className="px-4 py-3 font-medium">{asset.name}</td>
                <td className="px-4 py-3">{asset.purchasePrice.toLocaleString()}</td>
                <td className="px-4 py-3 text-red-600">{asset.accumulatedDepreciation.toLocaleString()}</td>
                <td className="px-4 py-3 font-bold">{asset.bookValue.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm">
                  {asset.depreciationMethod === 'STRAIGHT_LINE' ? 'خط مستقیم' :
                   asset.depreciationMethod === 'DECLINING_BALANCE' ? 'مانده نزولی' : 'واحد تولید'}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${
                    asset.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                    asset.status === 'DISPOSED' ? 'bg-gray-100 text-gray-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {asset.status === 'ACTIVE' ? 'فعال' : asset.status === 'DISPOSED' ? 'اسقاط' : 'فروخته شده'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-white/10 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 text-slate-100">دارایی ثابت جدید</h3>
            <div className="space-y-4 text-slate-900">
              <input type="text" placeholder="کد دارایی" value={newAsset.code} onChange={e => setNewAsset({ ...newAsset, code: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded text-slate-200 outline-none" readOnly />
              <input type="text" placeholder="نام دارایی" value={newAsset.name} onChange={e => setNewAsset({ ...newAsset, name: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded text-slate-200" />
              <JalaliDatePicker
                label="تاریخ خرید"
                value={newAsset.purchaseDate}
                onChange={(v: string) => setNewAsset({ ...newAsset, purchaseDate: v })}
              />
              <input type="number" placeholder="قیمت خرید" value={newAsset.purchasePrice || ''} onChange={e => setNewAsset({ ...newAsset, purchasePrice: Number(e.target.value) })} className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded text-slate-200" />
              <input type="number" placeholder="عمر مفید (سال)" value={newAsset.usefulLife} onChange={e => setNewAsset({ ...newAsset, usefulLife: Number(e.target.value) })} className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded text-slate-200" />
              <div className="flex gap-2">
                <button onClick={handleAdd} className="flex-1 px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700">ثبت</button>
                <button onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">انصراف</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
