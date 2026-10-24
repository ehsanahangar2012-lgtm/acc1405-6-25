// Sandboxed Electron preload. Keep this file self-contained; sandboxed preloads
// cannot reliably require application files from the package.
const { contextBridge, ipcRenderer } = require('electron');
const versionArg = process.argv.find((arg) => arg.startsWith('--ashk-app-version='));
const appVersion = versionArg ? versionArg.slice('--ashk-app-version='.length) : '0.0.0';

// Keep renderer-to-main communication limited to handlers that actually exist
// in electron/main.cjs. Never expose arbitrary IPC channel names to the page.
const ALLOWED_INVOKE_CHANNELS = new Set([
    'get-app-version',
    'open-external-url',
    'get-hardware-id',
    'secure-store-set',
    'secure-store-get',
    'secure-store-remove',
    'get-app-config',
    'save-app-config',
    'export-app-config',
    'select-directory',
    'get-user-data-path',
    'open-user-data-folder',
    'open-directory-path',
    'sql-db-save',
    'sql-db-load',
    'sql-db-export',
    'sql-db-info',
    'open-database-folder',
    'get-local-backup-directory',
    'write-local-backup',
    'decrypt-local-backup',
    'secure-backup-store-get',
    'secure-backup-store-set',
    'secure-backup-store-remove'
]);
const ALLOWED_SEND_CHANNELS = new Set(['backup-completed-exit']);
const ALLOWED_RECEIVE_CHANNELS = new Set(['trigger-backup-and-exit']);

function assertAllowedChannel(channel, allowlist, operation) {
    if (typeof channel !== 'string' || !allowlist.has(channel)) {
        throw new Error(`Blocked Electron IPC ${operation} channel: ${String(channel)}`);
    }
}

contextBridge.exposeInMainWorld('electronDesktopAPI', {
    platform: process.platform,
    isDesktop: true,
    getVersion: () => appVersion,
    sendMessage: (channel, data) => {
        assertAllowedChannel(channel, ALLOWED_SEND_CHANNELS, 'send');
        ipcRenderer.send(channel, data);
    },
    invoke: (channel, data) => {
        try {
            assertAllowedChannel(channel, ALLOWED_INVOKE_CHANNELS, 'invoke');
            return ipcRenderer.invoke(channel, data);
        } catch (error) {
            return Promise.reject(error);
        }
    },
    getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
    openUserDataFolder: () => ipcRenderer.invoke('open-user-data-folder'),
    openDirectory: (dirPath) => ipcRenderer.invoke('open-directory-path', dirPath),
    saveSqlDatabase: (state) => ipcRenderer.invoke('sql-db-save', state),
    loadSqlDatabase: () => ipcRenderer.invoke('sql-db-load'),
    exportSqlFile: (defaultName) => ipcRenderer.invoke('sql-db-export', defaultName),
    getSqlDatabaseInfo: () => ipcRenderer.invoke('sql-db-info'),
    getLocalBackupDirectory: () => ipcRenderer.invoke('get-local-backup-directory'),
    writeLocalBackup: (fileName, data) => ipcRenderer.invoke('write-local-backup', { fileName, data }),
    openDatabaseFolder: () => ipcRenderer.invoke('open-database-folder'),
    onMessage: (channel, callback) => {
        assertAllowedChannel(channel, ALLOWED_RECEIVE_CHANNELS, 'receive');
        if (typeof callback !== 'function') {
            throw new TypeError('Electron IPC message callback must be a function.');
        }
        const listener = (event, ...args) => callback(...args);
        ipcRenderer.on(channel, listener);
        return () => ipcRenderer.removeListener(channel, listener);
    }
});
