# Ashke Ghalam — Windows Native (.NET / WPF)

این پوشه پیاده‌سازی مستقل نسخهٔ بومی Windows است؛ جایگزین فوری نسخهٔ وب، Android یا Electron نیست.

## محدوده فعلی
- پوستهٔ اولیهٔ WPF با رابط راست‌چین فارسی و ناوبری نمایشی.
- پایهٔ ارتباط HTTPS با بررسی گواهی توسط سیستم‌عامل و بدون دور زدن TLS.
- آزمون واحد سیاست اعتبارسنجی آدرس API.
- workflow ویندوز برای build/test و تولید EXE مستقل، مشروط به موفقیت workflow.

**هنوز پیاده‌سازی نشده:** ورود، فعال‌سازی لایسنس، دسترسی واقعی به داده‌های حسابداری، پایگاه دادهٔ محلی، همگام‌سازی، پشتیبان‌گیری/بازیابی یا صفحه‌های مالی مهاجرت‌یافته. پوستهٔ فعلی برای استفادهٔ حسابداری آماده نیست.

## ساخت در Windows
پیش‌نیاز: .NET 10 SDK و workload دسکتاپ Windows.

    dotnet restore windows-native-dotnet/tests/AshkeGhalam.Windows.Tests.csproj
    dotnet build windows-native-dotnet/src/AshkeGhalam.Windows/AshkeGhalam.Windows.csproj -c Release
    dotnet test windows-native-dotnet/tests/AshkeGhalam.Windows.Tests.csproj -c Release
    dotnet publish windows-native-dotnet/src/AshkeGhalam.Windows/AshkeGhalam.Windows.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o ./artifacts/windows

خروجی بدون گواهی ناشر معتبر امضای Authenticode ندارد. این مرحله، نصب‌کنندهٔ تولیدی یا امضای ناشر را ادعا نمی‌کند.

برای مبنای ممیزی، قابلیت‌ها، قراردادهای API و ریسک‌های تأییدشده، AUDIT.md را ببینید. معماری پیشنهادی در ARCHITECTURE.md است.

وضعیت هیچ قابلیتی صرفاً به‌دلیل وجود فایل یا کلاس، تکمیل‌شده محسوب نمی‌شود.
