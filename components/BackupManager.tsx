import React, { useState, useEffect } from 'react';
import { 
    Download, Upload, Database, HardDrive, Cloud, Trash2, RotateCcw, 
    ShieldCheck, Loader2, Calendar, AlertTriangle, Activity, FileText, 
    CheckCircle2, Clock, RefreshCw, Settings2, FileDown, FileUp, ShieldAlert,
    Layers, HardDriveDownload, Sparkles, HelpCircle, ArrowLeftRight,
    Wifi, WifiOff, Server, Code, Cpu, Eye, X
} from 'lucide-react';
import { useStore } from '../store';
import { downloadJSON, getPersianDate, toPersianDigits, fetchWithTimeout } from '../utils';
import { hostBackupService, HostBackupEntry } from '../services/hostBackupService';
import { securityService } from '../services/securityService';
import { autoBackupService } from '../services/autoBackupService';
import { backupMigrationService } from '../services/backupMigrationService';
import { smartStorage } from '../services/smartStorageService';
import { TripleBackupService, TripleBackupReport } from '../services/tripleBackupService';
import { useFinancialStore } from '../store-financial';
import { APP_VERSION } from '../config';
import { workspaceService } from '../services/workspaceService';

type ActiveTab = 'triple' | 'stats' | 'cloud' | 'local_snap' | 'desktop' | 'file' | 'sync' | 'diagnostics' | 'reset';

