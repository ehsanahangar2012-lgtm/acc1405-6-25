import CryptoJS from 'crypto-js';
import { generateId, generateUUID } from '../utils';
import { AppUser } from '../types';
import { securityService } from './securityService';

const SECRET_KEY = 'ashke-ghalam-secure-key-2024';

export class AuthService {
  static validateCredentials(username: string, password: string, users: AppUser[]): AppUser | null {
    if (!username || !password) return null;
    const cleanUser = username.trim().toLowerCase();
    const hashedPassword = securityService.hashPassword(password);
    
    // ۱. جستجو در کاربران موجود
    const matched = users?.find(u => {
      const uName = (u.username || '').trim().toLowerCase();
      const isPassMatch = (u.hashedPassword && u.hashedPassword === hashedPassword) || 
                          (u.password && u.password === password);
      return uName === cleanUser && isPassMatch;
    });

    if (matched) return matched;

    // ۲. در صورتی که پایگاه داده کاربران کاملاً خالی باشد، اجازه ورود اولیه به مدیر سیستم داده می‌شود
    if ((!users || users.length === 0) && cleanUser === 'admin' && (password === '123' || hashedPassword === securityService.hashPassword('123'))) {
      return {
        id: 'admin-1',
        username: 'admin',
        hashedPassword: securityService.hashPassword('123'),
        fullName: 'مدیر کل سیستم',
        roleId: 'admin',
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
        is_active: true,
        email: 'admin@ashkghalam.ir',
        recoveryKey: 'ASHK-REC-9988-7711'
      };
    }

    return null;
  }

  static createUser(userData: Omit<AppUser, 'id' | 'hashedPassword'> & { password: string }): AppUser {
    return {
      ...userData,
      id: generateUUID(),
      hashedPassword: securityService.hashPassword(userData.password)
    };
  }

  static encryptSensitiveData(data: any): string {
    return CryptoJS.AES.encrypt(JSON.stringify(data), SECRET_KEY).toString();
  }

  static decryptSensitiveData(encryptedData: string): any {
    const bytes = CryptoJS.AES.decrypt(encryptedData, SECRET_KEY);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  }
}