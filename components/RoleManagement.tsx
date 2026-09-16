import React, { useState } from 'react';
import { PREDEFINED_ROLES, AdvancedRole, rbacService } from '../services/rbacService';
import { useStore } from '../store';
import { Shield, Users, Lock, CheckCircle, XCircle } from 'lucide-react';

export const RoleManagement: React.FC = () => {
  const { currentUser, users } = useStore();
  const [selectedRole, setSelectedRole] = useState<AdvancedRole | null>(null);

  if (!currentUser || currentUser.roleId !== 'admin') {
    return (
      <div className="p-6 text-center">
        <Lock className="mx-auto mb-4 text-gray-400" size={48} />
        <p className="text-gray-600">فقط مدیران سیستم به این بخش دسترسی دارند</p>
      </div>
    );
  }

  const getRoleUsers = (roleId: string) => {
    return users.filter(u => u.roleId === roleId);
  };

  return (
    <div className="p-6 space-y-6">
      {/* هدر */}
      <div className="flex items-center gap-3">
        <Shield className="text-blue-500" size={32} />
        <div>
          <h1 className="text-2xl font-bold">مدیریت نقشها و دسترسیها</h1>
          <p className="text-sm text-gray-600">تعریف و مدیریت سطوح دسترسی کاربران</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* لیست نقشها */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Users size={20} />
            نقشهای تعریف شده
          </h2>
          {PREDEFINED_ROLES.map((role) => {
            const userCount = getRoleUsers(role.id).length;
            return (
              <div
                key={role.id}
                onClick={() => setSelectedRole(role)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition ${
                  selectedRole?.id === role.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold">{role.name}</h3>
                  <span className="px-2 py-1 bg-gray-200 rounded text-xs">
                    {userCount} کاربر
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-2">{role.description}</p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>سطح تأیید: {role.approvalLevel}</span>
                  {role.maxTransactionAmount && (
                    <span>• حداکثر: {(role.maxTransactionAmount / 1000000).toFixed(0)}M</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* جزئیات نقش */}
        <div className="lg:col-span-2">
          {selectedRole ? (
            <div className="bg-white rounded-lg shadow p-6 space-y-6">
              <div>
                <h2 className="text-xl font-bold mb-2">{selectedRole.name}</h2>
                <p className="text-gray-600">{selectedRole.description}</p>
              </div>

              {/* دسترسیهای ماژول */}
              <div>
                <h3 className="font-bold mb-3 flex items-center gap-2">
                  <Shield size={20} />
                  دسترسیهای ماژولها
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(selectedRole.permissions).map(([module, perms]) => (
                    <div key={module} className="border rounded p-3">
                      <h4 className="font-bold mb-2 text-sm">
                        {getModuleName(module)}
                      </h4>
                      <div className="space-y-1 text-sm">
                        <PermissionRow label="مشاهده" value={perms.view} />
                        <PermissionRow label="ایجاد" value={perms.create} />
                        <PermissionRow label="ویرایش" value={perms.edit} />
                        <PermissionRow label="حذف" value={perms.delete} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* محدودیتهای فیلد */}
              {selectedRole.entityPermissions.length > 0 && (
                <div>
                  <h3 className="font-bold mb-3">محدودیتهای سطح فیلد</h3>
                  {selectedRole.entityPermissions.map((entityPerm, idx) => (
                    <div key={idx} className="border rounded p-3 mb-3">
                      <h4 className="font-bold text-sm mb-2">{entityPerm.entity}</h4>
                      <div className="space-y-1 text-sm">
                        {entityPerm.fields.map((field, fidx) => (
                          <div key={fidx} className="flex items-center justify-between">
                            <span>{field.field}</span>
                            <div className="flex gap-2">
                              <span className={field.read ? 'text-green-600' : 'text-red-600'}>
                                خواندن: {field.read ? '✓' : '✗'}
                              </span>
                              <span className={field.write ? 'text-green-600' : 'text-red-600'}>
                                نوشتن: {field.write ? '✓' : '✗'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      {entityPerm.conditions && (
                        <div className="mt-2 text-xs text-gray-600">
                          {entityPerm.conditions.ownOnly && '• فقط رکوردهای خود'}
                          {entityPerm.conditions.branchOnly && '• فقط شعبه خود'}
                          {entityPerm.conditions.projectOnly && '• فقط پروژه خود'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* کاربران با این نقش */}
              <div>
                <h3 className="font-bold mb-3 flex items-center gap-2">
                  <Users size={20} />
                  کاربران ({getRoleUsers(selectedRole.id).length})
                </h3>
                <div className="space-y-2">
                  {getRoleUsers(selectedRole.id).map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div>
                        <p className="font-medium">{user.fullName}</p>
                        <p className="text-sm text-gray-600">@{user.username}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs ${
                        user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {user.is_active ? 'فعال' : 'غیرفعال'}
                      </span>
                    </div>
                  ))}
                  {getRoleUsers(selectedRole.id).length === 0 && (
                    <p className="text-center text-gray-500 py-4">کاربری با این نقش وجود ندارد</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-12 text-center">
              <Shield className="mx-auto mb-4 text-gray-400" size={48} />
              <p className="text-gray-600">یک نقش را انتخاب کنید</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PermissionRow: React.FC<{ label: string; value: boolean }> = ({ label, value }) => (
  <div className="flex items-center justify-between">
    <span className="text-gray-700">{label}</span>
    {value ? (
      <CheckCircle size={16} className="text-green-500" />
    ) : (
      <XCircle size={16} className="text-red-500" />
    )}
  </div>
);

const getModuleName = (module: string): string => {
  const names: Record<string, string> = {
    dashboard: 'داشبورد',
    invoices: 'فاکتورها',
    inventory: 'انبار',
    checks: 'چکها',
    finance: 'امور مالی',
    customers: 'مشتریان',
    reports: 'گزارشات',
    settings: 'تنظیمات',
    users: 'کاربران'
  };
  return names[module] || module;
};
