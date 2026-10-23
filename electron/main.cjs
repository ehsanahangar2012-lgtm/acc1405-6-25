// Electron Main Process for Windows Standalone Executable
const { app, BrowserWindow, shell, Menu, dialog, ipcMain, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const url = require('url');
const packageMeta = require('../package.json');
const { isManagedBackupFileName } = require('./backupSafety.cjs');

// Keep Chromium's platform defaults for GPU selection, process limits, and memory management.
// Forcing unsupported GPU paths or extra renderer processes can increase crashes, RAM use, and stutter.
// Performance changes should be based on measurements on representative Windows hardware.

let mainWindow = null;
let splashWindow = null;
let isQuitting = false;

// محاسبه شناسه سخت‌افزاری پایدار و یکتا بر اساس معماری دستگاه
function computeDesktopHardwareId() {
    try {
        const cpus = os.cpus() || [];
        const cpuModel = cpus[0]?.model || 'UNKNOWN_CPU';
        const hostname = os.hostname() || 'LOCALHOST';
        const platform = os.platform() || 'WIN32';
        const arch = os.arch() || 'X64';
        const totalMem = Math.round(os.totalmem() / (1024 * 1024 * 1024));
        
        const networkInterfaces = os.networkInterfaces();
        let mac = '';
        for (const name of Object.keys(networkInterfaces)) {
            for (const net of networkInterfaces[name] || []) {
                if (net.mac && net.mac !== '00:00:00:00:00:00' && !net.internal) {
                    mac = net.mac;
                    break;
                }
            }
            if (mac) break;
        }

        const rawString = `ASHK-DEVICE:${hostname}|${cpuModel}|${platform}|${arch}|${totalMem}GB|${mac}`;
        const hash = crypto.createHash('sha256').update(rawString).digest('hex').toUpperCase();
        
        return `ASHK-HWID-${hash.substring(0, 4)}-${hash.substring(4, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}`;
    } catch (e) {
        return 'ASHK-HWID-GENERIC-STANDALONE-2026';
    }
}

// مسیر امن ذخیره‌سازی داده‌های کاربر، تنظیمات و دیتابیس در استاندارد ویندوز (%APPDATA%\AshkeGhalam)
function getUserDataDir() {
    try {
        const userData = app.getPath('userData');
        if (!fs.existsSync(userData)) {
            fs.mkdirSync(userData, { recursive: true });
        }
        return userData;
    } catch {
        return path.dirname(process.execPath);
    }
}

// مسیر فایل امن مخزن اعتبارنامه‌ها
function getSecureVaultPath() {
    const userData = getUserDataDir();
    return path.join(userData, '.secure_vault.dat');
}

const DESKTOP_ENCRYPTED_FORMAT = 'ASHKEGHALAM_DESKTOP_BACKUP_V1';
const PORTABLE_ENCRYPTED_FORMAT = 'ASHKEGHALAM_ENCRYPTED_BACKUP_V1';

async function encryptDesktopText(plainText) {
    if (typeof plainText !== 'string') throw new Error('INVALID_LOCAL_DATA');
    const available = await safeStorage.isAsyncEncryptionAvailable();
    if (!available) throw new Error('OS_ENCRYPTION_UNAVAILABLE');
    const encrypted = await safeStorage.encryptStringAsync(plainText);
    return JSON.stringify({
        format: DESKTOP_ENCRYPTED_FORMAT,
        version: 1,
        encryption: 'electron-safeStorage',
        data: encrypted.toString('base64')
    }, null, 2);
}

async function decryptDesktopEnvelope(envelope) {
    if (!envelope || envelope.format !== DESKTOP_ENCRYPTED_FORMAT ||
        envelope.version !== 1 || envelope.encryption !== 'electron-safeStorage' ||
        typeof envelope.data !== 'string' || envelope.data.length < 16 ||
        envelope.data.length > 200 * 1024 * 1024 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(envelope.data)) {
        throw new Error('INVALID_DESKTOP_ENCRYPTED_FILE');
    }
    const available = await safeStorage.isAsyncEncryptionAvailable();
    if (!available) throw new Error('OS_ENCRYPTION_UNAVAILABLE');
    const result = await safeStorage.decryptStringAsync(Buffer.from(envelope.data, 'base64'));
    const plainText = typeof result === 'string' ? result : result?.result;
    if (typeof plainText !== 'string') throw new Error('DESKTOP_DECRYPT_FAILED');
    return plainText;
}

function parseJsonSafely(text) {
    try { return JSON.parse(text); } catch { return null; }
}

async function writeTextAtomically(filePath, text) {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    const tempPath = path.join(path.dirname(filePath), '.' + path.basename(filePath) + '.' + crypto.randomBytes(8).toString('hex') + '.tmp');
    try {
        await fs.promises.writeFile(tempPath, text, { encoding: 'utf-8', flag: 'wx', mode: 0o600 });
        await fs.promises.rename(tempPath, filePath);
    } catch (error) {
        await fs.promises.unlink(tempPath).catch(() => {});
        throw error;
    }
}

async function readProtectedTextFile(filePath) {
    const raw = await fs.promises.readFile(filePath, 'utf-8');
    const parsed = parseJsonSafely(raw);
    if (parsed?.format === DESKTOP_ENCRYPTED_FORMAT) {
        return await decryptDesktopEnvelope(parsed);
    }
    // The passphrase-based portable envelope is deliberately not unwrapped here.
    // Only the restore flow for a selected portable backup asks the user for its password.
    if (parsed?.format === PORTABLE_ENCRYPTED_FORMAT) {
        return raw;
    }
    // Existing releases stored ordinary JSON (or legacy CryptoJS text). Keep old data
    // readable, then opportunistically migrate JSON state into OS-protected storage.
    if (parsed && typeof parsed === 'object') {
        try {
            const migrated = await encryptDesktopText(raw);
            await writeTextAtomically(filePath, migrated);
        } catch (error) {
            console.warn('Legacy local data remains readable but OS encryption migration was unavailable:', error?.message || error);
        }
    }
    return raw;
}

async function readProtectedJsonFile(filePath, fallbackValue = {}) {
    if (!fs.existsSync(filePath)) return fallbackValue;
    const raw = await fs.promises.readFile(filePath, 'utf-8');
    const parsed = parseJsonSafely(raw);
    if (parsed?.format === DESKTOP_ENCRYPTED_FORMAT) {
        const plaintext = await decryptDesktopEnvelope(parsed);
        return JSON.parse(plaintext);
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        try {
            const migrated = await encryptDesktopText(raw);
            await writeTextAtomically(filePath, migrated);
        } catch (error) {
            console.warn('Legacy secure-store values could not be migrated to OS encryption:', error?.message || error);
        }
        return parsed;
    }
    throw new Error('SECURE_STORE_FORMAT_INVALID');
}


function getBackupDirectorySettingsPath() {
    return path.join(getUserDataDir(), '.backup-directory.json');
}

function readSelectedBackupDirectory() {
    try {
        const settingsPath = getBackupDirectorySettingsPath();
        if (!fs.existsSync(settingsPath)) return null;
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        const requested = typeof settings.directory === 'string' ? path.resolve(settings.directory) : '';
        if (!requested || !fs.existsSync(requested) || !fs.statSync(requested).isDirectory()) return null;
        return fs.realpathSync(requested);
    } catch {
        return null;
    }
}

function persistSelectedBackupDirectory(directory) {
    const canonical = fs.realpathSync(directory);
    if (!fs.statSync(canonical).isDirectory()) {
        throw new Error('مسیر انتخاب‌شده پوشه معتبر نیست.');
    }
    const settingsPath = getBackupDirectorySettingsPath();
    const tempPath = settingsPath + '.tmp.' + crypto.randomBytes(8).toString('hex');
    try {
        fs.writeFileSync(
            tempPath,
            JSON.stringify({ directory: canonical, updatedAt: new Date().toISOString() }),
            { encoding: 'utf-8', mode: 0o600 }
        );
        fs.renameSync(tempPath, settingsPath);
    } catch (error) {
        try { fs.unlinkSync(tempPath); } catch {}
        throw error;
    }
    return canonical;
}

function getAppIcon() {
    const candidates = [
        path.join(__dirname, '../public/favicon.ico'),
        path.join(__dirname, '../dist/favicon.ico'),
        path.join(__dirname, 'favicon.ico'),
        path.join(app.getAppPath(), 'public/favicon.ico'),
        path.join(app.getAppPath(), 'dist/favicon.ico'),
        path.join(app.getAppPath(), 'favicon.ico'),
        path.join(process.resourcesPath, 'public/favicon.ico'),
        path.join(process.resourcesPath, 'favicon.ico')
    ];
    for (const c of candidates) {
        try {
            if (fs.existsSync(c)) return c;
        } catch (e) {}
    }
    return undefined;
}

function resolveIndexPath() {
    const candidates = [
        path.join(app.getAppPath(), 'dist/index.html'),
        path.join(app.getAppPath(), 'index.html'),
        path.join(app.getAppPath(), 'dist-build/index.html'),
        path.join(__dirname, '../dist/index.html'),
        path.join(__dirname, '../dist-build/index.html'),
        path.join(__dirname, 'dist/index.html'),
        path.join(__dirname, 'index.html'),
        path.join(process.resourcesPath, 'app/dist/index.html'),
        path.join(process.resourcesPath, 'app.asar/dist/index.html'),
        path.join(process.resourcesPath, 'dist/index.html'),
        path.join(process.cwd(), 'dist/index.html'),
        path.join(process.cwd(), 'index.html')
    ];

    for (const p of candidates) {
        try {
            if (fs.existsSync(p)) {
                return p;
            }
        } catch (e) {}
    }
    return null;
}

function getPreloadPath() {
    const preloadCandidates = [
        path.join(__dirname, 'preload.cjs'),
        path.join(app.getAppPath(), 'electron/preload.cjs'),
        path.join(process.resourcesPath, 'app/electron/preload.cjs'),
        path.join(process.resourcesPath, 'electron/preload.cjs')
    ];
    for (const candidate of preloadCandidates) {
        try {
            if (fs.existsSync(candidate)) return candidate;
        } catch (e) {}
    }
    return path.join(__dirname, 'preload.cjs');
}

function getAppConfigPath() {
    const userData = getUserDataDir();
    const userConfigPath = path.join(userData, 'app-config.json');
    if (fs.existsSync(userConfigPath)) {
        return userConfigPath;
    }

    const portableConfigPath = path.join(path.dirname(process.execPath), 'app-config.json');
    if (fs.existsSync(portableConfigPath)) {
        return portableConfigPath;
    }

    const locations = [
        path.join(process.resourcesPath, 'app-config.example.json'),
        path.join(process.resourcesPath, 'app-config.json'),
        path.join(process.cwd(), 'app-config.json'),
        path.join(app.getAppPath(), 'app-config.json'),
        path.join(__dirname, '../app-config.json')
    ];
    for (const loc of locations) {
        try {
            if (fs.existsSync(loc)) {
                return loc;
            }
        } catch (e) {}
    }
    return userConfigPath;
}

function loadDesktopConfig() {
    try {
        const configPath = getAppConfigPath();
        if (fs.existsSync(configPath)) {
            const raw = fs.readFileSync(configPath, 'utf-8');
            return JSON.parse(raw);
        }
    } catch (e) {
        console.warn('Error reading app-config.json:', e);
    }
    return null;
}

function createSplash() {
    try {
        splashWindow = new BrowserWindow({
            width: 450,
            height: 350,
            transparent: true,
            frame: false,
            alwaysOnTop: true,
            resizable: false,
            icon: getAppIcon(),
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
            }
        });

        const splashCandidates = [
            path.join(__dirname, 'splash.html'),
            path.join(app.getAppPath(), 'electron/splash.html'),
            path.join(process.resourcesPath, 'app/electron/splash.html')
        ];
        let foundSplash = null;
        for (const s of splashCandidates) {
            if (fs.existsSync(s)) {
                foundSplash = s;
                break;
            }
        }
        if (foundSplash) {
            splashWindow.loadFile(foundSplash).catch(() => {});
        }
        splashWindow.center();
    } catch (e) {
        console.warn('Splash creation skipped:', e);
    }
}

