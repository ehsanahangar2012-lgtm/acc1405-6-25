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


import {
  checksumLocalBackupData,
  verifyLocalBackupRecord
} from '../services/localBackupIntegrity';

const localPayload = JSON.stringify({
  companies: [],
  products: [],
  people: [],
  invoices: [],
  vouchers: [],
  checks: [],
  transactions: [],
  financialData: { entries: [] }
});
const localRecord = {
  id: '1792752000000',
  timestamp: 1792752000000,
  data: localPayload,
  size: localPayload.length,
  label: 'test',
  checksumAlgorithm: 'sha256',
  checksum: checksumLocalBackupData(localPayload)
};
assert.equal(verifyLocalBackupRecord(localRecord).integrityVerified, true);
assert.deepEqual(verifyLocalBackupRecord(localRecord).data, JSON.parse(localPayload));

assert.throws(() => verifyLocalBackupRecord({
  ...localRecord,
  data: localPayload + ' '
}), /یکپارچگی بکاپ محلی ناموفق/);

const legacyRecord = {
  id: '1792752000001',
  timestamp: 1792752000001,
  data: localPayload,
  size: localPayload.length,
  label: 'legacy'
};
assert.equal(verifyLocalBackupRecord(legacyRecord).integrityVerified, false);
assert.throws(() => verifyLocalBackupRecord({
  ...localRecord,
  data: JSON.stringify({ invoices: 'not-an-array' })
}), /ساختار دادهٔ بکاپ/);

console.log('Local backup integrity checks passed: checksum, tamper rejection, legacy warning state, structure validation.');
