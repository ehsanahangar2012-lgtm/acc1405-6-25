# ممیزی پایه مهاجرت نسخهٔ بومی Windows

تاریخ snapshot: ۲۰ اکتبر ۲۰۲۶  
مخزن خصوصی: ehsanahangar2012-lgtm/acc1405-6-25  
شاخه مبنا: fix/core-data-integrity  
کامیت مبنا: 352c4401c8be3c4ae2e2d2bf6e520988d968324a  
پیام کامیت: build: allow installable APK without commercial signing certificate  
شاخه مستقل ایجادشده: feature/windows-native-dotnet (از SHA بالا)  
شاخه پیش‌فرض main در زمان بررسی روی fb8b0d9c108dc50c050a8f545ab35ef7bd0cb887 بود و تغییر داده نشده است.

## ساختار واقعی و ابزارها
- برنامه فعلی عمدتاً SPA مبتنی بر React 19، TypeScript، Vite و Zustand است؛ وابستگی‌های دیگر شامل Capacitor 8 و Electron 44 هستند.
- اسکریپت‌های package.json شامل build وب، APK و build/installer/portable ویندوز مبتنی بر Electron هستند. محیط توسعه ریشه Node.js 22 و Bun را مستند می‌کند.
- پوشه electron شامل main.cjs و preload.cjs است؛ scripts/build-windows.js بسته‌بندی Electron را مدیریت می‌کند.
- windows-native از قبل وجود داشت و شامل main.cpp، CMakeLists.txt، build-native.bat و AshkeGhalamLauncher.cs است. main.cpp صراحتاً از Microsoft Edge WebView2 استفاده می‌کند؛ این مسیر خواستهٔ WPF بدون WebView را برآورده نمی‌کند و دست‌نخورده می‌ماند.
- در snapshot مبنا، پروژهٔ WPF یا csproj/sln مرتبط با نسخهٔ جدید وجود نداشت.
- workflow موجود مشاهده‌شده در مبنا .github/workflows/build-apk.yml بود. این workflow بررسی package وب، type-check، آزمون رمزنگاری بک‌آپ، syntax برخی PHP APIها، آزمون چرخهٔ لایسنس و بررسی بستهٔ هاست را اجرا می‌کند.
- API وضعیت ترکیبی GitHub برای SHA مبنا status check ثبت‌شده‌ای برنگرداند؛ این مدرک موفقیت یا شکست CI نیست. ساخت واقعی EXE در این مرحلهٔ ممیزی انجام نشده است.

## فهرست قابلیت‌ها از فایل‌های موجود
فهرست نام فایل، تأیید اجرای قابل انتشار نیست. فایل‌های pages شامل این حوزه‌ها هستند:

- عملیات اصلی: Dashboard، Invoices، Customers، Inventory، Checks، Finance، Reports، FiscalYear.
- حسابداری/مالی: DoubleEntryAccounting، CashFlowManagement، CashFlowPredictor، BankReconciliation، BudgetManagement، FixedAssetsManagement، LoanManagement، MultiCurrencyManagement، AdvancedFinancialReports، TaxManagement، MoadianTaxHub.
- سازمانی و تجاری: ProjectManagement، Contracts، PosTerminalManagement، MarketingHub، SmsMarketingHub، CatalogPage، MobileCatalog، SlaSupportContracts، MultiUserLanHub.
- کاربران و ابزارها: Users، Settings، AdvancedSettings، Help، ImportCenter، DataSyncManager، UpdateCenter، DebugCenter، DebugCenterUnavailable.
- لایسنس/استقرار: LicenseManager، LicenseManagerUnavailable، InstallAndroid، InstallAndroidClient.
- امضا: SignatureManagement، SignatureManagementDashboard، RemoteSignaturePage، SimpleSignaturePage.
- ابری/هوش مصنوعی: CloudBackupVault، AIFinancialAssistant.
- کامپوننت‌های دیگر شامل تقویم سررسید، مدیریت گردش‌کار، چاپ فاکتور/حواله، Excel import/export، اعلان‌ها و ابزارهای sync هستند.

