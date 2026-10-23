import { generateId, generateUUID } from '../utils';
import { AppUser } from '../types';
import { securityService } from './securityService';

export class AuthService {
  static validateCredentials(username: string, password: string, users: AppUser[]): AppUser | null {
    if (!username || !password) return null;
    const cleanUser = username.trim().toLowerCase();

    // Only explicitly stored, enabled accounts may authenticate.
    const matched = (users || []).find(u => {
      const uName = (u.username || '').trim().toLowerCase();
      const isPassMatch = u.hashedPassword
        ? securityService.verifyPassword(password, u.hashedPassword)
        : (typeof u.password === 'string' && u.password === password);
      return uName === cleanUser && u.is_active !== false && isPassMatch;
    });

    return matched || null;
  }

  static createUser(userData: Omit<AppUser, 'id' | 'hashedPassword'> & { password: string }): AppUser {
    return {
      ...userData,
      id: generateUUID(),
      hashedPassword: securityService.hashPasswordV2(userData.password)
    };
  }

}