const BackupManager = () => {
    const { 
        companies, products, people, invoices, vouchers, checks, 
        transactions, checkTransfers, salaries, contracts, config, users,
        importConfigs, hydrateStore, addNotification
    } = useStore();

    // UI States
    const [activeTab, setActiveTab] = useState<ActiveTab>('triple');
    const [tripleLoading, setTripleLoading] = useState(false);
    const [tripleReport, setTripleReport] = useState<TripleBackupReport | null>(null);
    const [localLoading, setLocalLoading] = useState(false);
    const [cloudLoading, setCloudLoading] = useState(false);
    const [hostBackups, setHostBackups] = useState<HostBackupEntry[]>([]);
    const [localSnapshots, setLocalSnapshots] = useState<any[]>([]);
    const [loadingList, setLoadingList] = useState(false);
    const [loadingLocalList, setLoadingLocalList] = useState(false);
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [wipeInput, setWipeInput] = useState('');
    const [showWipeConfirm, setShowWipeConfirm] = useState(false);

    // Storage Mode and Sync State
    const [storageMode, setStorageMode] = useState<'HOST' | 'LOCAL'>(smartStorage.getStorageMode());
    const [syncStatus, setSyncStatus] = useState(smartStorage.getStatus());

    // Diagnostics State
    const [diagTesting, setDiagTesting] = useState(false);
    const [diagResults, setDiagResults] = useState<any[]>([]);
    const [diagLastTest, setDiagLastTest] = useState<string>('');
    const [diagHostStatus, setDiagHostStatus] = useState<any>({ online: false });
    const [diagHostFiles, setDiagHostFiles] = useState<any[]>([]);
    const [diagSelectedFile, setDiagSelectedFile] = useState<string | null>(null);
    const [diagFileContent, setDiagFileContent] = useState<any>(null);
    const [diagFileLoading, setDiagFileLoading] = useState(false);
    const [diagWriteTestTable, setDiagWriteTestTable] = useState<string | null>(null);
    const [diagWriteTestStatus, setDiagWriteTestStatus] = useState<string | null>(null);

    // Desktop Backup State
    const [desktopBackupPath, setDesktopBackupPath] = useState<string>(localStorage.getItem('desktop_auto_backup_path') || '');
    const [isDesktopEnv, setIsDesktopEnv] = useState(false);

    useEffect(() => {
        const checkEnv = async () => {
            const electronAPI = (window as any).electronDesktopAPI;
            const tauriAPI = (window as any).__TAURI__;
            setIsDesktopEnv(Boolean(electronAPI) || Boolean(tauriAPI));

            if (electronAPI && typeof electronAPI.invoke === 'function') {
                try {
                    const selectedPath = await electronAPI.invoke('get-local-backup-directory');
                    const safePath = typeof selectedPath === 'string' ? selectedPath : '';
                    setDesktopBackupPath(safePath);
                    if (safePath) localStorage.setItem('desktop_auto_backup_path', safePath);
                    else localStorage.removeItem('desktop_auto_backup_path');
                } catch {
                    setDesktopBackupPath('');
                }
            } else {
                // A path typed or cached by the old UI is not proof of filesystem permission.
                setDesktopBackupPath('');
                localStorage.removeItem('desktop_auto_backup_path');
            }
        };
        void checkEnv();
    }, []);

    const handleSelectDesktopPath = async () => {
        const electronAPI = (window as any).electronDesktopAPI;
        if (!electronAPI || typeof electronAPI.invoke !== 'function') {
            addNotification('error', 'انتخاب پوشه و بکاپ مستقل خودکار فعلاً فقط در نسخه نصب‌شده ویندوز پشتیبانی می‌شود. در مرورگر از خروجی فایل پشتیبان استفاده کنید.');
            return;
        }

        try {
            const selectedPath = await electronAPI.invoke('select-directory');
            if (!selectedPath || typeof selectedPath !== 'string') {
                addNotification('info', 'انتخاب پوشه لغو شد؛ تنظیم قبلی تغییر نکرد.');
                return;
            }
            setDesktopBackupPath(selectedPath);
            localStorage.setItem('desktop_auto_backup_path', selectedPath);
            addNotification('success', 'پوشه انتخاب شد. بکاپ مستقل فقط پس از نوشتن واقعی فایل تأیید می‌شود.');
        } catch (error: any) {
            addNotification('error', 'انتخاب پوشه انجام نشد: ' + (error?.message || 'خطای نامشخص'));
        }
    };

    // Load lists
    const loadHostBackups = async () => {
        setLoadingList(true);
        try {
            const list = await hostBackupService.listHostBackups();
            setHostBackups(list);
        } catch (error) {
            console.error('خطا در دریافت لیست بکاپ‌های هاست:', error);
        } finally {
            setLoadingList(false);
        }
    };

    const loadLocalSnapshots = async () => {
        setLoadingLocalList(true);
        try {
            const list = await autoBackupService.getBackups();
            setLocalSnapshots(list || []);
        } catch (error) {
            console.error('خطا در دریافت بکاپ‌های محلی:', error);
        } finally {
            setLoadingLocalList(false);
        }
    };

    const loadTripleReport = async () => {
        try {
            const report = await TripleBackupService.getLastReport();
            setTripleReport(report);
        } catch {}
    };

    const handleRunTripleBackup = async () => {
        setTripleLoading(true);
        try {
            const state = useStore.getState();
            const report = await TripleBackupService.executeTripleBackup(state);
            setTripleReport(report);
            if (report.overallSuccess) {
                if (addNotification) addNotification('success', 'همه مسیرهای پشتیبان‌گیری گزارش‌شده موفق بودند.');
                else alert('همه مسیرهای پشتیبان‌گیری گزارش‌شده موفق بودند.');
            } else {
                const cloudStatus = report.tiers[2]?.status || 'WAITING';
                const message = `پشتیبان‌گیری کامل نیست. نسخه محلی: ${report.tiers[0]?.status || 'نامشخص'}؛ نسخه مستقل فایل‌سیستم: نیازمند پیاده‌سازی؛ سرور: ${cloudStatus}.`;
                if (addNotification) addNotification('error', message);
                else alert(message);
            }
        } catch (error: any) {
            alert(`خطا در پشتیبان‌گیری ۳ گانه: ${error?.message || error}`);
        } finally {
            setTripleLoading(false);
        }
    };

    useEffect(() => {
        loadHostBackups();
        loadLocalSnapshots();
        loadTripleReport();
    }, []);

    // Storage Mode handlers
    const handleStorageModeChange = (newMode: 'HOST' | 'LOCAL') => {
        smartStorage.setStorageMode(newMode);
        setStorageMode(newMode);
        setSyncStatus(smartStorage.getStatus());
        if (addNotification) {
            addNotification('success', `حالت ذخیره‌سازی به ${newMode === 'HOST' ? 'هاست' : 'لوکال'} تغییر یافت`);
        } else {
            alert(`حالت ذخیره‌سازی به ${newMode === 'HOST' ? 'هاست' : 'لوکال'} تغییر یافت`);
        }
    };

    const handleProcessSync = async () => {
        if (addNotification) addNotification('info', 'در حال همگام‌سازی اطلاعات با هاست...');
        try {
            await smartStorage.processOfflineQueue();
            setSyncStatus(smartStorage.getStatus());
            if (addNotification) {
                addNotification('success', 'همگام‌سازی اطلاعات با موفقیت انجام شد');
            } else {
                alert('همگام‌سازی اطلاعات با موفقیت انجام شد');
            }
        } catch (err: any) {
            if (addNotification) {
                addNotification('error', `خطا در همگام‌سازی اطلاعات: ${err?.message || err}`);
            } else {
                alert(`خطا در همگام‌سازی اطلاعات: ${err?.message || err}`);
            }
        }
    };

    // Diagnostics Suite Run
    const runDiagnosticsSuite = async () => {
        setDiagTesting(true);
        const diagnostics: any[] = [];
        const hostUrl = 'https://acc.ashkghalam.ir';

        // 1. Internet connection
        const internetStart = Date.now();
        try {
            await fetchWithTimeout('https://www.google.com/favicon.ico', { mode: 'no-cors' }, 2000);
            diagnostics.push({
                name: 'اتصال اینترنت عمومی',
                status: 'success',
                message: 'برقرار',
                details: 'شبکه جهانی اینترنت در دسترس است',
                latency: Date.now() - internetStart
            });
        } catch {
            diagnostics.push({
                name: 'اتصال اینترنت عمومی',
                status: 'error',
                message: 'قطع',
                details: 'اتصال به اینترنت برقرار نیست'
            });
        }

        // 2. Host API Status
        const hostStart = Date.now();
        try {
            const res = await fetch(`${hostUrl}/host-api.php?action=status`, { headers: await workspaceService.getSecureHeaders() });
            const data = await res.json();
            if (data.success) {
                diagnostics.push({
                    name: 'وب سرویس هاست (API)',
                    status: 'success',
                    message: 'فعال و پاسخگو',
                    details: `نسخه API: ${data.version || 'نامشخص'} - نسخه PHP: ${data.phpVersion || 'نامشخص'}`,
                    latency: Date.now() - hostStart
                });
                setDiagHostStatus({
                    online: true,
                    apiVersion: data.version,
                    phpVersion: data.phpVersion,
                    diskSpace: data.diskSpace,
                    lastBackup: data.lastBackup
                });
            } else {
                diagnostics.push({
                    name: 'وب سرویس هاست (API)',
                    status: 'error',
                    message: 'غیرفعال',
                    details: 'پاسخ دریافتی از هاست نامعتبر است'
                });
            }
        } catch (error: any) {
            diagnostics.push({
                name: 'وب سرویس هاست (API)',
                status: 'error',
                message: 'ناموفق',
                details: `خطا در برقراری ارتباط با هاست: ${error?.message || 'آدرس نامعتبر'}`
            });
        }

        // 3. Database Write diagnostic
        try {
            const testTable = 'companies';
            const testData = {
                id: `diag_test_${Date.now()}`,
                name: 'شرکت تست عیب‌یابی',
                address: 'آدرس تستی',
                phone: '09120000000',
                isActive: false,
                test: true
            };

            const writeRes = await fetch(`${hostUrl}/host-api.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...await workspaceService.getSecureHeaders() },
                body: JSON.stringify({
                    action: 'save',
                    table: testTable,
                    data: testData
                })
            });
            const writeResult = await writeRes.json();

            if (writeResult.success) {
                diagnostics.push({
                    name: 'عملیات نوشتن در دیتابیس هاست',
                    status: 'success',
                    message: 'مجاز و موفق',
                    details: 'داده‌های تستی با موفقیت روی هاست ذخیره شدند'
                });

                await fetch(`${hostUrl}/host-api.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...await workspaceService.getSecureHeaders() },
                    body: JSON.stringify({
                        action: 'delete',
                        table: testTable,
                        id: testData.id
                    })
                });
            } else {
                diagnostics.push({
                    name: 'عملیات نوشتن در دیتابیس هاست',
                    status: 'error',
                    message: 'خطای مجوز/پیکربندی',
                    details: `خطای سرور: ${writeResult.error || 'عدم امکان ثبت داده تستی'}`
                });
            }
        } catch (error: any) {
            diagnostics.push({
                name: 'عملیات نوشتن در دیتابیس هاست',
                status: 'error',
                message: 'خطای ارتباط',
                details: `امکان ارسال درخواست نوشتن به هاست وجود ندارد: ${error?.message || error}`
            });
        }

        // 4. LocalStorage
        try {
            const storageSize = new Blob([JSON.stringify(localStorage)]).size;
            const storageMB = (storageSize / 1024 / 1024).toFixed(2);
            diagnostics.push({
                name: 'حافظه محلی مرورگر (LocalStorage)',
                status: storageSize < 4.5 * 1024 * 1024 ? 'success' : 'warning',
                message: `${toPersianDigits(storageMB)} MB`,
                details: `حجم دیتای محلی شما در وضعیت ${storageSize < 4.5 * 1024 * 1024 ? 'مطلوب' : 'تکمیل قرار دارد (احتمال خطای سهمیه)'}`
            });
        } catch {
            diagnostics.push({
                name: 'حافظه محلی مرورگر (LocalStorage)',
                status: 'error',
                message: 'خطا',
                details: 'دسترسی به LocalStorage توسط مرورگر بلاک شده است'
            });
        }

        setDiagResults(diagnostics);
        setDiagLastTest(new Date().toLocaleString('fa-IR'));
        setDiagTesting(false);

        // Load host files list
        try {
            const res = await fetch(`${hostUrl}/host-api.php?action=list_files`, { headers: await workspaceService.getSecureHeaders() });
            const data = await res.json();
            if (data.success) {
                setDiagHostFiles(data.files || []);
            }
        } catch {}
    };

    const viewDiagFile = async (filename: string) => {
        setDiagFileLoading(true);
        const hostUrl = 'https://acc.ashkghalam.ir';
        try {
            const res = await fetch(`${hostUrl}/host-api.php?action=read_file&file=${encodeURIComponent(filename)}`, { headers: await workspaceService.getSecureHeaders() });
            const data = await res.json();
            if (data.success) {
                setDiagFileContent(data.content);
                setDiagSelectedFile(filename);
            }
        } catch (error) {
            console.error('Read file failed:', error);
        } finally {
            setDiagFileLoading(false);
        }
    };

    const testTableEndpoint = async (table: string) => {
        setDiagWriteTestTable(table);
        setDiagWriteTestStatus('testing');
        const hostUrl = 'https://acc.ashkghalam.ir';
        try {
            const testData = {
                id: `ping_${Date.now()}`,
                name: `تست پینگ ${table}`,
                timestamp: new Date().toISOString(),
                test: true
            };

            const writeRes = await fetch(`${hostUrl}/host-api.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...await workspaceService.getSecureHeaders() },
                body: JSON.stringify({
                    action: 'save',
                    table: table,
                    data: testData
                })
            });
            const writeData = await writeRes.json();

            if (writeData.success) {
                await fetch(`${hostUrl}/host-api.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...await workspaceService.getSecureHeaders() },
                    body: JSON.stringify({
                        action: 'delete',
                        table: table,
                        id: testData.id
                    })
                });
                setDiagWriteTestStatus('success');
            } else {
                setDiagWriteTestStatus('failed');
            }
        } catch {
            setDiagWriteTestStatus('error');
        }
        setTimeout(() => {
            setDiagWriteTestTable(null);
            setDiagWriteTestStatus(null);
        }, 3000);
    };

    useEffect(() => {
        if (activeTab === 'diagnostics') {
            runDiagnosticsSuite();
        }
    }, [activeTab]);

    const formatSize = (bytes: number) => {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        const formatted = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
        return toPersianDigits(formatted.toString()) + ' ' + sizes[i];
    };

    const formatJalaliDate = (timestamp: number) => {
        try {
            return new Intl.DateTimeFormat('fa-IR', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            }).format(new Date(timestamp));
        } catch {
            return toPersianDigits(new Date(timestamp).toLocaleDateString('fa-IR'));
        }
    };

    // Calculate database size estimate
    const getSystemStats = () => {
        const branchesCount = (companies || []).reduce((acc, c) => acc + ((c.branches && c.branches.length) || 0), 0);
        const rolesCount = (useStore.getState().roles || []).length;
        const counts = {
            companies: companies?.length || 0,
            branches: branchesCount,
            products: products?.length || 0,
            people: people?.length || 0,
            invoices: invoices?.length || 0,
            vouchers: vouchers?.length || 0,
            checks: checks?.length || 0,
            transactions: transactions?.length || 0,
            checkTransfers: checkTransfers?.length || 0,
            salaries: salaries?.length || 0,
            contracts: contracts?.length || 0,
            users: users?.length || 0,
            roles: rolesCount,
            importConfigs: importConfigs?.length || 0,
        };
        const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);
        return { counts, totalRecords };
    };

    const { counts: entityCounts, totalRecords } = getSystemStats();

    // 1. Export JSON with Cryptographic Signature
    const handleFullBackupExport = async () => {
        setLocalLoading(true);
        try {
            const allBranches = (companies || []).flatMap(c => (c.branches || []).map(b => ({ ...b, companyId: c.id })));
            const currentRoles = useStore.getState().roles || [];
            const backupData: any = {
                timestamp: new Date().toISOString(),
                version: APP_VERSION,
                backupFormatVersion: 2,
                companies,
                branches: allBranches,
                products,
                people,
                invoices,
                vouchers,
                checks,
                transactions,
                checkTransfers,
                salaries,
                contracts,
                config,
                users,
                roles: currentRoles,
                importConfigs,
                financialData: useFinancialStore.getState(),
                signature: ''
            };

            backupData.signature = securityService.signBackup(backupData);
            const dateStr = getPersianDate().replace(/\//g, '-');
            const desktopAPI = (window as any).electronDesktopAPI;
            let savedNativePath = '';

            if (desktopAPI && typeof desktopAPI.writeLocalBackup === 'function') {
                const fileName = 'AshkeGhalam-ManualBackup-' + Date.now() + '.json';
                const result = await desktopAPI.writeLocalBackup(fileName, JSON.stringify(backupData, null, 2));
                if (result?.success && typeof result.filePath === 'string') {
                    savedNativePath = result.filePath;
                } else if (result?.error && result.error !== 'BACKUP_DIRECTORY_NOT_SELECTED') {
                    throw new Error('ذخیره فایل پشتیبان روی دیسک ناموفق بود: ' + result.error);
                }
            }

            backupService.backupData('full-export', backupData).catch(() => {});
            if (savedNativePath) {
                if (addNotification) addNotification('success', 'فایل پشتیبان مستقل روی دیسک ذخیره شد: ' + savedNativePath);
                else alert('فایل پشتیبان مستقل روی دیسک ذخیره شد.');
            } else {
                downloadJSON(backupData, 'AshkeGhalam-Backup-Signed-' + dateStr);
                if (addNotification) {
                    addNotification('info', 'فایل پشتیبان دانلود شد. برای ذخیره خودکار در پوشه مستقل ویندوز، ابتدا پوشه را انتخاب کنید.');
                } else {
                    alert('فایل پشتیبان دانلود شد؛ ذخیره خودکار در پوشه مستقل نیازمند انتخاب پوشه است.');
                }
            }
        } catch (error: any) {
            console.error(error);
            if (addNotification) addNotification('error', 'صدور فایل پشتیبان ناموفق بود: ' + (error?.message || 'خطای نامشخص'));
            else alert('خطا در صدور فایل پشتیبان');
        } finally {
            setLocalLoading(false);
        }
    };

    // 2. Import JSON file & verify signature & migrate
    const handleRestoreFile = async (file: File) => {
        try {
            const text = await file.text();
            const rawData = JSON.parse(text);

            // Structure check
            const hasBackupTables = !!(
                rawData.companies || rawData.products || rawData.people || 
                rawData.invoices || rawData.vouchers || rawData.checks || 
                rawData.transactions || rawData.salaries || rawData.contracts ||
                rawData.state
            );

            if (!hasBackupTables) {
                alert('خطا: فایل انتخاب شده ساختار معتبری از سیستم پشتیبانی ما نیست.');
                return;
            }

            // Version 2 backups must pass integrity verification. Legacy formats are
            // imported only through a separate, explicit compatibility confirmation.
            const formatVersion = Number(rawData.backupFormatVersion || 0);
            const isValid = securityService.verifyBackup(rawData);
            if (formatVersion >= 2 && !isValid) {
                alert('فایل پشتیبان نسخه جدید فاقد برچسب یکپارچگی معتبر است یا پس از ایجاد تغییر کرده است. بازیابی متوقف شد.');
                return;
            }
            if (formatVersion < 2 && !isValid) {
                const proceed = confirm('این فایل پشتیبان قدیمی است و کنترل یکپارچگی نسخه جدید را ندارد. فقط در صورتی ادامه دهید که منبع فایل را می‌شناسید. آیا می‌خواهید مسیر مهاجرت فایل قدیمی را ادامه دهید؟');
                if (!proceed) return;
            }

            if (!confirm('⚠️ تایید نهایی بازیابی:\nتمام داده‌های فعلی شما جایگزین اطلاعات این فایل خواهند شد و برنامه مجددا بارگذاری می‌شود. آیا مطمئن هستید؟')) {
                return;
            }

            // Run migration
            const migrated = backupMigrationService.migrateBackupData(rawData);

            // Hydrate state
            hydrateStore(migrated);
            
            alert('✅ بازیابی و مهاجرت داده‌ها با موفقیت انجام شد. برنامه مجدداً بارگذاری می‌شود...');
            window.location.reload();
        } catch (error: any) {
            alert(`خطا در پردازش فایل پشتیبان: ${error?.message || error}`);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleRestoreFile(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleRestoreFile(file);
    };

    // 3. Save Instant Local Snapshot (IndexedDB)
    const handleCreateLocalSnapshot = async () => {
        setLocalLoading(true);
        try {
            const state = useStore.getState();
            await autoBackupService.createLocalBackup(state);
            await loadLocalSnapshots();
            if (addNotification) {
                addNotification('success', 'نسخه پشتیبان سریع (سنسور مرورگر) با موفقیت ثبت شد.');
            } else {
                alert('نسخه پشتیبان سریع درون مرورگر با موفقیت ثبت شد.');
            }
        } catch (error: any) {
            alert(`خطا در ثبت پشتیبان مرورگر: ${error?.message || error}`);
        } finally {
            setLocalLoading(false);
        }
    };

    // Restore Local Snapshot
    const handleLocalSnapshotRestore = async (snapshotId: string) => {
        if (!confirm('آیا از بازیابی این نسخه پشتیبان درون مرورگر مطمئن هستید؟ داده‌های فعلی با این اطلاعات جایگزین خواهند شد.')) {
            return;
        }
        setActionLoadingId(snapshotId);
        try {
            const data = await autoBackupService.restoreBackup(snapshotId);
            const migrated = backupMigrationService.migrateBackupData(data);
            hydrateStore(migrated);
            alert('بازیابی داده‌های محلی با موفقیت انجام شد.');
            window.location.reload();
        } catch (error: any) {
            alert(`خطا در بازیابی پشتیبان محلی: ${error?.message || error}`);
        } finally {
            setActionLoadingId(null);
        }
    };

    // Delete Local Snapshot
    const handleLocalSnapshotDelete = async (snapshotId: string) => {
        if (!confirm('آیا از حذف این نسخه پشتیبان محلی اطمینان دارید؟')) {
            return;
        }
        setActionLoadingId(snapshotId);
        try {
            await autoBackupService.deleteBackup(snapshotId);
            await loadLocalSnapshots();
        } catch (error: any) {
            console.error(error);
        } finally {
            setActionLoadingId(null);
        }
    };

    // 4. Cloud Backup (Host Central Server)
    const handleHostBackup = async () => {
        setCloudLoading(true);
        try {
            const state = useStore.getState();
            const res = await hostBackupService.createBackup(state, 'manual');
            if (res.success) {
                if (addNotification) {
                    addNotification('success', 'پشتیبان‌گیری روی هاست مرکزی با موفقیت انجام شد.');
                } else {
                    alert('پشتیبان‌گیری روی هاست مرکزی با موفقیت انجام شد.');
                }
                loadHostBackups();
            } else {
                alert(`خطا در پشتیبان‌گیری هاست: ${res.error || res.message}`);
            }
        } catch (error: any) {
            alert(`خطا در ارتباط با هاست: ${error?.message || error}`);
        } finally {
            setCloudLoading(false);
        }
    };

    const handleHostRestore = async (backupId: string) => {
        if (!confirm('⚠️ آیا از بازیابی این نسخه پشتیبان از روی هاست مرکزی مطمئن هستید؟\nتمام داده‌های جاری شما پاک شده و فاقد بازگشت است.')) {
            return;
        }
        setActionLoadingId(backupId);
        try {
            const res = await hostBackupService.restoreFromHost(backupId);
            if (res.success && res.data) {
                if (!res.integrityVerified && !confirm('هش کامل نسخه پشتیبان تأیید نشد (ممکن است بکاپ قدیمی باشد). آیا با مسئولیت خودت ادامه می‌دهی؟')) {
                    return;
                }
                const payload = res.data;
                const restoredData = payload.data || {};
                const restoredAssets = payload.assets;

                // Merge base64 assets if exists
                if (restoredAssets && restoredAssets.companies && restoredData.companies) {
                    restoredData.companies = restoredData.companies.map((c: any) => {
                        const assetComp = restoredAssets.companies.find((ac: any) => ac.id === c.id);
                        if (assetComp) {
                            return {
                                ...c,
                                logo: assetComp.logo || c.logo,
                                stamp: assetComp.stamp || c.stamp,
                                signature: assetComp.signature || c.signature
                            };
                        }
                        return c;
                    });
                }

                // Process migration
                const migrated = backupMigrationService.migrateBackupData(restoredData);
                hydrateStore(migrated);

                alert(res.integrityVerified
                    ? 'بازیابی موفق شد؛ یکپارچگی فایل و داده‌های پشتیبان تأیید شد.'
                    : 'بازیابی انجام شد؛ نسخه پشتیبان قدیمی بود یا کنترل کامل یکپارچگی قابل تأیید نبود.');
                window.location.reload();
            } else {
                alert(`خطا در بازیابی اطلاعات: ${res.error || 'پاسخ نامعتبر از سرور'}`);
            }
        } catch (error: any) {
            alert(`خطا در اتصال به هاست مرکزی: ${error?.message || error}`);
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleHostDelete = async (backupId: string) => {
        if (!confirm('آیا مطمئن هستید که می‌خواهید این نسخه پشتیبان را از هاست مرکزی حذف کنید؟ این عمل غیرقابل بازگشت است.')) {
            return;
        }
        setActionLoadingId(backupId);
        try {
            const success = await hostBackupService.deleteHostBackup(backupId);
            if (success) {
                alert('نسخه پشتیبان از روی هاست مرکزی حذف گردید.');
                loadHostBackups();
            } else {
                alert('خطا در حذف پشتیبان ابری.');
            }
        } catch (error: any) {
            alert(`خطا در ارتباط با سرور: ${error?.message || error}`);
        } finally {
            setActionLoadingId(null);
        }
    };

    // 5. Hard Factory Reset
    const handleHardResetSystem = async () => {
        if (wipeInput.trim() !== 'WIPE') {
            alert('لطفا عبارت WIPE را با حروف بزرگ برای تایید فکتوری ریست تایپ نمایید.');
            return;
        }

        try {
            // No legacy global database reset calls; server-side tenant data is managed
            // only through the authenticated backup/recovery workflows.

            localStorage.clear();
            sessionStorage.clear();

            // Clear IndexedDB completely
            try {
                const databases = await indexedDB.databases();
                for (const db of databases) {
                    if (db.name) {
                        indexedDB.deleteDatabase(db.name);
                    }
                }
            } catch {}

            // Clear Caches
            if ('caches' in window) {
                try {
                    const keys = await caches.keys();
                    await Promise.all(keys.map(k => caches.delete(k)));
                } catch {}
            }

            // Unregister Service Workers
            if ('navigator' in window && navigator.serviceWorker) {
                try {
                    const regs = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(regs.map(r => r.unregister()));
                } catch {}
            }

            alert('✅ سیستم به طور کامل ریست شد. تمامی اطلاعات حذف شدند. صفحه برای راه‌اندازی اولیه مجدداً بارگذاری می‌شود.');
            window.location.href = '/';
        } catch (err: any) {
            alert(`خطا در ریست سیستم: ${err?.message || err}`);
        }
    };

    // Auto backup calculations
    const autoBackupStatus = autoBackupService.getStatus();

    return (
        <div className="space-y-6 animate-fade-in text-right RTL" dir="rtl">
            {/* Header Dashboard Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/40 backdrop-blur-md p-6 rounded-[2rem] border border-white/5 shadow-2xl">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-teal-500/15 border border-teal-500/20 text-teal-400 rounded-2xl flex items-center justify-center">
                        <Activity size={24} className="animate-pulse" />
                    </div>
                    <div>
                        <div className="text-[10px] text-slate-400 font-bold">وضعیت سلامت دیتابیس</div>
                        <div className="text-white text-sm font-black flex items-center gap-1.5 mt-1">
                            <span>پایدار و ایمن</span>
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-ping" />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 border-r md:border-r border-white/5 pr-4">
                    <div className="w-12 h-12 bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center">
                        <Clock size={24} />
                    </div>
                    <div>
                        <div className="text-[10px] text-slate-400 font-bold">آخرین پشتیبان‌گیری خودکار</div>
                        <div className="text-white text-xs font-black mt-1">
                            {autoBackupStatus.lastBackupTime 
                                ? `${toPersianDigits(Math.round(autoBackupStatus.hoursSince).toString())} ساعت پیش` 
                                : 'هنوز انجام نشده'}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 border-r md:border-r border-white/5 pr-4">
                    <div className="w-12 h-12 bg-amber-500/15 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center">
                        <RefreshCw size={20} className="animate-spin-slow" />
                    </div>
                    <div>
                        <div className="text-[10px] text-slate-400 font-bold">بکاپ خودکار بعدی (ساعت تخمینی)</div>
                        <div className="text-white text-xs font-black mt-1">
                            {autoBackupStatus.lastBackupTime 
                                ? `در ${toPersianDigits(Math.round(autoBackupStatus.nextBackupIn).toString())} ساعت آینده` 
                                : 'بلافاصله پس از اتصال پایدار'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Segmented Tab Control */}
            <div className="flex flex-wrap gap-2 p-1.5 bg-slate-950/80 rounded-2xl border border-white/5">
                <button
                    onClick={() => setActiveTab('triple')}
                    className={`flex-grow md:flex-initial py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'triple' ? 'bg-gradient-to-r from-teal-600 to-indigo-600 text-white shadow-lg shadow-indigo-600/20 ring-1 ring-white/20' : 'text-slate-400 hover:text-white'
                    }`}
                >
                    <ShieldCheck size={14} className="text-teal-300 animate-pulse" />
                    <span>پشتیبان ۳ گانه هوشمند</span>
                </button>
                <button
                    onClick={() => setActiveTab('stats')}
                    className={`flex-grow md:flex-initial py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'stats' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10' : 'text-slate-400 hover:text-white'
                    }`}
                >
                    <Layers size={14} />
                    <span>آمار دیتابیس</span>
                </button>
                <button
                    onClick={() => setActiveTab('cloud')}
                    className={`flex-grow md:flex-initial py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'cloud' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10' : 'text-slate-400 hover:text-white'
                    }`}
                >
                    <Cloud size={14} />
                    <span>نسخه‌های ابری</span>
                </button>
                <button
                    onClick={() => setActiveTab('local_snap')}
                    className={`flex-grow md:flex-initial py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'local_snap' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10' : 'text-slate-400 hover:text-white'
                    }`}
                >
                    <HardDrive size={14} />
                    <span>نسخه‌های محلی</span>
                </button>
                <button
                    onClick={() => setActiveTab('desktop')}
                    className={`flex-grow md:flex-initial py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'desktop' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10' : 'text-slate-400 hover:text-white'
                    }`}
                >
                    <Settings2 size={14} />
                    <span>مسیر ذخیره بک‌آپ ویندوز</span>
                </button>
                <button
                    onClick={() => setActiveTab('file')}
                    className={`flex-grow md:flex-initial py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'file' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10' : 'text-slate-400 hover:text-white'
                    }`}
                >
                    <ArrowLeftRight size={14} />
                    <span>فایل پشتیبان (JSON)</span>
                </button>
                <button
                    onClick={() => setActiveTab('sync')}
                    className={`flex-grow md:flex-initial py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'sync' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10' : 'text-slate-400 hover:text-white'
                    }`}
                >
                    <ArrowLeftRight size={14} />
                    <span>همگام‌سازی و هاست</span>
                </button>
                <button
                    onClick={() => setActiveTab('diagnostics')}
                    className={`flex-grow md:flex-initial py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'diagnostics' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10' : 'text-slate-400 hover:text-white'
                    }`}
                >
                    <Activity size={14} />
                    <span>سلامت و عیب‌یابی</span>
                </button>
                <button
                    onClick={() => setActiveTab('reset')}
                    className={`flex-grow md:flex-initial py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'reset' ? 'bg-rose-950/40 border border-rose-500/20 text-rose-400 hover:bg-rose-950/60' : 'text-slate-400 hover:text-rose-400'
                    }`}
                >
                    <ShieldAlert size={14} />
                    <span>بازیابی اضطراری</span>
                </button>
            </div>

            {/* TAB CONTENT */}

            {/* 0. Triple Redundant Auto Backup */}
            {activeTab === 'triple' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 border border-teal-500/20 rounded-[2.5rem] p-6 lg:p-8 shadow-2xl space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-white font-black text-lg flex items-center gap-2">
                                    <ShieldCheck size={22} className="text-teal-400" />
                                    <span>پشتیبان‌گیری چندمسیره و وضعیت واقعی ذخیره‌سازی</span>
                                </h3>
                                <p className="text-xs text-slate-300 mt-1">
                                    وضعیت‌ها فقط پس از تأیید ذخیره نمایش داده می‌شوند؛ نسخه مستقل روی فایل‌سیستم و رمزگذاری بکاپ سرور هنوز کامل نشده‌اند.
                                </p>
                            </div>

                            <button
                                onClick={handleRunTripleBackup}
                                disabled={tripleLoading}
                                className="px-6 py-3.5 bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white rounded-2xl font-black text-xs shadow-xl shadow-teal-500/20 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                            >
                                {tripleLoading ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        <span>در حال ذخیره و بررسی...</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={16} />
                                        <span>اجرای پشتیبان‌گیری و بررسی وضعیت</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Tiers Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                            {/* لایه ۱ */}
                            <div className="bg-slate-950/60 border border-white/5 p-5 rounded-3xl space-y-3 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />
                                <div className="flex items-center justify-between">
                                    <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-black text-sm">
                                        ۱
                                    </div>
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20">
                                        {tripleReport?.tiers[0]?.status === 'SYNCED' ? 'ثبت محلی تأیید شد ✓' : tripleReport?.tiers[0]?.status === 'ERROR' ? 'خطای ذخیره محلی' : 'وضعیت نامشخص'}
                                    </span>
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-white">نسخه محلی برنامه (IndexedDB)</h4>
                                    <p className="text-[11px] text-slate-400 mt-1">
                                        ذخیره در همین دستگاه؛ پاک‌سازی داده‌های برنامه یا مرورگر می‌تواند این نسخه را حذف کند
                                    </p>
                                </div>
                                <div className="pt-2 border-t border-white/5 text-[10px] text-slate-500 space-y-1 font-mono">
                                    <div>هش یکپارچگی: <span className="text-teal-400 font-bold">{tripleReport?.sha256 ? tripleReport.sha256.substring(0, 12) + '...' : 'تولید خودکار'}</span></div>
                                    <div>آخرین همگامی: <span className="text-slate-300 font-sans">{tripleReport?.persianDate || 'به‌روز'}</span></div>
                                </div>
                            </div>

                            {/* لایه ۲ */}
                            <div className="bg-slate-950/60 border border-white/5 p-5 rounded-3xl space-y-3 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
                                <div className="flex items-center justify-between">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-black text-sm">
                                        ۲
                                    </div>
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                        {tripleReport?.tiers[1]?.status === 'SYNCED' ? 'ثبت مستقل تأیید شد ✓' : tripleReport?.tiers[1]?.status === 'ERROR' ? 'خطای ذخیره' : 'پیاده‌سازی لازم است'}
                                    </span>
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-white">نسخه مستقل روی فایل‌سیستم</h4>
                                    <p className="text-[11px] text-slate-400 mt-1">
                                        نسخه جداگانه روی دیسک ویندوز یا پوشه خصوصی اندروید هنوز پیاده‌سازی نشده و موفق گزارش نمی‌شود
                                    </p>
                                </div>
                                <div className="pt-2 border-t border-white/5 text-[10px] text-slate-500 space-y-1 font-mono">
                                    <div>ایزولاسیون: <span className="text-indigo-400 font-bold">فعال (محیط محلی)</span></div>
                                    <div>آخرین همگامی: <span className="text-slate-300 font-sans">{tripleReport?.persianDate || 'به‌روز'}</span></div>
                                </div>
                            </div>

                            {/* لایه ۳ */}
                            <div className="bg-slate-950/60 border border-white/5 p-5 rounded-3xl space-y-3 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
                                <div className="flex items-center justify-between">
                                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-black text-sm">
                                        ۳
                                    </div>
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                        {tripleReport?.tiers[2]?.status === 'SYNCED' ? 'ذخیره سرور تأیید شد ✓' : tripleReport?.tiers[2]?.status === 'ERROR' ? 'ذخیره سرور ناموفق' : 'اتصال سرور فعال نیست'}
                                    </span>
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-white">نسخه پشتیبان سرور</h4>
                                    <p className="text-[11px] text-slate-400 mt-1">
                                        فقط پس از تأیید موفق API ثبت می‌شود؛ رمزگذاری بکاپ در حالت سکون هنوز فعال نشده است
                                    </p>
                                </div>
                                <div className="pt-2 border-t border-white/5 text-[10px] text-slate-500 space-y-1 font-mono">
                                    <div>یکپارچگی: <span className="text-purple-400 font-bold">SHA-256؛ انتقال امن با HTTPS</span></div>
                                    <div>آخرین همگامی: <span className="text-slate-300 font-sans">{tripleReport?.persianDate || 'به‌روز'}</span></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 1. Database Health & Collections Stats */}
            {activeTab === 'stats' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-[2.5rem] p-6 lg:p-8 shadow-2xl space-y-6">
                        <div>
                            <h3 className="text-white font-black text-base flex items-center gap-2">
                                <Sparkles size={18} className="text-amber-400" />
                                <span>سلامت ساختار و آمار رکوردهای فعال سیستم</span>
                            </h3>
                            <p className="text-[11px] text-slate-400 mt-1">نمای کلی از رکوردهای ثبت شده در هر جدول که در نسخه پشتیبان گنجانده می‌شوند.</p>
                        </div>

                        {/* Bento Grid layout of stats */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                            <StatCard label="فاکتورهای خرید و فروش" count={entityCounts.invoices} color="from-blue-500/10 to-transparent text-blue-400" />
                            <StatCard label="حواله‌ها و اسناد انبار" count={entityCounts.vouchers} color="from-teal-500/10 to-transparent text-teal-400" />
                            <StatCard label="کالاها و موجودی انبار" count={entityCounts.products} color="from-indigo-500/10 to-transparent text-indigo-400" />
                            <StatCard label="مشتریان و اشخاص" count={entityCounts.people} color="from-amber-500/10 to-transparent text-amber-400" />
                            <StatCard label="چک‌های صادر/دریافتی" count={entityCounts.checks} color="from-purple-500/10 to-transparent text-purple-400" />
                            <StatCard label="تراکنش‌های مالی" count={entityCounts.transactions} color="from-emerald-500/10 to-transparent text-emerald-400" />
                            <StatCard label="حقوق و دستمزد پرسنل" count={entityCounts.salaries} color="from-rose-500/10 to-transparent text-rose-400" />
                            <StatCard label="قراردادهای کاری" count={entityCounts.contracts} color="from-sky-500/10 to-transparent text-sky-400" />
                            <StatCard label="شرکت‌های ثبت‌شده" count={entityCounts.companies} color="from-cyan-500/10 to-transparent text-cyan-400" />
                            <StatCard label="شعب فعال مجموعه‌ها" count={entityCounts.branches} color="from-teal-500/10 to-transparent text-teal-400" />
                            <StatCard label="کاربران سیستم" count={entityCounts.users} color="from-slate-500/10 to-transparent text-slate-400" />
                            <StatCard label="نقش‌ها و سطوح دسترسی" count={entityCounts.roles} color="from-fuchsia-500/10 to-transparent text-fuchsia-400" />
                            <StatCard label="تنظیمات ورود اکسل" count={entityCounts.importConfigs} color="from-violet-500/10 to-transparent text-violet-400" />
                            
                            <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-900/30 to-slate-950 border border-indigo-500/10 flex flex-col justify-between">
                                <span className="text-[10px] text-indigo-300 font-black">مجموع رکوردهای فعال</span>
                                <span className="text-2xl font-mono font-black text-indigo-400 mt-2">{toPersianDigits(totalRecords.toLocaleString())}</span>
                            </div>
                        </div>

                        {/* Interactive triggers */}
                        <div className="flex flex-wrap gap-4 pt-4 border-t border-white/5">
                            <button
                                onClick={handleCreateLocalSnapshot}
                                className="flex-1 py-4 px-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2"
                            >
                                <HardDriveDownload size={16} />
                                <span>ثبت سریع بکاپ در حافظه مرورگر</span>
                            </button>
                            <button
                                onClick={handleHostBackup}
                                className="flex-1 py-4 px-6 bg-teal-600 hover:bg-teal-500 text-white rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2"
                            >
                                <Cloud size={16} />
                                <span>پشتیبان‌گیری ابری کامل (هاست)</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Desktop Settings */}
            {activeTab === 'desktop' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-[2.5rem] p-6 lg:p-8 shadow-2xl space-y-6">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <div>
                                <h3 className="text-white font-black text-base flex items-center gap-2">
                                    <Settings2 size={18} className="text-teal-400" />
                                    <span>تنظیم دایرکتوری ذخیره‌سازی و پشتیبان‌گیری ویندوز</span>
                                </h3>
                                <p className="text-[11px] text-slate-400 mt-1">
                                    پوشه را از پنجره ویندوز انتخاب کنید. بکاپ خودکار فقط پس از انتخاب واقعی پوشه و تأیید نوشتن فایل فعال می‌شود؛ فایل‌های محلی در حال حاضر رمزگذاری‌شده نیستند.
                                </p>
                            </div>
                            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-bold">
                                {isDesktopEnv ? (desktopBackupPath ? 'پوشه مستقل انتخاب شده' : 'پوشه مستقل انتخاب نشده') : 'ذخیره مستقل در این محیط غیرفعال'}
                            </span>
                        </div>
                        
                        <div className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700/50 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-2">مسیر محلی ذخیره خودکار بک‌آپ در ویندوز</label>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <input
                                        type="text"
                                        value={desktopBackupPath}
                                        readOnly
                                        placeholder="ابتدا روی «انتخاب پوشه» کلیک کنید"
                                        className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-teal-500 font-mono text-left"
                                        dir="ltr"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleSelectDesktopPath}
                                        className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-3 rounded-xl font-black text-xs transition-colors whitespace-nowrap shadow-lg shadow-teal-900/30 flex items-center justify-center gap-2"
                                    >
                                        <HardDrive size={15} />
                                        <span>انتخاب پوشه (Picker)</span>
                                    </button>
                                </div>
                            </div>

                            <p className="text-xs leading-relaxed text-slate-400">
                                واردکردن آدرس یا انتخاب مسیر پیشنهادی به‌تنهایی دسترسی فایل‌سیستم ایجاد نمی‌کند. برای فعال‌سازی ذخیره واقعی، از دکمه بالا پوشه را در پنجره امن ویندوز انتخاب کنید.
                            </p>

                            {/* Immediate Backup Action */}
                            <div className="pt-3 border-t border-slate-700/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                                <div className="text-[11px] text-slate-300 flex items-center gap-2">
                                    <ShieldCheck size={16} className="text-teal-400 shrink-0" />
                                    <span>نسخه مستقل در این پوشه فقط پس از تأیید نوشتن واقعی فایل ثبت می‌شود؛ در نبود پوشه، خروجی دستی دانلود خواهد شد.</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleFullBackupExport}
                                    disabled={localLoading}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-black text-xs transition flex items-center gap-2 shrink-0 shadow-md shadow-indigo-900/30"
                                >
                                    <Download size={14} />
                                    <span>ذخیره فوری نسخه پشتیبان در دیسک</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. Cloud Server Backups Management */}
            {activeTab === 'cloud' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-[2.5rem] p-6 lg:p-8 shadow-2xl">
                        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-white/5">
                            <div>
                                <h3 className="text-white font-black text-base flex items-center gap-2">
                                    <Cloud size={18} className="text-indigo-400" />
                                    <span>مدیریت نسخه‌های پشتیبان ابری (هاست)</span>
                                </h3>
                                <p className="text-[11px] text-slate-400 mt-1">لیست آخرین نسخه‌هایی که روی سرور مرکزی ذخیره شده‌اند (ظرفیت حداکثر ۷ نسخه).</p>
                            </div>
                            
                            <div className="flex gap-2">
                                <button 
                                    onClick={loadHostBackups} 
                                    disabled={loadingList}
                                    className="px-4 py-2 bg-slate-950 text-slate-400 border border-white/5 rounded-xl text-xs font-bold hover:text-white transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    {loadingList ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                                    <span>به‌روزرسانی لیست</span>
                                </button>
                                <button 
                                    onClick={handleHostBackup} 
                                    disabled={cloudLoading}
                                    className="px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-black hover:bg-teal-500 transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    {cloudLoading ? <Loader2 size={12} className="animate-spin" /> : <Cloud size={12} />}
                                    <span>ثبت بکاپ ابری جدید</span>
                                </button>
                            </div>
                        </div>

                        {loadingList ? (
                            <div className="py-12 flex flex-col items-center justify-center text-teal-400 animate-pulse">
                                <Loader2 size={36} className="animate-spin mb-3" />
                                <span className="text-xs font-black">در حال برقراری ارتباط با هاست مرکزی...</span>
                            </div>
                        ) : hostBackups.length === 0 ? (
                            <div className="py-12 text-center text-slate-500 border-2 border-dashed border-white/5 rounded-2xl">
                                <Database size={32} className="mx-auto mb-3 text-slate-600" />
                                <p className="text-xs font-bold">هیچ نسخه پشتیبانی روی هاست یافت نشد.</p>
                                <p className="text-[10px] text-slate-600 mt-1">با کلیک روی دکمه "ثبت بکاپ ابری جدید" اولین نسخه پشتیبان سرور خود را بسازید.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-right text-xs">
                                    <thead>
                                        <tr className="text-slate-500 border-b border-white/5 font-bold">
                                            <th className="pb-3 pr-2">عنوان نسخه پشتیبان</th>
                                            <th className="pb-3">تاریخ ایجاد (جلالی)</th>
                                            <th className="pb-3">حجم فایل</th>
                                            <th className="pb-3">نسخه برنامه</th>
                                            <th className="pb-3 text-center">ضمائم گرافیکی</th>
                                            <th className="pb-3 pl-2 text-left">عملیات</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {hostBackups.map((backup) => (
                                            <tr key={backup.id} className="text-slate-300 hover:bg-white/[0.02] transition-all">
                                                <td className="py-4 pr-2 font-black text-white flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                                                    <span>{backup.label}</span>
                                                </td>
                                                <td className="py-4 font-mono text-slate-400">{formatJalaliDate(backup.timestamp)}</td>
                                                <td className="py-4 font-mono text-slate-400">{formatSize(backup.size)}</td>
                                                <td className="py-4 font-mono text-slate-400">{backup.version || '14.0.0'}</td>
                                                <td className="py-4 text-center">
                                                    {backup.hasAssets ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-lg text-[9px] font-black border border-emerald-500/20">
                                                            <ShieldCheck size={10} />
                                                            لوگو و امضای شرکت
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-800 text-slate-500 rounded-lg text-[9px] font-bold">
                                                            بدون ضمیمه
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-4 pl-2 text-left">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => handleHostRestore(backup.id)}
                                                            disabled={actionLoadingId !== null}
                                                            className="px-3 py-1.5 bg-teal-500/10 hover:bg-teal-500 hover:text-white text-teal-400 rounded-xl font-bold transition-all flex items-center gap-1 disabled:opacity-50"
                                                        >
                                                            {actionLoadingId === backup.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                                                            <span>بازیابی</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleHostDelete(backup.id)}
                                                            disabled={actionLoadingId !== null}
                                                            className="p-1.5 bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-500 rounded-xl transition-all disabled:opacity-50"
                                                            title="حذف بکاپ"
                                                        >
                                                            {actionLoadingId === backup.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={14} />}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 3. Local IndexedDB Snapshots */}
            {activeTab === 'local_snap' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-[2.5rem] p-6 lg:p-8 shadow-2xl">
                        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-white/5">
                            <div>
                                <h3 className="text-white font-black text-base flex items-center gap-2">
                                    <HardDrive size={18} className="text-indigo-400" />
                                    <span>نسخه‌های پشتیبان سریع (سنسور مرورگر IndexedDB)</span>
                                </h3>
                                <p className="text-[11px] text-slate-400 mt-1">سریع‌ترین روش ثبت نسخه محلی در مرورگر فعلی شما، بدون نیاز به دانلود یا آپلود فایل.</p>
                            </div>
                            
                            <div className="flex gap-2">
                                <button 
                                    onClick={loadLocalSnapshots} 
                                    disabled={loadingLocalList}
                                    className="px-4 py-2 bg-slate-950 text-slate-400 border border-white/5 rounded-xl text-xs font-bold hover:text-white transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    {loadingLocalList ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                                    <span>به‌روزرسانی لیست</span>
                                </button>
                                <button 
                                    onClick={handleCreateLocalSnapshot} 
                                    disabled={localLoading}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black hover:bg-indigo-500 transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    {localLoading ? <Loader2 size={12} className="animate-spin" /> : <HardDriveDownload size={12} />}
                                    <span>ثبت پشتیبان سریع جدید</span>
                                </button>
                            </div>
                        </div>

                        {loadingLocalList ? (
                            <div className="py-12 flex flex-col items-center justify-center text-indigo-400 animate-pulse">
                                <Loader2 size={36} className="animate-spin mb-3" />
                                <span className="text-xs font-black">در حال بازیابی رکوردهای IndexedDB...</span>
                            </div>
                        ) : localSnapshots.length === 0 ? (
                            <div className="py-12 text-center text-slate-500 border-2 border-dashed border-white/5 rounded-2xl">
                                <HardDrive size={32} className="mx-auto mb-3 text-slate-600" />
                                <p className="text-xs font-bold">هیچ نسخه پشتیبانی در مرورگر فعلی یافت نشد.</p>
                                <p className="text-[10px] text-slate-600 mt-1">با کلیک روی دکمه "ثبت پشتیبان سریع جدید" اولین کپی محلی خود را بسازید.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-right text-xs">
                                    <thead>
                                        <tr className="text-slate-500 border-b border-white/5 font-bold">
                                            <th className="pb-3 pr-2">عنوان نسخه محلی</th>
                                            <th className="pb-3">تاریخ ایجاد (جلالی)</th>
                                            <th className="pb-3">حجم تقریبی داده</th>
                                            <th className="pb-3 pr-4 text-left">عملیات</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {localSnapshots.map((snap) => (
                                            <tr key={snap.id} className="text-slate-300 hover:bg-white/[0.02] transition-all">
                                                <td className="py-4 pr-2 font-black text-white flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                    <span>{snap.label || `پشتیبان سریع محلی - ID ${snap.id}`}</span>
                                                </td>
                                                <td className="py-4 font-mono text-slate-400">{formatJalaliDate(snap.timestamp)}</td>
                                                <td className="py-4 font-mono text-slate-400">{formatSize(snap.size || JSON.stringify(snap).length)}</td>
                                                <td className="py-4 text-left">
                                                    <div className="flex justify-end gap-2 pr-4">
                                                        <button
                                                            onClick={() => handleLocalSnapshotRestore(snap.id)}
                                                            disabled={actionLoadingId !== null}
                                                            className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500 hover:text-white text-indigo-400 rounded-xl font-bold transition-all flex items-center gap-1 disabled:opacity-50"
                                                        >
                                                            {actionLoadingId === snap.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                                                            <span>بازیابی کپی</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleLocalSnapshotDelete(snap.id)}
                                                            disabled={actionLoadingId !== null}
                                                            className="p-1.5 bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-500 rounded-xl transition-all disabled:opacity-50"
                                                            title="حذف نسخه"
                                                        >
                                                            {actionLoadingId === snap.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={14} />}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 4. Import / Export JSON Files with Drag and Drop */}
            {activeTab === 'file' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Export side */}
                        <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-[2.5rem] p-6 lg:p-8 shadow-2xl flex flex-col justify-between space-y-6">
                            <div>
                                <h4 className="text-white font-black text-sm flex items-center gap-2">
                                    <FileDown className="text-indigo-400 animate-bounce" size={18} />
                                    <span>خروجی و دانلود فایل پشتیبان (امضا شده)</span>
                                </h4>
                                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                                    یک فایل با فرمت JSON دانلود خواهید کرد که شامل کلیه پایگاه‌داده‌ها، حساب‌ها، شعب، کالاها، عکس لوگوها، امضاها، مهرها و غیره است.
                                    این فایل حاوی امضای یکتای امنیتی سیستم بوده و اصالت آن هنگام بازیابی بررسی خواهد شد.
                                </p>
                            </div>

                            <div className="bg-slate-950 p-4 rounded-2xl border border-white/5 space-y-2">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-500">حجم حدودی فایل خروجی:</span>
                                    <span className="text-indigo-400 font-mono font-bold">{formatSize(JSON.stringify(useStore.getState()).length)}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-500">حفاظت رمزنگاری:</span>
                                    <span className="text-emerald-400 font-black flex items-center gap-1">
                                        <ShieldCheck size={14} /> امضا شده فعال
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={handleFullBackupExport}
                                disabled={localLoading}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm py-4 rounded-2xl shadow-xl hover:shadow-indigo-600/10 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                {localLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                <span>دانلود مستقیم فایل پشتیبان (.json)</span>
                            </button>
                        </div>

                        {/* Import side */}
                        <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-[2.5rem] p-6 lg:p-8 shadow-2xl flex flex-col justify-between space-y-6">
                            <div>
                                <h4 className="text-white font-black text-sm flex items-center gap-2">
                                    <FileUp className="text-amber-500" size={18} />
                                    <span>بازیابی و مهاجرت اطلاعات از فایل پشتیبان</span>
                                </h4>
                                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                                    با بارگذاری فایل پشتیبان، اصالت امنیتی فایل بررسی شده و در صورت نیاز ساختار فاکتورها، کالاها و تراکنش‌های قدیمی با الگوریتم‌های هوشمند به آخرین فرمت استاندارد نسخه جدید ارتقا می‌یابند.
                                </p>
                            </div>

                            <div 
                                className={`h-40 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                                    dragOver ? 'border-teal-500 bg-teal-500/10 text-teal-400' : 'border-white/10 hover:border-teal-500 text-slate-400 hover:text-white'
                                }`}
                                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={handleDrop}
                                onClick={() => document.getElementById('restore_file_input')?.click()}
                            >
                                <Upload size={28} className={dragOver ? 'animate-bounce' : ''} />
                                <span className="text-xs font-black text-center px-4 leading-relaxed">
                                    کاپرا، فایل پشتیبان (.json) خود را به اینجا بکشید یا جهت انتخاب کلیک کنید
                                </span>
                                <input 
                                    id="restore_file_input" 
                                    type="file" 
                                    accept=".json" 
                                    onChange={handleFileChange} 
                                    className="hidden" 
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'sync' && (
                <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
                    <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-[2.5rem] p-6 lg:p-8 shadow-2xl space-y-6">
                        <div className="text-center mb-4">
                            <div className="w-16 h-16 bg-teal-500/15 border border-teal-500/20 rounded-2xl flex items-center justify-center text-teal-400 mx-auto mb-3">
                                <Server size={32} />
                            </div>
                            <h3 className="text-white font-black text-lg">پیکربندی استراتژی ذخیره‌سازی داده‌ها</h3>
                            <p className="text-slate-400 text-xs mt-1">تعیین اولویت ذخیره‌سازی ابری روی هاست مرکزی یا حافظه لوکال مرورگر</p>
                        </div>

                        {/* Connection Status block */}
                        <div className="flex justify-between items-center p-4 bg-slate-950 rounded-2xl border border-white/5">
                            <span className="text-white font-bold text-xs">وضعیت آنلاین بودن شبکه</span>
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black ${smartStorage.getStatus().isOnline ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/10' : 'bg-rose-500/20 text-rose-400 border border-rose-500/10'}`}>
                                {smartStorage.getStatus().isOnline ? <Wifi size={14}/> : <WifiOff size={14}/>}
                                {smartStorage.getStatus().isOnline ? 'اتصال پایدار (آنلاین)' : 'عدم اتصال (آفلاین)'}
                            </div>
                        </div>

                        {/* Storage Mode Selector block */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-white font-bold text-sm flex items-center gap-2">
                                    <Database size={16} className="text-indigo-400"/> انتخاب حالت فعال دیتابیس
                                </h4>
                                {syncStatus.pendingSync > 0 && (
                                    <button 
                                        onClick={handleProcessSync}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/35 text-amber-400 rounded-lg text-[10px] font-black border border-amber-500/20 transition-all animate-pulse"
                                    >
                                        <RefreshCw size={12} className="animate-spin" />
                                        همگام‌سازی فوری ({toPersianDigits(syncStatus.pendingSync.toString())} سند معلق)
                                    </button>
                                )}
                            </div>
                            
                            <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-white/5">
                                <button 
                                    onClick={() => handleStorageModeChange('HOST')}
                                    className={`flex-grow py-3.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                                        storageMode === 'HOST' 
                                            ? 'bg-teal-600 text-white shadow-lg' 
                                            : 'text-slate-500 hover:text-slate-300'
                                    }`}
                                >
                                    <Server size={14} />
                                    هاست مرکزی (Host-First)
                                </button>
                                <button 
                                    onClick={() => handleStorageModeChange('LOCAL')}
                                    className={`flex-grow py-3.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                                        storageMode === 'LOCAL' 
                                            ? 'bg-indigo-600 text-white shadow-lg' 
                                            : 'text-slate-500 hover:text-slate-300'
                                    }`}
                                >
                                    <HardDrive size={14} />
                                    لوکال مرورگر (Local-Only)
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs mt-2">
                                <div className="bg-slate-950/70 p-4 rounded-xl border border-white/5">
                                    <div className="text-slate-500 mb-1">نوع ذخیره‌سازی فعال</div>
                                    <div className="text-white font-black">{storageMode === 'HOST' ? 'هاست ابری (همگام‌ساز خودکار)' : 'آفلاین/محلی (فقط در این دستگاه)'}</div>
                                </div>
                                <div className="bg-slate-950/70 p-4 rounded-xl border border-white/5">
                                    <div className="text-slate-500 mb-1">تعداد رکوردهای معلق در صف انتظار سینک</div>
                                    <div className={`font-black ${syncStatus.pendingSync > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                        {toPersianDigits(syncStatus.pendingSync.toString())} آیتم
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2 text-xs leading-relaxed text-slate-400">
                                <p className="font-bold text-white mb-1">تفاوت حالت‌ها:</p>
                                <p>• <strong className="text-teal-400">حالت هاست (پیش‌فرض):</strong> بالاترین امنیت؛ تمامی اسناد، فاکتورها و چک‌ها به صورت بلادرنگ در سرور مطمئن هاست شخصی شما ذخیره شده و در صورت نبود شبکه، به شکل خودکار صف‌آرایی و پس از اولین اتصال مجدد همگام می‌شوند.</p>
                                <p>• <strong className="text-indigo-400">حالت لوکال:</strong> داده‌ها به صورت صددرصد آفلاین فقط روی همین مروگر باقی مانده و بر روی اینترنت یا هاست ذخیره نخواهند شد (مناسب حسابداری آزمایشی یا حریم خصوصی کامل).</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'diagnostics' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-[2.5rem] p-6 lg:p-8 shadow-2xl space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/5">
                            <div>
                                <h3 className="text-white font-black text-base flex items-center gap-2">
                                    <Activity size={18} className="text-indigo-400 animate-pulse" />
                                    <span>عیب‌یابی، سلامت‌سنجی و پایش وب‌سرویس‌ها</span>
                                </h3>
                                <p className="text-[11px] text-slate-400 mt-1">تست جامع کانال‌های ارتباطی، پرفورمنس هاست، مجوزهای نوشتن و سلامت پایگاه‌های داده محلی.</p>
                            </div>
                            
                            <button
                                onClick={runDiagnosticsSuite}
                                disabled={diagTesting}
                                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                <RefreshCw size={14} className={diagTesting ? 'animate-spin' : ''} />
                                <span>{diagTesting ? 'در حال اجرای تست...' : 'اجرای عیب‌یابی جامع'}</span>
                            </button>
                        </div>

                        {/* Last tested info */}
                        {diagLastTest && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-500 font-bold">
                                <Clock size={12} />
                                <span>آخرین پایش خودکار: {diagLastTest}</span>
                            </div>
                        )}

                        {/* Diagnostics suite list */}
                        <div className="space-y-3">
                            {diagResults.map((result, idx) => (
                                <div key={idx} className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                                    result.status === 'success' ? 'bg-emerald-500/5 border-emerald-500/10' :
                                    result.status === 'warning' ? 'bg-amber-500/5 border-amber-500/10' : 'bg-rose-500/5 border-rose-500/10'
                                }`}>
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-0.5 ${
                                            result.status === 'success' ? 'text-emerald-400' :
                                            result.status === 'warning' ? 'text-amber-400' : 'text-rose-400'
                                        }`}>
                                            {result.status === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                                        </div>
                                        <div>
                                            <div className="text-white text-xs font-black">{result.name}</div>
                                            <div className="text-slate-500 text-[10px] mt-1">{result.details}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 self-end md:self-auto font-mono text-xs">
                                        {result.latency && <span className="text-slate-600">{toPersianDigits(result.latency.toString())}ms</span>}
                                        <span className={`font-black text-[11px] ${
                                            result.status === 'success' ? 'text-emerald-400' :
                                            result.status === 'warning' ? 'text-amber-400' : 'text-rose-400'
                                        }`}>{result.message}</span>
                                    </div>
                                </div>
                            ))}

                            {diagResults.length === 0 && (
                                <div className="py-8 text-center text-slate-600 border border-dashed border-white/5 rounded-2xl">
                                    <Cpu size={24} className="mx-auto mb-2 text-slate-700" />
                                    <span className="text-[10px] font-bold">هیچ تست عیبی‌یابی اجرا نشده است. بر روی دکمه اجرای عیب‌یابی جامع در بالا کلیک کنید.</span>
                                </div>
                            )}
                        </div>

                        {/* Database individual tables connection status */}
                        <div className="space-y-4 pt-4 border-t border-white/5">
                            <h4 className="text-white font-black text-xs flex items-center gap-2">
                                <Code size={14} className="text-teal-400" />
                                <span>تست انفرادی درگاه‌های ورودی جداول دیتابیس هاست</span>
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {['invoices', 'products', 'people', 'vouchers', 'checks', 'transactions', 'companies', 'users'].map((tbl) => {
                                    const isTestingThis = diagWriteTestTable === tbl;
                                    return (
                                        <div key={tbl} className="bg-slate-950 p-4 rounded-xl border border-white/5 flex flex-col justify-between h-24">
                                            <div className="text-slate-400 text-[10px] font-mono text-center font-bold">{tbl}</div>
                                            <button
                                                onClick={() => testTableEndpoint(tbl)}
                                                disabled={diagWriteTestTable !== null}
                                                className={`w-full py-1.5 rounded-lg text-[10px] font-black transition-all ${
                                                    isTestingThis && diagWriteTestStatus === 'testing' ? 'bg-amber-600 text-white' :
                                                    isTestingThis && diagWriteTestStatus === 'success' ? 'bg-emerald-600 text-white' :
                                                    isTestingThis && diagWriteTestStatus === 'failed' ? 'bg-rose-600 text-white' :
                                                    'bg-indigo-600/30 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/10 hover:border-transparent'
                                                } disabled:opacity-50`}
                                            >
                                                {isTestingThis && diagWriteTestStatus === 'testing' ? 'درحال پینگ...' :
                                                 isTestingThis && diagWriteTestStatus === 'success' ? '✓ موفق' :
                                                 isTestingThis && diagWriteTestStatus === 'failed' ? '✗ ناموفق' : 'پینگ هاست'}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Host files logs / list */}
                        <div className="space-y-4 pt-4 border-t border-white/5">
                            <div className="flex justify-between items-center">
                                <h4 className="text-white font-black text-xs flex items-center gap-2">
                                    <FileText size={14} className="text-amber-500" />
                                    <span>فایل‌های گزارش و دیتای ذخیره‌شده بر روی هاست</span>
                                </h4>
                                <span className="text-[10px] text-slate-500 font-bold">{toPersianDigits(diagHostFiles.length.toString())} فایل ثبت‌شده</span>
                            </div>

                            {diagHostFiles.length === 0 ? (
                                <p className="text-[10px] text-slate-500 text-center py-4 bg-slate-950/30 rounded-xl border border-white/5">لیست فایل‌های ثبت‌شده در هاست خالی یا غیرقابل دسترسی است.</p>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                                    {diagHostFiles.map((f, idx) => (
                                        <div key={idx} className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-white/5 text-xs">
                                            <div className="flex items-center gap-2 truncate">
                                                <FileText size={14} className="text-slate-500 shrink-0" />
                                                <div className="truncate text-right">
                                                    <div className="text-white font-black truncate">{f.name}</div>
                                                    <div className="text-[9px] text-slate-500 font-mono mt-0.5">{toPersianDigits((f.size / 1024).toFixed(1))} KB - {f.modified}</div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => viewDiagFile(f.name)}
                                                disabled={diagFileLoading}
                                                className="p-1.5 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-lg transition-all"
                                                title="مشاهده محتوا"
                                            >
                                                {diagFileLoading && diagSelectedFile === f.name ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* File content viewer modal */}
                    {diagSelectedFile && (
                        <div className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" dir="rtl">
                            <div className="bg-slate-900 border border-white/10 w-full max-w-4xl max-h-[80vh] rounded-[2rem] p-6 overflow-hidden flex flex-col shadow-2xl">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-white font-black text-sm flex items-center gap-2">
                                        <FileText size={16} className="text-teal-400" />
                                        <span>مشاهده فایل هاست: {diagSelectedFile}</span>
                                    </h3>
                                    <button 
                                        onClick={() => { setDiagSelectedFile(null); setDiagFileContent(null); }}
                                        className="p-2 bg-white/5 rounded-full text-slate-400 hover:text-white transition-all"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-950 p-4 rounded-xl border border-white/5">
                                    <pre className="text-slate-300 text-[10px] font-mono whitespace-pre-wrap text-left" dir="ltr">
                                        {typeof diagFileContent === 'object' ? JSON.stringify(diagFileContent, null, 2) : diagFileContent}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 5. Complete factory Reset */}
            {activeTab === 'reset' && (
                <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
                    <div className="bg-rose-500/5 p-6 rounded-[2.5rem] border border-rose-500/10 space-y-6 shadow-2xl">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-rose-500/25 border border-rose-500/35 text-rose-400 rounded-2xl flex items-center justify-center">
                                <ShieldAlert size={24} className="animate-bounce" />
                            </div>
                            <div>
                                <h4 className="text-rose-200 font-black text-sm">پاکسازی کلی دیتابیس و ریست سیستم</h4>
                                <p className="text-[10px] text-rose-300/60 mt-1">بازگشت کامل برنامه به حالت خام اولیه روز اول</p>
                            </div>
                        </div>

                        <div className="bg-rose-950/20 p-5 rounded-2xl border border-rose-500/10 text-xs text-rose-300 leading-relaxed space-y-2">
                            <p className="font-black text-sm flex items-center gap-1 mb-2">
                                <AlertTriangle size={14} className="text-rose-400" />
                                <span>هشدار بسیار مهم: این عملیات ۱۰۰٪ غیرقابل بازگشت است!</span>
                            </p>
                            <p>• تمامی فاکتورها، انبارگردانی‌ها، کالاها، مشتریان، بدهکاری‌ها و بستانکاری‌ها حذف می‌شوند.</p>
                            <p>• تمام چک‌ها، تراکنش‌ها و شعب تعریف شده حذف می‌گردند.</p>
                            <p>• لوگوها، امضاها، مهرها و داده‌های ذخیره شده در مرورگر شما به طور کامل پاکسازی خواهند شد.</p>
                            <p>• توصیه می‌شود پیش از شروع، یک بار خروجی فایل پشتیبان (.json) دریافت کنید.</p>
                        </div>

                        {!showWipeConfirm ? (
                            <button
                                onClick={() => setShowWipeConfirm(true)}
                                className="w-full bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 hover:border-transparent py-4 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2"
                            >
                                <Trash2 size={14} />
                                <span>آماده‌سازی برای فکتوری ریست سیستم</span>
                            </button>
                        ) : (
                            <div className="space-y-4 p-4 bg-slate-950 rounded-2xl border border-white/5 animate-fade-in">
                                <p className="text-xs font-black text-amber-400 leading-relaxed">
                                    تایید نهایی: لطفا عبارت <strong className="font-mono text-rose-400 select-all">WIPE</strong> را به صورت دقیق با حروف بزرگ وارد کنید تا دکمه ریست فعال شود:
                                </p>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={wipeInput} 
                                        onChange={e => setWipeInput(e.target.value)} 
                                        placeholder="WIPE" 
                                        className="flex-1 bg-slate-900 border border-white/10 rounded-xl p-3 text-white text-center font-mono font-black outline-none focus:border-rose-500"
                                    />
                                    <button
                                        onClick={handleHardResetSystem}
                                        disabled={wipeInput !== 'WIPE'}
                                        className="bg-rose-600 disabled:bg-slate-800 text-white disabled:text-slate-500 px-6 rounded-xl text-xs font-black transition-all"
                                    >
                                        انجام ریست نهایی
                                    </button>
                                    <button
                                        onClick={() => { setShowWipeConfirm(false); setWipeInput(''); }}
                                        className="bg-slate-900 text-slate-400 border border-white/5 px-4 rounded-xl text-xs font-bold hover:text-white"
                                    >
                                        انصراف
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// Help sub-component for stats card
const StatCard = ({ label, count, color }: { label: string; count: number; color: string }) => {
    return (
        <div className={`p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all bg-gradient-to-br ${color}`}>
            <div className="text-[10px] text-slate-400 font-bold leading-relaxed">{label}</div>
            <div className="text-xl font-mono font-black mt-2">{toPersianDigits(count.toString())}</div>
        </div>
    );
};

// Simple background service helper inside store
const backupService = {
    async backupData(type: string, data: any): Promise<boolean> {
        try {
            const baseUrl = window.location.hostname === 'localhost' ? '' : window.location.origin;
            const response = await fetch(`${baseUrl}/backup-system.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'backup_data', type, payload: data })
            });
            const result = await response.json();
            return !!result.success;
        } catch {
            return false;
        }
    }
};

export default BackupManager;