function createWindow() {
    const desktopConfig = loadDesktopConfig();
    const appTitle = desktopConfig?.app_title || 'سامانه یکپارچه مالی و انبارداری اشک قلم';
    const appIcon = getAppIcon();

    mainWindow = new BrowserWindow({
        width: 1366,
        height: 850,
        minWidth: 1024,
        minHeight: 700,
        title: appTitle,
        icon: appIcon,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: getPreloadPath(),
            sandbox: true,
            devTools: !app.isPackaged,
            webSecurity: true,
            allowRunningInsecureContent: false,
            partition: 'persist:ashke-ghalam-isolated-secure',
            // Keep the displayed version synchronous while the preload remains sandboxed.
            additionalArguments: [`--ashk-app-version=${app.getVersion()}`]
        },
        backgroundColor: '#111827',
        show: false
    });

    let hasShownMain = false;
    const showMainWindow = () => {
        if (hasShownMain) return;
        hasShownMain = true;
        if (splashWindow && !splashWindow.isDestroyed()) {
            try {
                splashWindow.destroy();
            } catch (e) {}
            splashWindow = null;
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show();
            mainWindow.focus();
        }
    };

    const indexPath = resolveIndexPath();

    if (indexPath) {
        const fileUrl = url.pathToFileURL(indexPath).href;
        console.log('بارگذاری مسیر محلی فایل اجرایی:', fileUrl);
        mainWindow.loadURL(fileUrl).catch(err => {
            console.error('خطا در بارگذاری URL، تلاش با loadFile:', err);
            mainWindow.loadFile(indexPath).catch(e => {
                console.error('خطای نهایی در بارگذاری محلی:', e);
                showMainWindow();
            });
        });
    } else {
        console.log('در حال اتصال به سرور محلی توسعه یا هاست...');
        mainWindow.loadURL('http://localhost:3000').catch(() => {
            mainWindow.loadURL('https://acc.ashkghalam.ir').catch(() => {
                showMainWindow();
            });
        });
    }

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        console.error('عدم موفقیت در لود صفحه:', errorCode, errorDescription, validatedURL);
        if (errorCode === -3) return; // عملیات لغو شده یا ریدایرکت
        
        const retryPath = resolveIndexPath();
        if (retryPath && validatedURL !== url.pathToFileURL(retryPath).href) {
            mainWindow.loadURL(url.pathToFileURL(retryPath).href);
        } else {
            const htmlError = `
            <!DOCTYPE html>
            <html lang="fa" dir="rtl">
            <head><meta charset="UTF-8"><title>بازیابی سامانه اشک قلم</title>
            <style>
                body { background: #0f172a; color: #f8fafc; font-family: Tahoma, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; text-align: center; }
                .card { background: #1e293b; padding: 30px; border-radius: 16px; border: 1px solid #334155; max-width: 500px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
                h2 { color: #2dd4bf; margin-top: 0; }
                p { color: #94a3b8; font-size: 14px; line-height: 1.8; }
                button { background: #0d9488; color: white; border: none; padding: 12px 24px; border-radius: 10px; font-weight: bold; cursor: pointer; margin-top: 15px; }
                button:hover { background: #14b8a6; }
            </style>
            </head>
            <body>
                <div class="card">
                    <h2>سامانه یکپارچه مالی و انبارداری اشک قلم</h2>
                    <p>در بارگذاری اولیه فایل‌های برنامه وقفه‌ای رخ داده است یا بسته نرم‌افزاری نیاز به بارگذاری مجدد دارد.</p>
                    <p style="font-size:12px;color:#64748b;">کد خطا: ${errorCode} (${errorDescription})</p>
                    <button onclick="location.reload()">تلاش مجدد جهت اتصال و اجرا</button>
                </div>
            </body>
            </html>
            `;
            mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlError));
            showMainWindow();
        }
    });

    mainWindow.once('ready-to-show', () => {
        setTimeout(showMainWindow, 1200);
    });

    mainWindow.webContents.on('did-finish-load', () => {
        setTimeout(showMainWindow, 600);
    });

    // سوییچ اطمینان: اگر تا ۳.۵ ثانیه به هر دلیلی پنجره نشان داده نشد، فوراً اسپلاش بسته شده و پنجره اصلی باز شود
    setTimeout(showMainWindow, 3500);

    mainWindow.on('close', async (e) => {
        if (isQuitting) return;
        e.preventDefault();

        const choice = dialog.showMessageBoxSync(mainWindow, {
            type: 'question',
            buttons: ['بله، خروج و تهیه بک‌آپ', 'خروج مستقیم', 'انصراف'],
            title: 'خروج از سامانه اشک قلم',
            message: 'آیا مایل به خروج از برنامه هستید؟\nتوصیه می‌شود قبل از خروج، یک نسخه پشتیبان از داده‌های خود تهیه کنید.',
            defaultId: 0,
            cancelId: 2
        });

        if (choice === 2) {
            // انصراف
            return;
        }

        if (choice === 0) {
            // تهیه بک‌آپ
            mainWindow.webContents.send('trigger-backup-and-exit');
        } else if (choice === 1) {
            // خروج مستقیم
            isQuitting = true;
            app.quit();
        }
    });

    // باز کردن لینک‌های خارجی در مرورگر سیستم
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https:') || url.startsWith('http:')) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });

    Menu.setApplicationMenu(null);
}

