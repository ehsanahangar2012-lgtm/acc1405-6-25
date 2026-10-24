#!/usr/bin/env bash
set -e

echo "================================================================"
echo "  📱 ابزار بیلد خودکار پکیج APK اندروید اشک قلم (Capacitor)"
echo "  🏢 نسخه مستقل آفلاین با پشتیبانی از چاپ حرارتی و اسکنر"
echo "================================================================"
echo ""

echo "[1/3] بیلد برنامه وب و آماده‌سازی پوشه dist..."
npm run build

echo ""
echo "[2/3] همگام‌سازی Capacitor با پروژه اندروید..."
if [ ! -d "android" ]; then
    echo "ایجاد ساختار پروژه نیتیو اندروید..."
    npx cap add android
fi

npx cap sync android

echo ""
echo "[3/3] کامپایل و تولید فایل APK با Gradle..."
if [ -f "android/gradlew" ]; then
    cd android
    chmod +x gradlew
    ./gradlew assembleDebug
    cd ..
    echo ""
    echo "================================================================"
    echo "  ✅ فایل APK با موفقیت تولید شد!"
    echo "  📂 مسیر فایل نصبی:"
    echo "  android/app/build/outputs/apk/debug/app-debug.apk"
    echo "================================================================"
else
    echo "برای باز کردن پروژه در Android Studio دستور زیر را اجرا کنید:"
    echo "npx cap open android"
fi
