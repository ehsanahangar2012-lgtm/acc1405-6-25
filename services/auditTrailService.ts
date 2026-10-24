import { idbService } from './indexedDBService';
import { generateUUID, fetchWithTimeout } from '../utils';

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'PRINT';
  entity: string;
  entityId: string;
  before?: any;
  after?: any;
  ip?: string;
  userAgent?: string;
  location?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  metadata?: any;
}

class AuditTrailService {
  private async getClientInfo() {
    const ip = await this.getIP();
    return {
      ip,
      userAgent: navigator.userAgent,
      location: await this.getLocation()
    };
  }

  private async getIP(): Promise<string> {
    try {
      const res = await fetchWithTimeout('https://api.ipify.org?format=json', {}, 2000);
      const data = await res.json();
      return data.ip;
    } catch {
      return 'unknown';
    }
  }

  private async getLocation(): Promise<string> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve('unknown');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(`${pos.coords.latitude},${pos.coords.longitude}`),
        () => resolve('unknown')
      );
    });
  }

  async log(
    userId: string,
    userName: string,
    action: AuditLog['action'],
    entity: string,
    entityId: string,
    before?: any,
    after?: any,
    severity: AuditLog['severity'] = 'LOW'
  ): Promise<void> {
    const clientInfo = await this.getClientInfo();
    
    const log: AuditLog = {
      id: generateUUID(),
      timestamp: new Date().toISOString(),
      userId,
      userName,
      action,
      entity,
      entityId,
      before,
      after,
      severity,
      ...clientInfo
    };

    await idbService.save('audit_logs', log);
    
    // هشدار برای عملیات مشکوک
    if (severity === 'CRITICAL') {
      this.detectAnomaly(log);
    }
  }

  private detectAnomaly(log: AuditLog): void {
    // الگوریتم تشخیص رفتار مشکوک
    const recentLogs = this.getRecentLogs(log.userId, 5);
    
    recentLogs.then(logs => {
      const deleteCount = logs.filter(l => l.action === 'DELETE').length;
      if (deleteCount > 3) {
        console.warn('⚠️ رفتار مشکوک: حذف متعدد توسط', log.userName);
      }
    });
  }

  async getRecentLogs(userId: string, limit: number = 10): Promise<AuditLog[]> {
    const all = await idbService.getAll('audit_logs');
    return all
      .filter((l: AuditLog) => l.userId === userId)
      .sort((a: AuditLog, b: AuditLog) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async getLogs(filters?: {
    userId?: string;
    action?: string;
    entity?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<AuditLog[]> {
    let logs = await idbService.getAll('audit_logs');
    
    if (filters?.userId) logs = logs.filter((l: AuditLog) => l.userId === filters.userId);
    if (filters?.action) logs = logs.filter((l: AuditLog) => l.action === filters.action);
    if (filters?.entity) logs = logs.filter((l: AuditLog) => l.entity === filters.entity);
    if (filters?.startDate) logs = logs.filter((l: AuditLog) => l.timestamp >= filters.startDate!);
    if (filters?.endDate) logs = logs.filter((l: AuditLog) => l.timestamp <= filters.endDate!);
    
    return logs.sort((a: AuditLog, b: AuditLog) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async exportReport(startDate: string, endDate: string): Promise<Blob> {
    const logs = await this.getLogs({ startDate, endDate });
    const csv = this.convertToCSV(logs);
    return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  }

  private convertToCSV(logs: AuditLog[]): string {
    const headers = ['زمان', 'کاربر', 'عملیات', 'موجودیت', 'IP', 'شدت'];
    const rows = logs.map(l => [
      new Date(l.timestamp).toLocaleString('fa-IR'),
      l.userName,
      l.action,
      l.entity,
      l.ip || '-',
      l.severity
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}

export const auditTrail = new AuditTrailService();
