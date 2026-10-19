# راهنمای آماده‌سازی امضای تجاری اشک قلم

## وضعیت و رفتار خط لوله

- کامیت‌ها و Pull Requestها از محیط `ci` استفاده می‌کنند و فقط خروجی آزمایشی می‌سازند.
- فقط تگ نسخه‌ای با الگوی `v*` از محیط `commercial-signing` به اسرار امضا دسترسی می‌گیرد.
- قبل از ساخت Release، workflow امضای APK را بررسی می‌کند و fingerprint را با متغیر تأییدشده مقایسه می‌کند؛ فایل Windows برای تحویل دستی جداگانه ساخته می‌شود و امضای Authenticode آن اختیاری است.
- خروجی GitHub Release ابتدا به‌صورت **Draft** ساخته می‌شود؛ پس از بازبینی، باید دستی منتشر شود.
- تا وقتی محیط‌ها، کلیدها و متغیرهای امضا آماده و آزمایش نشده‌اند، تگ انتشار نسازید.

## ۱. ساخت کلید امضای Android (روی رایانه خودتان)

در PowerShell ویندوز، با نصب بودن JDK، اجرا کنید:

```powershell
$Keystore = Join-Path $HOME 'AshkeGhalam-Android-Release.jks'
keytool -genkeypair -v -keystore $Keystore -storetype JKS -alias ashkghalam-release -keyalg RSA -keysize 2048 -validity 10000
```

- رمز keystore و رمز کلید را در prompt وارد کنید؛ آن‌ها را در فرمان، فایل متنی، چت یا Git ذخیره نکنید.
- اطلاعات صاحب گواهی را درست و متناسب با هویت ناشر وارد کنید.
- کلید و رمزها را در محل امن آفلاین پشتیبان‌گیری کنید. گم‌شدن این کلید می‌تواند امکان ارائه به‌روزرسانی روی نسخه‌های نصب‌شده را از بین ببرد.
- fingerprint گواهی را استخراج و بدون تغییر نگه دارید:

```powershell
keytool -list -v -keystore $Keystore -alias ashkghalam-release
```

مقدار مقابل `SHA256:` را بردارید. برای متغیر `ANDROID_SIGNER_SHA256` دو‌نقطه‌ها را حذف کنید؛ ۶۴ رقم هگزادسیمال باقی می‌ماند.

فایل keystore را Base64 کنید تا بتوان آن را به GitHub Environment Secret داد:

```powershell
$Base64File = Join-Path $env:TEMP 'ashkghalam-android-keystore-base64.txt'
[IO.File]::WriteAllText($Base64File, [Convert]::ToBase64String([IO.File]::ReadAllBytes($Keystore)), [Text.Encoding]::ASCII)
```

محتوای این فایل، کلید خصوصی رمزگذاری‌شده است؛ آن را در مخزن commit نکنید و در گفتگو ارسال نکنید.

## ۲. Windows: توزیع دستی و بدون الزام گواهی

نسخه ویندوز برای فروش مستقیم و تحویل دستی فایل است؛ **در GitHub Release عمومی قرار نمی‌گیرد و برای ساخت آن گواهی Authenticode لازم نیست.** گردش‌کار فقط نصاب NSIS با نام `AshkeGhalam-Setup-v<version>.exe` می‌سازد و آن را به‌عنوان Artifact با نام `AshkeGhalam-Windows-Installer` در اجرای GitHub Actions نگه می‌دارد. فایل Windows به بخش فایل‌های Release اندروید/وب اضافه نمی‌شود.

- چون فایل بدون امضای ناشر معتبر است، Windows ممکن است هشدار ناشر ناشناخته یا SmartScreen نشان دهد. فایل را فقط از کانال تحویل مورداعتماد خودتان بدهید؛ این تنظیمات هشدارهای Windows را حذف نمی‌کنند.
- بسته‌بندی Electron با `asar: true` و فشرده‌سازی `maximum` فعال است. اسکریپت ساخت، bundleهای JavaScript رابط را مبهم‌سازی (obfuscate) می‌کند و source mapها را حذف می‌کند. این کار بررسی کد را سخت‌تر می‌کند، اما **رمزگذاری نیست و مهندسی معکوس را به‌طور کامل ناممکن نمی‌کند**. هیچ رمز، secret، کلید خصوصی لایسنس یا اطلاعات اتصال حساس را داخل برنامه کلاینت قرار ندهید.
- برای کاهش حجم خروجی، CI فقط نصاب نصب‌شونده را تولید می‌کند و نسخه Portable و ZIP تکراری نمی‌سازد. تنظیمات اجباری GPU و حافظه Electron حذف شده‌اند تا Chromium تنظیمات متناسب با سخت‌افزار را خودش انتخاب کند. پایش پیام‌های پشتیبانی نیز در نسخه مستقل بدون سرور ابری فعال نمی‌شود.
- مهاجرت به Tauri یا یک میزبان WebView2/.NET می‌تواند در بعضی سیستم‌ها مصرف حافظه و حجم نصب را کاهش دهد، اما نیازمند بازپیاده‌سازی و آزمون دوباره IPC، فایل‌ها، پایگاه داده محلی و چاپ/خروجی‌هاست. ابتدا باید نسخه فعلی روی سیستم واقعی اندازه‌گیری شود؛ مهاجرت چارچوب بدون benchmark ممکن است خطاهای جدید ایجاد کند.

