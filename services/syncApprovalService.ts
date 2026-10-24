// Sync Approval Service - سیستم تأیید هوشمند برای Sync
// تشخیص conflicts و درخواست تأیید از کاربر ارشد

export interface SyncConflict {
  id: string;
  type: 'product' | 'person' | 'invoice' | 'voucher' | 'check' | 'transaction';
  conflictType: 'delete_vs_update' | 'update_vs_update' | 'delete_vs_create';
  localData: any;
  remoteData: any;
  localTimestamp: number;
  remoteTimestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface SyncApproval {
  conflicts: SyncConflict[];
  autoApproved: number;
  needsApproval: number;
  status: 'pending' | 'approved' | 'rejected';
}

class SyncApprovalService {
  private pendingConflicts: SyncConflict[] = [];
  private approvalCallback: ((conflicts: SyncConflict[]) => Promise<SyncConflict[]>) | null = null;

  // تحلیل و تشخیص conflicts
  async analyzeSync(localData: any[], remoteData: any[], deletedIds: Set<string>): Promise<SyncApproval> {
    const conflicts: SyncConflict[] = [];
    let autoApproved = 0;

    const localMap = new Map(localData.map(item => [item.id, item]));
    const remoteMap = new Map(remoteData.map(item => [item.id, item]));

    // بررسی هر رکورد
    for (const [id, localItem] of localMap) {
      const remoteItem = remoteMap.get(id);
      const isDeleted = deletedIds.has(id);

      if (isDeleted && localItem) {
        // Conflict: حذف شده ولی در local تغییر کرده
        conflicts.push({
          id,
          type: this.detectType(localItem),
          conflictType: 'delete_vs_update',
          localData: localItem,
          remoteData: null,
          localTimestamp: localItem.lastModified || 0,
          remoteTimestamp: Date.now(),
          severity: this.calculateSeverity(localItem, 'delete_vs_update'),
        });
      } else if (remoteItem && localItem) {
        // بررسی تغییرات
        if (this.hasConflict(localItem, remoteItem)) {
          const conflictType = this.detectConflictType(localItem, remoteItem);
          const severity = this.calculateSeverity(localItem, conflictType);

          if (severity === 'low') {
            // Auto-approve برای conflicts کم اهمیت
            autoApproved++;
          } else {
            conflicts.push({
              id,
              type: this.detectType(localItem),
              conflictType,
              localData: localItem,
              remoteData: remoteItem,
              localTimestamp: localItem.lastModified || 0,
              remoteTimestamp: remoteItem.lastModified || 0,
              severity,
            });
          }
        }
      }
    }

    // بررسی رکوردهای جدید در remote که در local حذف شدهاند
    for (const [id, remoteItem] of remoteMap) {
      if (!localMap.has(id) && deletedIds.has(id)) {
        conflicts.push({
          id,
          type: this.detectType(remoteItem),
          conflictType: 'delete_vs_create',
          localData: null,
          remoteData: remoteItem,
          localTimestamp: 0,
          remoteTimestamp: remoteItem.lastModified || 0,
          severity: 'medium',
        });
      }
    }

    this.pendingConflicts = conflicts;

    return {
      conflicts,
      autoApproved,
      needsApproval: conflicts.length,
      status: conflicts.length > 0 ? 'pending' : 'approved',
    };
  }

  // درخواست تأیید از کاربر
  async requestApproval(conflicts: SyncConflict[]): Promise<SyncConflict[]> {
    if (this.approvalCallback) {
      return await this.approvalCallback(conflicts);
    }
    
    // اگر callback نباشد، auto-reject conflicts بحرانی
    return conflicts.map(c => ({
      ...c,
      resolution: c.severity === 'critical' ? 'reject' : 'approve_local',
    })) as any;
  }

  // ثبت callback برای تأیید
  setApprovalCallback(callback: (conflicts: SyncConflict[]) => Promise<SyncConflict[]>): void {
    this.approvalCallback = callback;
  }

  // بررسی نیاز به تأیید کاربر ارشد
  requiresAdminApproval(conflicts: SyncConflict[]): boolean {
    return conflicts.some(c => c.severity === 'high' || c.severity === 'critical');
  }

  // محاسبه شدت conflict
  private calculateSeverity(item: any, conflictType: string): SyncConflict['severity'] {
    // Conflicts مربوط به فاکتور و پرداخت بحرانی هستند
    if (item.type === 'invoice' || item.type === 'transaction') {
      if (conflictType === 'delete_vs_update') return 'critical';
      return 'high';
    }

    // Conflicts مربوط به محصول و شخص متوسط هستند
    if (item.type === 'product' || item.type === 'person') {
      if (conflictType === 'delete_vs_update') return 'high';
      return 'medium';
    }

    return 'low';
  }

  // تشخیص نوع conflict
  private detectConflictType(local: any, remote: any): SyncConflict['conflictType'] {
    if (!local && remote) return 'delete_vs_create';
    if (local && !remote) return 'delete_vs_update';
    return 'update_vs_update';
  }

  // بررسی وجود conflict
  private hasConflict(local: any, remote: any): boolean {
    const localTime = local.lastModified || 0;
    const remoteTime = remote.lastModified || 0;
    
    // اگر timestamps متفاوت باشند و تفاوت بیش از 1 دقیقه باشد
    return Math.abs(localTime - remoteTime) > 60000;
  }

  // تشخیص نوع رکورد
  private detectType(item: any): SyncConflict['type'] {
    if (item.productName || item.barcode) return 'product';
    if (item.personName || item.nationalId) return 'person';
    if (item.invoiceNumber || item.items) return 'invoice';
    if (item.voucherNumber) return 'voucher';
    if (item.checkNumber) return 'check';
    return 'transaction';
  }

  // دریافت conflicts در انتظار
  getPendingConflicts(): SyncConflict[] {
    return this.pendingConflicts;
  }

  // پاک کردن conflicts
  clearConflicts(): void {
    this.pendingConflicts = [];
  }
}

export const syncApprovalService = new SyncApprovalService();