// IPC Handlers
ipcMain.handle('get-app-version', async () => {
    return app.getVersion() || packageMeta.version || '0.0.0';
});

ipcMain.handle('open-external-url', async (event, url) => {
    try {
        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
            await shell.openExternal(url);
            return { success: true };
        }
        return { success: false, error: 'Invalid URL' };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('get-hardware-id', async () => {
    return {
        hwid: computeDesktopHardwareId(),
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        isDesktop: true
    };
});

ipcMain.handle('secure-store-set', async (event, { key, value }) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) {
        return { success: false, error: 'UNAUTHORIZED_RENDERER' };
    }
    if (typeof key !== 'string' || !/^[A-Za-z0-9_.:-]{1,180}$/.test(key)) {
        return { success: false, error: 'INVALID_SECURE_STORE_KEY' };
    }
    try {
        const vaultPath = getSecureVaultPath();
        const data = await readProtectedJsonFile(vaultPath, {});
        data[key] = value;
        await writeTextAtomically(vaultPath, await encryptDesktopText(JSON.stringify(data)));
        return { success: true, encryptedAtRest: true };
    } catch (e) {
        return { success: false, error: e.message || 'SECURE_STORE_WRITE_FAILED' };
    }
});

ipcMain.handle('secure-store-get', async (event, key) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) return null;
    if (typeof key !== 'string' || !/^[A-Za-z0-9_.:-]{1,180}$/.test(key)) return null;
    try {
        const data = await readProtectedJsonFile(getSecureVaultPath(), {});
        return data[key] !== undefined ? data[key] : null;
    } catch {
        return null;
    }
});