### مدل‌ها و سرویس‌های مهم
- store.ts، store-financial.ts، store-marketing.ts و types*.ts: وضعیت و مدل‌های TypeScript.
- services/accountingEngine.ts: منطق محاسبات حسابداری؛ انتقال آن باید با آزمون‌های رفتاری مرجع انجام شود.
- authService.ts، securityService.ts، rbacService.ts: ورود محلی، اعتبارسنجی رمز و قواعد دسترسی سمت رابط.
- indexedDBService.ts، persistentStorage.ts، unifiedStorageService.ts، desktopDatabaseService.ts: ذخیره‌سازی محلی/دسکتاپ.
- workspaceService.ts، serverLicenseReceiptService.ts، licenseQuotaService.ts، hardwareIdService.ts: workspace، رسید لایسنس، سهمیه و شناسه دستگاه.
- smartSyncService.ts، autoSyncService.ts، crossDeviceSync.ts، syncQueueService.ts، realtimeSyncService.ts، companyHostSyncService.ts: همگام‌سازی و صف آفلاین.
- hostBackupService.ts، backupEncryptionService.ts، backupMigrationService.ts، recoveryService.ts و tripleBackupService.ts: پشتیبان‌گیری/بازیابی.
- سایر سرویس‌ها شامل امضای دیجیتال، مالیات، نرخ ارز، گزارش، پیامک، پرداخت، اعلان و ورود/خروج داده‌اند.

## APIهای سمت سرور شناسایی‌شده
مرجع لایسنس در config.ts برابر https://acc.ashkghalam.ir تعریف شده است. فایل‌های PHP موجود در host-backend عبارت‌اند از:

- هویت و لایسنس: tenant-manager.php، license_validator.php.
- داده و فضای کاری: host-api.php، host-storage-api.php، storage.php، api.php، get-base-url.php، health.php.
- بک‌آپ/بازیابی: server-api-backup.php، backup-system.php، recovery-api.php، backup-signatures.php، daily-cron.php.
- بارگذاری و حسابرسی: server-api-upload.php، audit-trail-api.php، deleted-records-api.php.
- امضا/گواهی: digital-signature-api.php، digital-signature-db.php، remote-signature-api.php، signature-api-simple.php، signature-api.php، certificate-api.php، digital-signature-config.php.
- دیگر: gemini-api.php، marketing-api.php، sms-helper.php، install.php، setup-check.php، setup-folders.php، server-api-database.php.

وجود فایل به‌معنی مجاز یا فعال بودن endpoint در هاست نیست. سند LICENSE-SECURITY-DEPLOYMENT.md اعلام می‌کند برخی مسیرهای قدیمی 403 یا 410 می‌دهند و برخی عملیات بک‌آپ فقط برای CLI هستند. پیش از اتصال WPF باید request/response و وضعیت استقرار هر API از سورس و آزمون قرارداد بازبینی شود. ابزار صدور لایسنس، registry مدیریتی و راز مدیر نسخهٔ مادر نباید در نسخهٔ مشتری ویندوز حضور داشته باشند.

### لایسنس
- serverLicenseReceiptService.ts رسید سرور را با RSASSA-PKCS1-v1_5-SHA256 بررسی می‌کند؛ payload شامل issuer، workspace، hash کلید لایسنس، HWID، طرح، سهمیه‌ها و انقضاست.
- مسیرهای دیده‌شده شامل tenant-manager.php?action=public_key و POST با action=verify_license هستند.
- در C# باید بایت‌های دقیق signed_payload پیش از parse شدن با RSA-SHA256 بررسی شوند. تصمیم نهایی مجوزدهی، ابطال و سهمیه برای عملیات حساس باید در سرور باقی بماند؛ تأیید رسید در کلاینت جای کنترل مجوز سرور را نمی‌گیرد.

