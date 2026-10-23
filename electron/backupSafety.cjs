'use strict';
const MANAGED_BACKUP_FILE_NAME = /^(?:AshkeGhalam-Backup-(?:auto|manual)|AshkeGhalam-ManualBackup)-[A-Za-z0-9_.-]{1,180}\.json$/;
function isManagedBackupFileName(fileName) {
  return typeof fileName === 'string' && fileName.length <= 220 &&
    !fileName.includes('/') && !fileName.includes('\\') && MANAGED_BACKUP_FILE_NAME.test(fileName);
}
module.exports = { isManagedBackupFileName };