ipcMain.handle('secure-store-remove', async (event, key) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) {
        return { success: false, error: 'UNAUTHORIZED_RENDERER' };
    }
    if (typeof key !== 'string' || !/^[A-Za-z0-9_.:-]{1,180}$/.test(key)) {
        return { success: false, error: 'INVALID_SECURE_STORE_KEY' };
    }
    try {
        const vaultPath = getSecureVaultPath();
        const data = await readProtectedJsonFile(vaultPath, {});
        delete data[key];
        await writeTextAtomically(vaultPath, await encryptDesktopText(JSON.stringify(data)));
        return { success: true, encryptedAtRest: true };
    } catch (e) {
        return { success: false, error: e.message || 'SECURE_STORE_WRITE_FAILED' };
    }
});

ipcMain.handle('get-app-config', async () => {
    return loadDesktopConfig();
});

ipcMain.handle('save-app-config', async (event, config) => {
    try {
        const configPath = getAppConfigPath();
        const safeConfig = config && typeof config === 'object' ? {
            ...config,
            workspace_token: '',
            workspaceToken: '',
            license_key: '',
            licenseKey: ''
        } : {};
        fs.writeFileSync(configPath, JSON.stringify(safeConfig, null, 2), 'utf-8');
        if (mainWindow && config.app_title) {
            mainWindow.setTitle(config.app_title);
        }
        return { success: true, path: configPath };
    } catch (error) {
        console.error('Error saving app-config.json:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('export-app-config', async (event, config) => {
    try {
        const result = await dialog.showSaveDialog(mainWindow, {
            title: 'ذخیره فایل پیکربندی پرتابل (app-config.json)',
            defaultPath: 'app-config.json',
            filters: [{ name: 'JSON Config', extensions: ['json'] }]
        });
        if (result.canceled || !result.filePath) {
            return { canceled: true };
        }
        const safeConfig = config && typeof config === 'object' ? {
            ...config,
            workspace_token: '',
            workspaceToken: '',
            license_key: '',
            licenseKey: ''
        } : {};
        fs.writeFileSync(result.filePath, JSON.stringify(safeConfig, null, 2), 'utf-8');
        return { success: true, filePath: result.filePath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('select-directory', async (event) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'انتخاب پوشه ذخیره بک‌آپ'
    });
    if (result.canceled || !result.filePaths[0]) return null;
    try {
        return persistSelectedBackupDirectory(result.filePaths[0]);
    } catch (error) {
        console.error('Unable to save selected backup directory:', error);
        return null;
    }
});

ipcMain.handle('get-local-backup-directory', async (event) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) return null;
    return readSelectedBackupDirectory();
});

ipcMain.handle('write-local-backup', async (event, payload) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) {
        return { success: false, error: 'UNAUTHORIZED_RENDERER' };
    }

    const fileName = typeof payload?.fileName === 'string' ? payload.fileName : '';
    const data = typeof payload?.data === 'string' ? payload.data : null;
    if (!isManagedBackupFileName(fileName)) {
        return { success: false, error: 'INVALID_BACKUP_FILENAME' };
    }
    if (data === null) return { success: false, error: 'INVALID_BACKUP_DATA' };
    const originalSize = Buffer.byteLength(data, 'utf-8');
    if (originalSize > 100 * 1024 * 1024) return { success: false, error: 'BACKUP_TOO_LARGE' };

    const directory = readSelectedBackupDirectory();
    if (!directory) return { success: false, error: 'BACKUP_DIRECTORY_NOT_SELECTED' };
    const targetPath = path.join(directory, fileName);
    if (path.dirname(targetPath) !== directory) return { success: false, error: 'INVALID_BACKUP_PATH' };

    let tempPath = '';
    try {
        const directoryStat = await fs.promises.stat(directory);
        if (!directoryStat.isDirectory()) return { success: false, error: 'BACKUP_DIRECTORY_UNAVAILABLE' };

        // Portable password-encrypted files already have cross-device encryption.
        // All other local copies use OS-backed encryption and are bound to this
        // Windows/macOS user profile. Do not fall back to plaintext on failure.
        const parsed = parseJsonSafely(data);
        const fileContents = parsed?.format === PORTABLE_ENCRYPTED_FORMAT
            ? data
            : await encryptDesktopText(data);
        const sizeBytes = Buffer.byteLength(fileContents, 'utf-8');
        if (sizeBytes > 140 * 1024 * 1024) return { success: false, error: 'BACKUP_TOO_LARGE' };

        tempPath = path.join(directory, '.' + fileName + '.' + crypto.randomBytes(8).toString('hex') + '.tmp');
        await fs.promises.writeFile(tempPath, fileContents, { encoding: 'utf-8', flag: 'wx', mode: 0o600 });
        await fs.promises.rename(tempPath, targetPath);
        tempPath = '';

        // Retain up to 100 managed backup files and prune files older than 30 days.
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const entries = [];
        for (const name of await fs.promises.readdir(directory)) {
            if (!isManagedBackupFileName(name)) continue;
            const fullPath = path.join(directory, name);
            try {
                const stat = await fs.promises.stat(fullPath);
                if (!stat.isFile()) continue;
                if (stat.mtimeMs < cutoff && fullPath !== targetPath) await fs.promises.unlink(fullPath).catch(() => {});
                else entries.push({ fullPath, mtimeMs: stat.mtimeMs });
            } catch {}
        }
        entries.sort((a, b) => b.mtimeMs - a.mtimeMs);
        for (const old of entries.slice(100)) {
            if (old.fullPath !== targetPath) await fs.promises.unlink(old.fullPath).catch(() => {});
        }
        return {
            success: true,
            filePath: targetPath,
            sizeBytes,
            encryptedAtRest: parsed?.format !== PORTABLE_ENCRYPTED_FORMAT,
            sha256: crypto.createHash('sha256').update(fileContents, 'utf-8').digest('hex')
        };
    } catch (error) {
        if (tempPath) await fs.promises.unlink(tempPath).catch(() => {});
        console.error('Local backup write failed:', error);
        return { success: false, error: error?.message || 'BACKUP_WRITE_FAILED' };
    }
});