## ۳. تنظیم GitHub Environments و Secrets

در مخزن GitHub به **Settings → Environments** بروید و این سه محیط را ایجاد/تنظیم کنید:

### `ci`
بدون اسرار امضا. برای pushهای عادی و Pull Requestهاست.

### `commercial-signing`
در **Deployment branches and tags**، انتخاب محدود (Selected branches and tags) را فعال و فقط الگوی تگ `v*` را مجاز کنید. در بخش **Environment secrets** این چهار مورد را اضافه کنید:

- `ANDROID_KEYSTORE_BASE64` — محتوای فایل Base64 کلید Android
- `ANDROID_KEYSTORE_PASSWORD` — رمز keystore
- `ANDROID_KEY_ALIAS` — مقدار `ashkghalam-release`
- `ANDROID_KEY_PASSWORD` — رمز کلید

در بخش **Environment variables** این مقدار را اضافه کنید:

- `ANDROID_SIGNER_SHA256` — fingerprint گواهی Android، ۶۴ رقم هگزادسیمال و بدون `:`

این مقادیر را در **Repository secrets**، فایل‌های پروژه یا کد قرار ندهید؛ workflow برای ساخت تجاری باید آن‌ها را از محیط `commercial-signing` بخواند. اگر هرکدام از این چهار Secret قبلاً در سطح مخزن تعریف شده‌اند، پس از ثبت و آزمایش نسخهٔ محیطی، نمونه‌های سطح مخزن را حذف کنید؛ Secret سطح مخزن می‌تواند در buildهای عادی هم در دسترس باشد و محدودیت محیط به‌تنهایی آن را خنثی نمی‌کند.

### `commercial-release`
این محیط را فقط برای تگ‌های `v*` محدود کنید و در صورت امکان یک یا چند **Required reviewer** تعیین کنید. هیچ کلید خصوصی‌ای لازم نیست در این محیط ذخیره شود؛ فقط مرحلهٔ انتشار Draft Release را محافظت می‌کند.

## ۴. بررسی و ساخت نسخه

نسخه فعلی در `package.json` برابر `16.55.0` است؛ تگ انتشار باید با آن تطابق داشته باشد، یعنی `v16.55.0`. **فعلاً تگ نسازید** تا Secrets و Variable اندروید ثبت و fingerprint کلید Android دوباره بررسی شود؛ فایل Windows امضای Authenticode اجباری ندارد و در Release عمومی قرار نمی‌گیرد.

پس از تنظیم کامل، تگ نسخه در workflow ساخت‌های امضاشده را اجرا می‌کند. انتشار فقط وقتی ادامه می‌یابد که:
- APK انتشار وجود داشته باشد، APK آزمایشی به‌اشتباه انتخاب نشده باشد، امضا معتبر باشد و fingerprint با `ANDROID_SIGNER_SHA256` یکسان باشد.
- شماره نسخه، تگ و فایل‌های بسته‌بندی‌شده با هم تطابق داشته باشند.

سپس GitHub Release به‌صورت Draft ایجاد می‌شود و شامل APK اندروید و بسته وب مادر است؛ EXE ویندوز در این Release قرار نمی‌گیرد. Artifact ویندوز از اجرای GitHub Actions برای تحویل دستی نگهداری می‌شود. APK ساخته‌شده در CI عادی آزمایشی است و برای توزیع تجاری باید از مسیر تگ و با کلید تأییدشده امضا شود.

## ۵. نکات امنیتی مهم

- کلید Android و رمزهایش را در دو محل امن و رمزگذاری‌شده پشتیبان بگیرید؛ کلید جدید جای کلید منتشرشده را نمی‌گیرد.
- فایل نصاب Windows بدون امضای معتبر ناشر تحویل می‌شود؛ به مشتریان درباره احتمال هشدار SmartScreen اطلاع دهید.
- پس از تنظیم Secrets، از logها برای چاپ رمز، Base64 کامل یا محتویات کلید استفاده نکنید.
- امضای فایل فقط هویت و یکپارچگی فایل را بررسی می‌کند؛ به‌تنهایی امنیت کامل برنامه یا منطق لایسنس را تضمین نمی‌کند.

مرجع‌ها:
- [Android app signing](https://developer.android.com/studio/publish/app-signing)
- [GitHub Actions secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)
- [Microsoft SmartScreen reputation](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation)

## لایسنس تجاری مستقل از امضای فایل

امضای Android/Windows با امضای لایسنس فرق دارد. کلید خصوصی صدور لایسنس باید فقط در سرور یا ابزار مدیریتی جداگانه بماند؛ هرگز آن را داخل JavaScript، EXE، APK یا متغیرهای `VITE_*` قرار ندهید. مهاجرت کامل همه مسیرهای قدیمی لایسنس به امضای نامتقارن همچنان نیازمند بررسی و آزمون مستقل است.
