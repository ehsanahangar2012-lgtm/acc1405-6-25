# راهنمای آماده‌سازی امضای تجاری اشک قلم

## وضعیت و رفتار خط لوله

- کامیت‌ها و Pull Requestها از محیط `ci` استفاده می‌کنند و فقط خروجی آزمایشی می‌سازند.
- فقط تگ نسخه‌ای با الگوی `v*` از محیط `commercial-signing` به اسرار امضا دسترسی می‌گیرد.
- قبل از ساخت Release، workflow امضای APK و Authenticode فایل‌های EXE را بررسی می‌کند و هویت امضاکننده را با متغیرهای تأییدشده مقایسه می‌کند.
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

## ۲. تهیه گواهی معتبر امضای Windows

برای توزیع عمومی، گواهی **Authenticode Code Signing** باید به هویت واقعی و قانونی ناشر تعلق داشته باشد و زنجیره آن در ویندوز مورد اعتماد باشد. گواهی خودامضا برای انتشار عمومی جایگزین گواهی معتبر نیست.

**قبل از خرید، گواهی را انتخاب نکنید صرفاً چون فروشنده فایل PFX وعده می‌دهد.** طبق الزامات فعلی CA/Browser Forum، کلید خصوصی گواهی‌های عمومی جدید باید با سخت‌افزار امن، HSM ابری یا سرویس امضای مورد تأیید محافظت شود؛ بنابراین بسیاری از ارائه‌دهندگان کلید خصوصی قابل‌صدور به PFX ارائه نمی‌کنند. شرایط صدور و امکان استفاده از آن برای کشور محل ثبت قانونی شرکت را مستقیماً از ارائه‌دهنده تأیید کنید.

وضع فعلی مخزن: گردش‌کار Windows در GitHub Actions هنوز به `WINDOWS_SIGNING_PFX_BASE64` و `WINDOWS_SIGNING_PFX_PASSWORD` متکی است. اگر ارائه‌دهنده PFX سازگار و مطابق الزامات را ندهد، باید گردش‌کار به سرویس امضای امن همان ارائه‌دهنده متصل شود **پیش از ساخت تگ تجاری**. فعلاً این اسرار را جعل نکنید، از گواهی خودامضا استفاده نکنید و بررسی امضا در CI را غیرفعال نکنید.

### فقط در صورت دریافت PFX سازگار از ارائه‌دهنده

فایل PFX را در یک پوشه امن خارج از مخزن نگه دارید و در PowerShell آن را به Base64 تبدیل کنید:

```powershell
$PfxPath = 'C:\Secure\AshkeGhalam-CodeSigning.pfx'
$PfxBase64File = Join-Path $env:TEMP 'ashkghalam-windows-signing-pfx-base64.txt'
[IO.File]::WriteAllText($PfxBase64File, [Convert]::ToBase64String([IO.File]::ReadAllBytes($PfxPath)), [Text.Encoding]::ASCII)
```

اگر فایل Base64 از سقف ۴۸ کیلوبایت GitHub Secret بزرگ‌تر شد، آن را تکه‌تکه در Git قرار ندهید؛ باید مسیر امضای مدیریت‌شده، مانند سرویس امضای ابری، به workflow اضافه شود.

برای خواندن نام نمایشی گواهی که باید دقیقاً در `WINDOWS_SIGNING_PUBLISHER` ثبت شود:

```powershell
$PfxPassword = Read-Host 'PFX password' -AsSecureString
$Cert = Get-PfxCertificate -FilePath $PfxPath -Password $PfxPassword
$Cert.GetNameInfo([System.Security.Cryptography.X509Certificates.X509NameType]::SimpleName, $false)
```

نام خروجی را بدون تغییر در متغیر `WINDOWS_SIGNING_PUBLISHER` بگذارید. امضای معتبر تضمین نمی‌کند در اولین دانلود هیچ هشدار SmartScreen نمایش داده نشود؛ اعتبار ناشر/فایل به‌مرور شکل می‌گیرد.

## ۳. تنظیم GitHub Environments و Secrets

در مخزن GitHub به **Settings → Environments** بروید و این سه محیط را ایجاد/تنظیم کنید:

### `ci`
بدون اسرار امضا. برای pushهای عادی و Pull Requestهاست.

### `commercial-signing`
در **Deployment branches and tags**، انتخاب محدود (Selected branches and tags) را فعال و فقط الگوی تگ `v*` را مجاز کنید. در بخش **Environment secrets** این شش مورد را اضافه کنید:

- `ANDROID_KEYSTORE_BASE64` — محتوای فایل Base64 کلید Android
- `ANDROID_KEYSTORE_PASSWORD` — رمز keystore
- `ANDROID_KEY_ALIAS` — مقدار `ashkghalam-release`
- `ANDROID_KEY_PASSWORD` — رمز کلید
- `WINDOWS_SIGNING_PFX_BASE64` — محتوای فایل Base64 گواهی PFX
- `WINDOWS_SIGNING_PFX_PASSWORD` — رمز PFX

در بخش **Environment variables** این دو مقدار را اضافه کنید:

- `ANDROID_SIGNER_SHA256` — fingerprint گواهی Android، ۶۴ رقم هگزادسیمال و بدون `:`
- `WINDOWS_SIGNING_PUBLISHER` — نام نمایشی دقیق گواهی Windows

این مقادیر را در **Repository secrets**، فایل‌های پروژه یا کد قرار ندهید؛ workflow برای ساخت تجاری باید آن‌ها را از محیط `commercial-signing` بخواند. اگر هرکدام از این شش Secret قبلاً در سطح مخزن تعریف شده‌اند، پس از ثبت و آزمایش نسخهٔ محیطی، نمونه‌های سطح مخزن را حذف کنید؛ Secret سطح مخزن می‌تواند در buildهای عادی هم در دسترس باشد و محدودیت محیط به‌تنهایی آن را خنثی نمی‌کند.

### `commercial-release`
این محیط را فقط برای تگ‌های `v*` محدود کنید و در صورت امکان یک یا چند **Required reviewer** تعیین کنید. هیچ کلید خصوصی‌ای لازم نیست در این محیط ذخیره شود؛ فقط مرحلهٔ انتشار Draft Release را محافظت می‌کند.

## ۴. بررسی و ساخت نسخه

نسخه فعلی در `package.json` برابر `16.55.0` است؛ تگ انتشار باید با آن تطابق داشته باشد، یعنی `v16.55.0`. **فعلاً تگ نسازید** تا همه Secrets و Variables بالا ثبت، و نام قانونی ناشر Windows و fingerprint کلید Android دوباره بررسی شوند.

پس از تنظیم کامل، تگ نسخه در workflow ساخت‌های امضاشده را اجرا می‌کند. انتشار فقط وقتی ادامه می‌یابد که:
- APK انتشار وجود داشته باشد، APK آزمایشی به‌اشتباه انتخاب نشده باشد، امضا معتبر باشد و fingerprint با `ANDROID_SIGNER_SHA256` یکسان باشد.
- هر دو EXE دارای Authenticode معتبر باشند و نام ناشر با `WINDOWS_SIGNING_PUBLISHER` تطابق داشته باشد.
- شماره نسخه، تگ و فایل‌های بسته‌بندی‌شده با هم تطابق داشته باشند.

سپس GitHub Release به‌صورت Draft ایجاد می‌شود. قبل از Publish کردن، فایل‌ها را دانلود و روی ویندوز/اندروید آزمایش کنید. APK/EXE فعلی که از CI عادی دریافت می‌شود، آزمایشی است و جای خروجی تجاری امضاشده را نمی‌گیرد.

## ۵. نکات امنیتی مهم

- کلید Android و رمزهایش را در دو محل امن و رمزگذاری‌شده پشتیبان بگیرید؛ کلید جدید جای کلید منتشرشده را نمی‌گیرد.
- فایل PFX و رمز آن را جداگانه نگه دارید؛ هیچ‌کدام را در GitHub Issues، چت یا commit ارسال نکنید.
- پس از تنظیم Secrets، از logها برای چاپ رمز، Base64 کامل یا محتویات کلید استفاده نکنید.
- امضای فایل فقط هویت و یکپارچگی فایل را بررسی می‌کند؛ به‌تنهایی امنیت کامل برنامه یا منطق لایسنس را تضمین نمی‌کند.

مرجع‌ها:
- [Android app signing](https://developer.android.com/studio/publish/app-signing)
- [GitHub Actions secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)
- [Microsoft SmartScreen reputation](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation)

## لایسنس تجاری مستقل از امضای فایل

امضای Android/Windows با امضای لایسنس فرق دارد. کلید خصوصی صدور لایسنس باید فقط در سرور یا ابزار مدیریتی جداگانه بماند؛ هرگز آن را داخل JavaScript، EXE، APK یا متغیرهای `VITE_*` قرار ندهید. مهاجرت کامل همه مسیرهای قدیمی لایسنس به امضای نامتقارن همچنان نیازمند بررسی و آزمون مستقل است.