// OS-encrypted internal backup store used by automatic/offline backups.
// Values are indexed by a hashed key; renderer never receives a filesystem path.
function nativeBackupStorePath(key) {
    if (typeof key !== 'string' || !/^[A-Za-z0-9_.:-]{1,180}$/.test(key)) {
        throw new Error('INVALID_NATIVE_BACKUP_KEY');
    }
    const fileName = crypto.createHash('sha256').update(key, 'utf8').digest('hex') + '.json';
    return path.join(getUserDataDir(), 'native-backups', fileName);
}

ipcMain.handle('secure-backup-store-get', async (event, payload) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) {
        return { success: false, error: 'UNAUTHORIZED_RENDERER' };
    }
    try {
        const key = payload?.key;
        const filePath = nativeBackupStorePath(key);
        if (!fs.existsSync(filePath)) return { success: true, value: null, encryptedAtRest: true };

        const raw = await fs.promises.readFile(filePath, 'utf-8');
        const envelope = parseJsonSafely(raw);
        const expectedKeyHash = crypto.createHash('sha256').update(key, 'utf8').digest('hex');
        if (envelope?.format !== DESKTOP_ENCRYPTED_FORMAT ||
            envelope?.purpose !== 'ASHKEGHALAM_NATIVE_BACKUP_STORE_V1' ||
            envelope?.keyHash !== expectedKeyHash) {
            return { success: false, error: 'NATIVE_BACKUP_ENVELOPE_INVALID' };
        }

        const plaintext = await decryptDesktopEnvelope(envelope);
        let parsed;
        try { parsed = JSON.parse(plaintext); } catch {}
        if (!parsed || parsed.key !== key || typeof parsed.value !== 'string') {
            return { success: false, error: 'NATIVE_BACKUP_VALUE_INVALID' };
        }
        return { success: true, value: parsed.value, encryptedAtRest: true };
    } catch (error) {
        console.error('Native encrypted backup read failed:', error);
        return { success: false, error: error?.message || 'NATIVE_BACKUP_READ_FAILED' };
    }
});

ipcMain.handle('secure-backup-store-set', async (event, payload) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) {
        return { success: false, error: 'UNAUTHORIZED_RENDERER' };
    }
    const key = payload?.key;
    const value = payload?.value;
    if (typeof value !== 'string' || Buffer.byteLength(value, 'utf-8') > 80 * 1024 * 1024) {
        return { success: false, error: 'INVALID_NATIVE_BACKUP_VALUE' };
    }
    let filePath = '';
    try {
        filePath = nativeBackupStorePath(key);
        const keyHash = crypto.createHash('sha256').update(key, 'utf8').digest('hex');
        const serialized = JSON.stringify({ key, value });
        const baseEnvelope = JSON.parse(await encryptDesktopText(serialized));
        const envelope = {
            ...baseEnvelope,
            purpose: 'ASHKEGHALAM_NATIVE_BACKUP_STORE_V1',
            keyHash
        };
        await writeTextAtomically(filePath, JSON.stringify(envelope, null, 2));
        return { success: true, encryptedAtRest: true, sizeBytes: Buffer.byteLength(JSON.stringify(envelope), 'utf-8') };
    } catch (error) {
        console.error('Native encrypted backup write failed:', error);
        return { success: false, error: error?.message || 'NATIVE_BACKUP_WRITE_FAILED' };
    }
});

