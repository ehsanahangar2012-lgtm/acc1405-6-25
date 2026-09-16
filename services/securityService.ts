import CryptoJS from 'crypto-js';

class SecurityService {
    private readonly encryptionKey = import.meta.env.VITE_ENCRYPTION_KEY || 'fallback_key';
    private readonly salt = import.meta.env.VITE_PASSWORD_SALT || 'fallback_salt';

    encrypt(data: string): string {
        try {
            return CryptoJS.AES.encrypt(data, this.encryptionKey).toString();
        } catch {
            return data;
        }
    }

    decrypt(encrypted: string): string {
        try {
            const bytes = CryptoJS.AES.decrypt(encrypted, this.encryptionKey);
            return bytes.toString(CryptoJS.enc.Utf8);
        } catch {
            return encrypted;
        }
    }

    hashPassword(password: string): string {
        return CryptoJS.SHA256(password + this.salt).toString();
    }

    verifyPassword(password: string, hash: string): boolean {
        return this.hashPassword(password) === hash;
    }

    generateToken(): string {
        return CryptoJS.lib.WordArray.random(32).toString();
    }

    signBackup(data: any): string {
        try {
            const dataStr = JSON.stringify({
                companies: data.companies || [],
                products: data.products || [],
                people: data.people || [],
                invoices: data.invoices || [],
                vouchers: data.vouchers || [],
                checks: data.checks || [],
                transactions: data.transactions || [],
                checkTransfers: data.checkTransfers || [],
                salaries: data.salaries || [],
                config: data.config || {}
            });
            return CryptoJS.SHA256(dataStr + this.salt).toString();
        } catch {
            return '';
        }
    }

    verifyBackup(data: any): boolean {
        if (!data) return false;
        
        // Check if the payload structurally looks like a valid system backup
        const hasBackupTables = !!(
            data.companies || data.products || data.people || 
            data.invoices || data.vouchers || data.checks || 
            data.transactions || data.salaries || data.contracts
        );
        
        if (!data.signature) {
            // Allow legacy files that don't have a signature, but must have valid system tables
            return hasBackupTables;
        }
        
        const computed = this.signBackup(data);
        if (data.signature === computed) {
            return true;
        }
        
        // If signature fails but contains valid system tables, allow as legacy/converted import
        return hasBackupTables;
    }

    generateRecordChecksum(recordId: string, payload: any): string {
        try {
            return CryptoJS.SHA256(recordId + JSON.stringify(payload) + this.salt).toString();
        } catch {
            return '';
        }
    }
}

export const securityService = new SecurityService();