### بک‌آپ و بازیابی
- hostBackupService.ts بک‌آپ محلی و ابری را مدیریت می‌کند و آپلود سرور فقط وقتی فعال است که قابلیت رمزنگاری در حالت سکون با AES-256-GCM اعلام شود.
- backupEncryptionService.ts فرمت ASHKEGHALAM_ENCRYPTED_BACKUP_V1 را با AES-256-CBC، HMAC-SHA256 و PBKDF2-SHA256 با ۳۱۰٬۰۰۰ دور پیاده‌سازی می‌کند. این فایل بک‌آپ را محافظت می‌کند، نه لزوماً پایگاه دادهٔ زنده را.
- backupService.backupData() عمداً false برمی‌گرداند تا دادهٔ حساس به endpoint قدیمی با JSON رمزنگاری‌نشده ارسال نشود؛ این متد قابلیت بک‌آپ فعال محسوب نمی‌شود.
- آزمون test:backup-encryption تنها بخشی از رفتار رمزنگاری فایل را پوشش می‌دهد؛ بازیابی واقعی روی دستگاه و بک‌آپ هاست زنده هنوز نیازمند آزمون جداست.

## ریسک‌های تأییدشده برای طراحی
1. services/authService.ts یک کلید AES ثابت در کد مشتری دارد. این الگو را نباید به C# منتقل کرد؛ کلیدی که در برنامهٔ توزیع‌شده باشد خزانهٔ امن اسرار نیست.
2. احراز هویت محلی از فهرست کاربران، با مجوزهای سرور برای داده‌های ابری فرق دارد. RBAC سمت رابط به‌تنهایی مرز امنیتی نیست.
3. سرویس‌های فعلی از Electron preload، برخی APIهای فایل و LocalStorage/IndexedDB استفاده می‌کنند؛ نسخهٔ WPF باید دسترسی فایل و اسرار را بومی و مستقل پیاده‌سازی کند.
4. HWID فعلی بسته به Electron/Android/browser مسیرهای متفاوت دارد. شناسهٔ Windows باید در برابر نصب مجدد، تغییر سخت‌افزار و حریم خصوصی آزموده شود؛ HWID به‌تنهایی راز رمزنگاری نیست.
5. تاریخ جلالی، اعداد فارسی/عربی، دقت و گردکردن پول، مالیات، مانده‌گیری، شناسهٔ رکورد، حذف و تعارض sync نیازمند سناریوهای مرجع هستند.
6. بخشی از توضیحات معماری ریشه قدیمی است؛ کد و endpointهای فعال باید بررسی شوند، نه این‌که متن مستند قدیمی بدون تأیید به قرارداد تبدیل شود.
7. مستند امنیت موجود تصریح می‌کند آزمایش‌های محلی اثبات استقرار امن روی acc.ashkghalam.ir نیستند؛ آزمون واقعی هاست و ارسال SMS/email جداگانه لازم است.

## وضعیت مهاجرت
| بخش | وضعیت |
|---|---|
| ممیزی ساختار/شاخه مبنا | اصلاح شده ولی نیازمند آزمون واقعی دستگاه/هاست |
| ایجاد شاخهٔ مستقل | اصلاح شده ولی نیازمند آزمون واقعی دستگاه/هاست |
| پوسته WPF و سیاست HTTPS | باز تا پایان CI |
| ورود/احراز هویت | باز |
| لایسنس و HWID | باز |
| قواعد حسابداری و مدل داده | باز |
| API و sync | باز |
| ذخیره‌سازی محلی و مهاجرت داده | باز |
| بک‌آپ و بازیابی واقعی | باز |
| نصب‌کننده و امضای ناشر | باز |

هیچ قابلیت حسابداری یا امنیتی صرفاً به دلیل وجود فایل/کلاس، تکمیل‌شده اعلام نشده است. آزمون واقعی روی Windows و هاست زنده هنوز تأیید نشده‌اند.