ipcMain.handle('secure-backup-store-remove', async (event, payload) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) {
        return { success: false, error: 'UNAUTHORIZED_RENDERER' };
    }
    try {
        const filePath = nativeBackupStorePath(payload?.key);
        await fs.promises.unlink(filePath).catch(error => {
            if (error?.code !== 'ENOENT') throw error;
        });
        return { success: true };
    } catch (error) {
        console.error('Native encrypted backup delete failed:', error);
        return { success: false, error: error?.message || 'NATIVE_BACKUP_DELETE_FAILED' };
    }
});

ipcMain.handle('get-user-data-path', async () => {
    return {
        userDataDir: getUserDataDir(),
        appDataDir: app.getPath('appData'),
        documentsDir: app.getPath('documents'),
        isPackaged: app.isPackaged,
        appVersion: app.getVersion()
    };
});

ipcMain.handle('open-user-data-folder', async () => {
    try {
        const dir = getUserDataDir();
        await shell.openPath(dir);
        return { success: true, path: dir };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('open-directory-path', async (event, targetPath) => {
    try {
        if (targetPath && fs.existsSync(targetPath)) {
            await shell.openPath(targetPath);
            return { success: true };
        }
        return { success: false, error: 'Path does not exist' };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// --- Local desktop state snapshot and SQL migration export ---
function getDatabaseDir() {
    const dbDir = path.join(getUserDataDir(), 'database');
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    return dbDir;
}

// The application stores a serialized Zustand JSON snapshot, not a SQLite database.
function getDatabaseFilePath() {
    return path.join(getDatabaseDir(), 'ashke_ghalam-state.json');
}

// Migrate the old .db-named JSON snapshot without deleting the original.
// If its content is not JSON, return the legacy file so existing recovery logic can inspect it.
async function getExistingDatabaseFilePath() {
    const currentFile = getDatabaseFilePath();
    if (fs.existsSync(currentFile)) return currentFile;

    const legacyFile = path.join(getDatabaseDir(), 'ashke_ghalam.db');
    if (!fs.existsSync(legacyFile)) return currentFile;

    const raw = await fs.promises.readFile(legacyFile, 'utf-8');
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return legacyFile;
    } catch {
        return legacyFile;
    }

    await fs.promises.writeFile(currentFile, raw, 'utf-8');
    return currentFile;
}

function getSqlDumpFilePath() {
    return path.join(getDatabaseDir(), 'ashke_ghalam_dump.sql');
}

// Generate a MySQL/MariaDB dump for cPanel/phpMyAdmin.
// The local .db file is a JSON Zustand snapshot, not a SQLite database.
function generateRelationalSqlDump(state) {
    try {
        const parsed = typeof state === 'string' ? JSON.parse(state) : state;
        const s = parsed && parsed.state ? parsed.state : parsed;
        const sqlText = (value) => String(value ?? '')
            .replace(/\\/g, '\\\\')
            .replace(/\0/g, '')
            .replace(/'/g, "''")
            .replace(/\r/g, '\\r')
            .replace(/\n/g, '\\n');
        const sqlNumber = (value) => {
            const number = Number(value);
            return Number.isFinite(number) ? number : 0;
        };
        const sqlString = (value) => "'" + sqlText(value) + "'";
        const lines = [
            '-- =====================================================',
            '-- خروجی داده‌های اشک قلم برای انتقال به MariaDB / MySQL',
            '-- فایل محلی برنامه یک snapshot از Zustand با قالب JSON است، نه SQLite.',
            `-- تاریخ ایجاد: ${new Date().toISOString()}`,
            '-- سازگار با MariaDB / MySQL و phpMyAdmin در cPanel',
            '-- =====================================================',
            '',
            'SET NAMES utf8mb4;',
            'SET FOREIGN_KEY_CHECKS = 0;',
            '',
            '-- جدول اشخاص و طرف‌های حساب',
            'CREATE TABLE IF NOT EXISTS `people` (',
            '  `id` VARCHAR(64) NOT NULL PRIMARY KEY,',
            '  `code` VARCHAR(32),',
            '  `name` VARCHAR(255) NOT NULL,',
            '  `phone` VARCHAR(64),',
            '  `category` VARCHAR(64),',
            '  `balance` BIGINT DEFAULT 0,',
            '  `address` TEXT,',
            '  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
            ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_persian_ci;',
            '',
            '-- جدول کالاها و انبار',
            'CREATE TABLE IF NOT EXISTS `products` (',
            '  `id` VARCHAR(64) NOT NULL PRIMARY KEY,',
            '  `code` VARCHAR(32),',
            '  `name` VARCHAR(255) NOT NULL,',
            '  `stock` INT DEFAULT 0,',
            '  `buy_price` BIGINT DEFAULT 0,',
            '  `sell_price` BIGINT DEFAULT 0,',
            '  `unit` VARCHAR(32) DEFAULT "عدد",',
            '  `category` VARCHAR(64),',
            '  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
            ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_persian_ci;',
            '',
            '-- جدول فاکتورها',
            'CREATE TABLE IF NOT EXISTS `invoices` (',
            '  `id` VARCHAR(64) NOT NULL PRIMARY KEY,',
            '  `number` VARCHAR(64) NOT NULL,',
            '  `type` VARCHAR(32) NOT NULL,',
            '  `date` VARCHAR(32) NOT NULL,',
            '  `person_id` VARCHAR(64),',
            '  `total` BIGINT DEFAULT 0,',
            '  `tax` BIGINT DEFAULT 0,',
            '  `discount` BIGINT DEFAULT 0,',
            '  `items_json` LONGTEXT,',
            '  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
            ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_persian_ci;',
            '',
            '-- جدول چک‌ها',
            'CREATE TABLE IF NOT EXISTS `checks` (',
            '  `id` VARCHAR(64) NOT NULL PRIMARY KEY,',
            '  `bank_name` VARCHAR(128),',
            '  `amount` BIGINT DEFAULT 0,',
            '  `due_date` VARCHAR(32),',
            '  `status` VARCHAR(32),',
            '  `sayad_id` VARCHAR(64),',
            '  `person_id` VARCHAR(64)',
            ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_persian_ci;',
            '',
            '-- جدول تراکنش‌های مالی و خزانه‌داری',
            'CREATE TABLE IF NOT EXISTS `transactions` (',
            '  `id` VARCHAR(64) NOT NULL PRIMARY KEY,',
            '  `type` VARCHAR(32),',
            '  `amount` BIGINT DEFAULT 0,',
            '  `date` VARCHAR(32),',
            '  `description` TEXT',
            ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_persian_ci;',
            '',
            '-- جدول سندهای حسابداری',
            'CREATE TABLE IF NOT EXISTS `vouchers` (',
            '  `id` VARCHAR(64) NOT NULL PRIMARY KEY,',
            '  `number` INT,',
            '  `date` VARCHAR(32),',
            '  `description` TEXT,',
            '  `items_json` LONGTEXT',
            ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_persian_ci;',
            '',
            '-- جدول پیکربندی و وضعیت سیستم',
            'CREATE TABLE IF NOT EXISTS `system_meta` (',
            '  `key_name` VARCHAR(128) NOT NULL PRIMARY KEY,',
            '  `value_data` LONGTEXT,',
            '  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
            ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_persian_ci;',
            ''
        ];

        // Export account/person records.
        if (Array.isArray(s.people) && s.people.length > 0) {
            lines.push('-- رکوردهای اشخاص');
            s.people.forEach(p => {
                if (!p || !p.id) return;
                lines.push(`REPLACE INTO \`people\` (\`id\`, \`code\`, \`name\`, \`phone\`, \`category\`, \`balance\`, \`address\`) VALUES (${sqlString(p.id)}, ${sqlString(p.code)}, ${sqlString(p.name)}, ${sqlString(p.phone)}, ${sqlString(p.category)}, ${sqlNumber(p.balance)}, ${sqlString(p.address)});`);
            });
            lines.push('');
        }

        // Export inventory items.
        if (Array.isArray(s.products) && s.products.length > 0) {
            lines.push('-- رکوردهای کالاها');
            s.products.forEach(p => {
                if (!p || !p.id) return;
                lines.push(`REPLACE INTO \`products\` (\`id\`, \`code\`, \`name\`, \`stock\`, \`buy_price\`, \`sell_price\`, \`unit\`, \`category\`) VALUES (${sqlString(p.id)}, ${sqlString(p.code)}, ${sqlString(p.name)}, ${sqlNumber(p.stock)}, ${sqlNumber(p.buyPrice)}, ${sqlNumber(p.sellPrice)}, ${sqlString(p.unit || 'عدد')}, ${sqlString(p.category)});`);
            });
            lines.push('');
        }

        // Export invoices. String() conversion is intentional: invoice numbers are
        // numeric in some versions and strings (with prefixes) in others.
        if (Array.isArray(s.invoices) && s.invoices.length > 0) {
            lines.push('-- رکوردهای فاکتورها');
            s.invoices.forEach(inv => {
                if (!inv || !inv.id) return;
                lines.push(`REPLACE INTO \`invoices\` (\`id\`, \`number\`, \`type\`, \`date\`, \`person_id\`, \`total\`, \`tax\`, \`discount\`, \`items_json\`) VALUES (${sqlString(inv.id)}, ${sqlString(inv.number)}, ${sqlString(inv.type)}, ${sqlString(inv.date)}, ${sqlString(inv.personId)}, ${sqlNumber(inv.total ?? inv.finalTotal)}, ${sqlNumber(inv.tax)}, ${sqlNumber(inv.discount)}, ${sqlString(JSON.stringify(inv.items || []))});`);
            });
            lines.push('');
        }

        // Export check records using the fields available in the current app model.
        if (Array.isArray(s.checks) && s.checks.length > 0) {
            lines.push('-- رکوردهای چک');
            s.checks.forEach(check => {
                if (!check || !check.id) return;
                lines.push(`REPLACE INTO \`checks\` (\`id\`, \`bank_name\`, \`amount\`, \`due_date\`, \`status\`, \`sayad_id\`, \`person_id\`) VALUES (${sqlString(check.id)}, ${sqlString(check.bankName)}, ${sqlNumber(check.amount)}, ${sqlString(check.dueDate)}, ${sqlString(check.status)}, ${sqlString(check.sayadId)}, ${sqlString(check.personId)});`);
            });
            lines.push('');
        }

        // Export cash/treasury transactions.
        if (Array.isArray(s.transactions) && s.transactions.length > 0) {
            lines.push('-- تراکنش‌های مالی و خزانه‌داری');
            s.transactions.forEach(transaction => {
                if (!transaction || !transaction.id) return;
                lines.push(`REPLACE INTO \`transactions\` (\`id\`, \`type\`, \`amount\`, \`date\`, \`description\`) VALUES (${sqlString(transaction.id)}, ${sqlString(transaction.type)}, ${sqlNumber(transaction.amount)}, ${sqlString(transaction.date)}, ${sqlString(transaction.description)});`);
            });
            lines.push('');
        }

        // Export inventory vouchers.
        if (Array.isArray(s.vouchers) && s.vouchers.length > 0) {
            lines.push('-- حواله‌های انبار');
            s.vouchers.forEach(voucher => {
                if (!voucher || !voucher.id) return;
                lines.push(`REPLACE INTO \`vouchers\` (\`id\`, \`number\`, \`date\`, \`description\`, \`items_json\`) VALUES (${sqlString(voucher.id)}, ${sqlNumber(voucher.number)}, ${sqlString(voucher.date)}, ${sqlString(voucher.notes || voucher.returnReason || voucher.type)}, ${sqlString(JSON.stringify(voucher.items || []))});`);
            });
            lines.push('');
        }

        // Export system settings as one JSON row for migration/archive purposes.
        if (s.config && typeof s.config === 'object') {
            lines.push(`REPLACE INTO \`system_meta\` (\`key_name\`, \`value_data\`) VALUES (${sqlString('config')}, ${sqlString(JSON.stringify(s.config))});`);
            lines.push('');
        }

        lines.push('SET FOREIGN_KEY_CHECKS = 1;');
        return lines.join('\n');
    } catch (e) {
        return `-- خطا در تولید SQL: ${e.message}`;
    }
}

ipcMain.handle('sql-db-save', async (event, stateData) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) {
        return { success: false, error: 'UNAUTHORIZED_RENDERER' };
    }
    try {
        const dbFile = getDatabaseFilePath();
        const serialized = typeof stateData === 'string' ? stateData : JSON.stringify(stateData);
        if (typeof serialized !== 'string' || Buffer.byteLength(serialized, 'utf-8') > 100 * 1024 * 1024) {
            return { success: false, error: 'LOCAL_STATE_TOO_LARGE' };
        }
        // New writes fail closed instead of silently saving financial data as plaintext.
        const protectedText = await encryptDesktopText(serialized);
        await writeTextAtomically(dbFile, protectedText);
        return {
            success: true,
            encryptedAtRest: true,
            dbPath: dbFile,
            sqlPath: getSqlDumpFilePath(),
            size: Buffer.byteLength(protectedText, 'utf-8')
        };
    } catch (e) {
        console.error('خطا در ذخیره امن داده‌های محلی:', e);
        return { success: false, error: e.message || 'LOCAL_STATE_WRITE_FAILED' };
    }
});

ipcMain.handle('sql-db-load', async (event) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) {
        return { success: false, error: 'UNAUTHORIZED_RENDERER' };
    }
    try {
        const dbFile = await getExistingDatabaseFilePath();
        if (fs.existsSync(dbFile)) {
            const raw = await readProtectedTextFile(dbFile);
            return { success: true, data: raw, encryptedAtRest: parseJsonSafely(raw)?.format === DESKTOP_ENCRYPTED_FORMAT };
        }
        return { success: false, error: 'Local state snapshot not found' };
    } catch (e) {
        return { success: false, error: e.message || 'LOCAL_STATE_READ_FAILED' };
    }
});

ipcMain.handle('sql-db-export', async (event, defaultName = 'ashke_ghalam_backup.json') => {
    if (!mainWindow || event.sender !== mainWindow.webContents) {
        return { success: false, error: 'UNAUTHORIZED_RENDERER' };
    }
    try {
        const dbFile = await getExistingDatabaseFilePath();
        if (!fs.existsSync(dbFile)) return { success: false, error: 'فایل داده محلی هنوز ایجاد نشده است.' };

        const result = await dialog.showSaveDialog(mainWindow, {
            title: 'خروجی داده‌های اشک قلم',
            defaultPath: defaultName,
            filters: [
                { name: 'Encrypted Local Snapshot (*.json)', extensions: ['json'] },
                { name: 'SQL Script (*.sql) — plaintext export', extensions: ['sql'] }
            ]
        });
        if (result.canceled || !result.filePath) return { canceled: true };

        if (path.extname(result.filePath).toLowerCase() === '.json') {
            const raw = await fs.promises.readFile(dbFile, 'utf-8');
            const parsed = parseJsonSafely(raw);
            const protectedText = parsed?.format === DESKTOP_ENCRYPTED_FORMAT || parsed?.format === PORTABLE_ENCRYPTED_FORMAT
                ? raw
                : await encryptDesktopText(raw);
            await writeTextAtomically(result.filePath, protectedText);
        } else {
            // SQL is an explicitly requested plaintext export; the destination dialog
            // makes that choice explicit, unlike the application's automatic local state.
            const serialized = await readProtectedTextFile(dbFile);
            const persisted = JSON.parse(serialized);
            const applicationState = persisted && typeof persisted === 'object' && persisted.state
                ? persisted.state
                : persisted;
            const sqlDump = generateRelationalSqlDump(applicationState);
            await writeTextAtomically(result.filePath, sqlDump);
        }
        return { success: true, filePath: result.filePath };
    } catch (e) {
        console.error('خطا در خروجی داده‌ها:', e);
        return { success: false, error: e.message || 'LOCAL_EXPORT_FAILED' };
    }
});

ipcMain.handle('sql-db-info', async () => {
    try {
        const dbFile = await getExistingDatabaseFilePath();
        const sqlFile = getSqlDumpFilePath();
        const exists = fs.existsSync(dbFile);
        let size = 0;
        let modified = null;
        if (exists) {
            const stats = fs.statSync(dbFile);
            size = stats.size;
            modified = stats.mtime;
        }
        return {
            exists,
            dbPath: dbFile,
            sqlPath: sqlFile,
            directory: getDatabaseDir(),
            sizeBytes: size,
            sizeFormatted: size > 1024 * 1024 ? `${(size / (1024 * 1024)).toFixed(2)} مگابایت` : `${(size / 1024).toFixed(1)} کیلوبایت`,
            lastModified: modified ? modified.toISOString() : null
        };
    } catch (e) {
        return { exists: false, error: e.message };
    }
});

ipcMain.handle('open-database-folder', async () => {
    try {
        const dir = getDatabaseDir();
        await shell.openPath(dir);
        return { success: true, path: dir };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.on('backup-completed-exit', () => {
    isQuitting = true;
    app.quit();
});

// جلوگیری از اجرای چندگانه برنامه (Single Instance Lock)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    app.whenReady().then(() => {
        createSplash();
        createWindow();

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createSplash();
                createWindow();
            }
        });
    });
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
