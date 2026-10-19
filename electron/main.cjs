// Electron Main Process for Windows Standalone Executable
const { app, BrowserWindow, shell, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const url = require('url');

// بهینه‌سازی حداکثری پرفورمنس، رفع لگ، رندر فوق سریع و شتاب‌دهنده سخت‌افزاری GPU در ویندوز
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-fast-unload');
app.commandLine.appendSwitch('renderer-process-limit', '6');
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096 --expose-gc');

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
            partition: 'persist:ashke-ghalam-isolated-secure'
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
    return app.getVersion() || '16.22.0';
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
    try {
        const vaultPath = getSecureVaultPath();
        let data = {};
        if (fs.existsSync(vaultPath)) {
            try {
                const raw = fs.readFileSync(vaultPath, 'utf-8');
                data = JSON.parse(raw);
            } catch {}
        }
        data[key] = value;
        fs.writeFileSync(vaultPath, JSON.stringify(data, null, 2), 'utf-8');
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('secure-store-get', async (event, key) => {
    try {
        const vaultPath = getSecureVaultPath();
        if (fs.existsSync(vaultPath)) {
            const raw = fs.readFileSync(vaultPath, 'utf-8');
            const data = JSON.parse(raw);
            return data[key] !== undefined ? data[key] : null;
        }
        return null;
    } catch (e) {
        return null;
    }
});

ipcMain.handle('secure-store-remove', async (event, key) => {
    try {
        const vaultPath = getSecureVaultPath();
        if (fs.existsSync(vaultPath)) {
            const raw = fs.readFileSync(vaultPath, 'utf-8');
            const data = JSON.parse(raw);
            delete data[key];
            fs.writeFileSync(vaultPath, JSON.stringify(data, null, 2), 'utf-8');
        }
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('get-app-config', async () => {
    return loadDesktopConfig();
});

ipcMain.handle('save-app-config', async (event, config) => {
    try {
        const configPath = getAppConfigPath();
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
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
        fs.writeFileSync(result.filePath, JSON.stringify(config, null, 2), 'utf-8');
        return { success: true, filePath: result.filePath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'انتخاب پوشه ذخیره بک‌آپ'
    });
    return result.canceled ? null : result.filePaths[0];
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

// --- پایگاه داده رابطه‌ای و ایزوله دسکتاپ ویندوز (SQL Database Engine) ---
function getDatabaseDir() {
    const dbDir = path.join(getUserDataDir(), 'database');
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    return dbDir;
}

function getDatabaseFilePath() {
    return path.join(getDatabaseDir(), 'ashke_ghalam.db');
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
    try {
        const dbFile = getDatabaseFilePath();
        const serialized = typeof stateData === 'string' ? stateData : JSON.stringify(stateData);

        // Keep autosave cheap: the renderer sends a full state snapshot, so write only
        // that snapshot here. Generating a full relational SQL dump for every state
        // change is expensive for large invoice ledgers; SQL is generated on explicit export.
        await fs.promises.writeFile(dbFile, serialized, 'utf-8');

        return {
            success: true,
            dbPath: dbFile,
            sqlPath: getSqlDumpFilePath(),
            size: Buffer.byteLength(serialized, 'utf-8')
        };
    } catch (e) {
        console.error('خطا در ذخیره دیتابیس SQL:', e);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('sql-db-load', async () => {
    try {
        const dbFile = getDatabaseFilePath();
        if (fs.existsSync(dbFile)) {
            const raw = fs.readFileSync(dbFile, 'utf-8');
            return { success: true, data: raw };
        }
        return { success: false, error: 'Database file not found' };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('sql-db-export', async (event, defaultName = 'ashke_ghalam_backup.sql') => {
    try {
        const dbFile = getDatabaseFilePath();
        if (!fs.existsSync(dbFile)) {
            return { success: false, error: 'فایل داده محلی هنوز ایجاد نشده است.' };
        }

        const result = await dialog.showSaveDialog(mainWindow, {
            title: 'خروجی داده‌های اشک قلم',
            defaultPath: defaultName,
            filters: [
                { name: 'SQL Script (*.sql)', extensions: ['sql'] },
                { name: 'JSON State Backup (*.json)', extensions: ['json'] }
            ]
        });

        if (result.canceled || !result.filePath) {
            return { canceled: true };
        }

        if (path.extname(result.filePath).toLowerCase() === '.json') {
            // This is a JSON state snapshot, not a real SQLite database file.
            await fs.promises.copyFile(dbFile, result.filePath);
        } else {
            // Zustand persistence stores { state, version }; unwrap it before SQL generation.
            const serialized = await fs.promises.readFile(dbFile, 'utf-8');
            const persisted = JSON.parse(serialized);
            const applicationState = persisted && typeof persisted === 'object' && persisted.state
                ? persisted.state
                : persisted;
            const sqlDump = generateRelationalSqlDump(applicationState);
            await fs.promises.writeFile(result.filePath, sqlDump, 'utf-8');
        }

        return { success: true, filePath: result.filePath };
    } catch (e) {
        console.error('خطا در خروجی داده‌ها:', e);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('sql-db-info', async () => {
    try {
        const dbFile = getDatabaseFilePath();
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

ipcMain.handle('save-backup-file', async (event, { filePath, data }) => {
    try {
        fs.writeFileSync(filePath, data, 'utf-8');
        return { success: true };
    } catch (error) {
        console.error('Error saving backup file:', error);
        return { success: false, error: error.message };
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
