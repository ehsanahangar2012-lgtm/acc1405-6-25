import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { isManagedBackupFileName } = require('../electron/backupSafety.cjs');
assert.equal(isManagedBackupFileName('AshkeGhalam-ManualBackup-1792752000000.json'), true);
assert.equal(isManagedBackupFileName('AshkeGhalam-Backup-manual-financials_01.json'), true);
assert.equal(isManagedBackupFileName('AshkeGhalam-Backup-auto-2026-10-23.json'), true);
for (const invalid of [
  '../AshkeGhalam-ManualBackup-1792752000000.json',
  'folder/AshkeGhalam-ManualBackup-1792752000000.json',
  'AshkeGhalam-ManualBackup-1792752000000.agbak',
  'AshkeGhalam-ManualBackup-1792752000000.json.tmp',
  'random-file.json'
]) assert.equal(isManagedBackupFileName(invalid), false, 'reject invalid filename');
console.log('Desktop backup filename checks passed.');
