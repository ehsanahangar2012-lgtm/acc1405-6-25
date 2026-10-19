import assert from 'node:assert/strict';
import { BackupEncryptionService } from '../services/backupEncryptionService';

const payload = {
  backupFormatVersion: 2,
  companies: [{ id: 'company-1', name: 'اشک قلم' }],
  invoices: [{ id: 'invoice-1', total: 123456 }],
  nested: { unicode: 'مشهد 🌱', enabled: true }
};
const password = 'portable-backup-test-password';

const encrypted = BackupEncryptionService.encryptJson(payload, password);
assert.equal(BackupEncryptionService.isEncryptedEnvelope(JSON.parse(encrypted)), true);
assert.deepEqual(BackupEncryptionService.decryptJson(encrypted, password), payload);
assert.notEqual(encrypted.includes('"invoice-1"'), true, 'encrypted file must not expose plaintext records');
assert.throws(() => BackupEncryptionService.decryptJson(encrypted, 'incorrect-password-here'), /رمز اشتباه است/);

const tampered = JSON.parse(encrypted);
tampered.ciphertext = tampered.ciphertext.slice(0, -4) + 'AAAA';
assert.throws(() => BackupEncryptionService.decryptJson(JSON.stringify(tampered), password), /رمز اشتباه است/);
assert.throws(() => BackupEncryptionService.encryptJson(payload, 'short'), /حداقل ۱۲/);
assert.throws(() => BackupEncryptionService.decryptJson('{bad json', password), /قابل خواندن نیست/);

console.log('Backup encryption checks passed: round-trip, password rejection, tamper detection, and malformed file handling.');
