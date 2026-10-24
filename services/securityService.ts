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

    // Legacy SHA-256 remains available for historical checksums and old password records.
    hashPassword(password: string): string {
        return CryptoJS.SHA256(password + this.salt).toString();
    }

    hashPasswordV2(password: string): string {
        const iterations = 210000;
        const salt = CryptoJS.lib.WordArray.random(16).toString(CryptoJS.enc.Hex);
        const derived = CryptoJS.PBKDF2(password, salt, {
            keySize: 256 / 32,
            iterations,
            hasher: CryptoJS.algo.SHA256
        }).toString(CryptoJS.enc.Hex);
        return `pbkdf2-sha256$${iterations}$${salt}$${derived}`;
    }

    isPasswordHashV2(hash: string | undefined): boolean {
        return typeof hash === 'string' && hash.startsWith('pbkdf2-sha256$');
    }

    verifyPassword(password: string, hash: string): boolean {
        if (!hash) return false;
        if (this.isPasswordHashV2(hash)) {
            const parts = hash.split('$');
            if (parts.length !== 4) return false;
            const iterations = Number(parts[1]);
            const salt = parts[2];
            const expected = parts[3];
            if (!Number.isInteger(iterations) || iterations < 10000 || iterations > 1000000 ||
                !/^[a-f0-9]{32}$/i.test(salt) || !/^[a-f0-9]{64}$/i.test(expected)) return false;
            const actual = CryptoJS.PBKDF2(password, salt, {
                keySize: 256 / 32,
                iterations,
                hasher: CryptoJS.algo.SHA256
            }).toString(CryptoJS.enc.Hex);
            if (actual.length !== expected.length) return false;
            let diff = 0;
            for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
            return diff === 0;
        }
        // Legacy verification lets existing non-default accounts migrate after login.
        return this.hashPassword(password) === hash;
    }

    generateToken(): string {
        return CryptoJS.lib.WordArray.random(32).toString();
    }

    private stableBackupSerialize(value: any): string {
        if (value === null || value === undefined || typeof value === 'function') return 'null';
        if (value instanceof Date) return JSON.stringify(value.toISOString());
        if (typeof value !== 'object') {
            const encoded = JSON.stringify(value);
            return encoded === undefined ? 'null' : encoded;
        }
        if (Array.isArray(value)) {
            return '[' + value.map(item => this.stableBackupSerialize(item)).join(',') + ']';
        }
        const keys = Object.keys(value)
            .filter(key => value[key] !== undefined && typeof value[key] !== 'function')
            .sort();
        return '{' + keys.map(key =>
            JSON.stringify(key) + ':' + this.stableBackupSerialize(value[key])
        ).join(',') + '}';
    }

    // Version 2 is an integrity digest across the complete backup payload, excluding
    // only the digest field itself. It detects file corruption but is not a server-issued
    // digital signature and cannot authenticate a hostile client.
    signBackup(data: any): string {
        try {
            const payload = { ...data };
            delete payload.signature;
            const canonicalPayload = this.stableBackupSerialize(payload);
            return 'v2-sha256:' + CryptoJS.SHA256('AshkeGhalamBackupV2:' + canonicalPayload).toString();
        } catch {
            return '';
        }
    }

    verifyBackup(data: any): boolean {
        if (!data || Number(data.backupFormatVersion) !== 2 ||
            typeof data.signature !== 'string' || !data.signature.startsWith('v2-sha256:')) {
            return false;
        }

        const expected = this.signBackup(data);
        if (!expected || expected.length !== data.signature.length) return false;
        let diff = 0;
        for (let i = 0; i < expected.length; i++) {
            diff |= expected.charCodeAt(i) ^ data.signature.charCodeAt(i);
        }
        return diff === 0;
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
