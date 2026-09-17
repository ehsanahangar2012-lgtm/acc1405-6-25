// Electron Preload Script
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronDesktopAPI', {
    platform: process.platform,
    isDesktop: true,
    getVersion: () => {
        try {
            const pkg = require('../package.json');
            return pkg.version || '16.24.0';
        } catch {
            return '16.24.0';
        }
    },
    sendMessage: (channel, data) => ipcRenderer.send(channel, data),
    invoke: (channel, data) => ipcRenderer.invoke(channel, data),
    getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
    openUserDataFolder: () => ipcRenderer.invoke('open-user-data-folder'),
    openDirectory: (dirPath) => ipcRenderer.invoke('open-directory-path', dirPath),
    saveSqlDatabase: (state) => ipcRenderer.invoke('sql-db-save', state),
    loadSqlDatabase: () => ipcRenderer.invoke('sql-db-load'),
    exportSqlFile: (defaultName) => ipcRenderer.invoke('sql-db-export', defaultName),
    getSqlDatabaseInfo: () => ipcRenderer.invoke('sql-db-info'),
    openDatabaseFolder: () => ipcRenderer.invoke('open-database-folder'),
    onMessage: (channel, callback) => {
        const listener = (event, ...args) => callback(...args);
        ipcRenderer.on(channel, listener);
        return () => ipcRenderer.removeListener(channel, listener);
    }
});
