import { UserPermissions, ModulePermission } from '../types';

export interface FieldPermission {
  field: string;
  read: boolean;
  write: boolean;
}

export interface EntityPermission {
  entity: string;
  fields: FieldPermission[];
  conditions?: {
    ownOnly?: boolean;
    branchOnly?: boolean;
    projectOnly?: boolean;
  };
}

export interface AdvancedRole {
  id: string;
  name: string;
  description: string;
  permissions: UserPermissions;
  entityPermissions: EntityPermission[];
  approvalLevel?: number;
  maxTransactionAmount?: number;
}

export const PREDEFINED_ROLES: AdvancedRole[] = [
  {
    id: 'admin',
    name: 'مدیر سیستم',
    description: 'دسترسی کامل',
    permissions: {
      dashboard: { view: true, create: true, edit: true, delete: true },
      invoices: { view: true, create: true, edit: true, delete: true },
      inventory: { view: true, create: true, edit: true, delete: true },
      checks: { view: true, create: true, edit: true, delete: true },
      finance: { view: true, create: true, edit: true, delete: true },
      customers: { view: true, create: true, edit: true, delete: true },
      reports: { view: true, create: true, edit: true, delete: true },
      settings: { view: true, create: true, edit: true, delete: true },
      users: { view: true, create: true, edit: true, delete: true }
    },
    entityPermissions: [],
    approvalLevel: 3
  },
  {
    id: 'accountant',
    name: 'حسابدار',
    description: 'دسترسی به امور مالی و حسابداری',
    permissions: {
      dashboard: { view: true, create: false, edit: false, delete: false },
      invoices: { view: true, create: true, edit: true, delete: false },
      inventory: { view: true, create: false, edit: false, delete: false },
      checks: { view: true, create: true, edit: true, delete: false },
      finance: { view: true, create: true, edit: true, delete: false },
      customers: { view: true, create: true, edit: true, delete: false },
      reports: { view: true, create: true, edit: false, delete: false },
      settings: { view: false, create: false, edit: false, delete: false },
      users: { view: false, create: false, edit: false, delete: false }
    },
    entityPermissions: [
      {
        entity: 'invoice',
        fields: [
          { field: 'buyPrice', read: true, write: false },
          { field: 'profit', read: true, write: false }
        ]
      }
    ],
    approvalLevel: 2,
    maxTransactionAmount: 100000000
  },
  {
    id: 'financial_manager',
    name: 'مدیر مالی',
    description: 'مدیریت امور مالی و گزارشات',
    permissions: {
      dashboard: { view: true, create: false, edit: false, delete: false },
      invoices: { view: true, create: false, edit: false, delete: false },
      inventory: { view: true, create: false, edit: false, delete: false },
      checks: { view: true, create: false, edit: true, delete: false },
      finance: { view: true, create: true, edit: true, delete: true },
      customers: { view: true, create: false, edit: false, delete: false },
      reports: { view: true, create: true, edit: true, delete: false },
      settings: { view: true, create: false, edit: true, delete: false },
      users: { view: true, create: false, edit: false, delete: false }
    },
    entityPermissions: [],
    approvalLevel: 3
  },
  {
    id: 'auditor',
    name: 'حسابرس',
    description: 'دسترسی فقط خواندنی برای حسابرسی',
    permissions: {
      dashboard: { view: true, create: false, edit: false, delete: false },
      invoices: { view: true, create: false, edit: false, delete: false },
      inventory: { view: true, create: false, edit: false, delete: false },
      checks: { view: true, create: false, edit: false, delete: false },
      finance: { view: true, create: false, edit: false, delete: false },
      customers: { view: true, create: false, edit: false, delete: false },
      reports: { view: true, create: true, edit: false, delete: false },
      settings: { view: false, create: false, edit: false, delete: false },
      users: { view: false, create: false, edit: false, delete: false }
    },
    entityPermissions: [],
    approvalLevel: 0
  },
  {
    id: 'user',
    name: 'کاربر عادی',
    description: 'دسترسی محدود',
    permissions: {
      dashboard: { view: true, create: false, edit: false, delete: false },
      invoices: { view: true, create: true, edit: false, delete: false },
      inventory: { view: true, create: false, edit: false, delete: false },
      checks: { view: true, create: false, edit: false, delete: false },
      finance: { view: false, create: false, edit: false, delete: false },
      customers: { view: true, create: false, edit: false, delete: false },
      reports: { view: false, create: false, edit: false, delete: false },
      settings: { view: false, create: false, edit: false, delete: false },
      users: { view: false, create: false, edit: false, delete: false }
    },
    entityPermissions: [
      {
        entity: 'invoice',
        fields: [
          { field: 'buyPrice', read: false, write: false },
          { field: 'profit', read: false, write: false }
        ],
        conditions: { ownOnly: true }
      }
    ],
    approvalLevel: 1,
    maxTransactionAmount: 10000000
  }
];

class RBACService {
  hasPermission(
    userPermissions: UserPermissions,
    module: keyof UserPermissions,
    action: keyof ModulePermission
  ): boolean {
    return userPermissions[module]?.[action] || false;
  }

  canAccessField(
    roleId: string,
    entity: string,
    field: string,
    action: 'read' | 'write'
  ): boolean {
    const role = PREDEFINED_ROLES.find(r => r.id === roleId);
    if (!role) return false;

    const entityPerm = role.entityPermissions.find(e => e.entity === entity);
    if (!entityPerm) return true;

    const fieldPerm = entityPerm.fields.find(f => f.field === field);
    if (!fieldPerm) return true;

    return action === 'read' ? fieldPerm.read : fieldPerm.write;
  }

  requiresApproval(roleId: string, amount: number): boolean {
    const role = PREDEFINED_ROLES.find(r => r.id === roleId);
    if (!role || !role.maxTransactionAmount) return false;
    return amount > role.maxTransactionAmount;
  }

  getApprovalLevel(roleId: string): number {
    const role = PREDEFINED_ROLES.find(r => r.id === roleId);
    return role?.approvalLevel || 0;
  }

  canApprove(approverRoleId: string, requesterRoleId: string): boolean {
    const approverLevel = this.getApprovalLevel(approverRoleId);
    const requesterLevel = this.getApprovalLevel(requesterRoleId);
    return approverLevel > requesterLevel;
  }
}

export const rbacService = new RBACService();
