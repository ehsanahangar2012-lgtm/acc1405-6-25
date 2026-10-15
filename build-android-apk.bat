@echo off
setlocal enabledelayedexpansion
cls
echo ================================================================
echo   AshkeGhalam Android APK Builder v16.51.0
echo   Automated Capacitor / Gradle Packaging
echo ================================================================

:: 1. Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is required. Please install Node.js.
    pause
    exit /b 1
)

:: 2. Sync web assets with Android capacitor project
echo [1/3] Syncing web assets to Android project...
call npx cap sync android

:: 3. Check for gradlew.bat inside android directory
if exist "android\gradlew.bat" (
    echo [2/3] Checking for Java / Android build tools...
    where javac >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        echo [3/3] Compiling signed Android APK using Gradle...
        pushd android
        call gradlew.bat assembleDebug
        popd
        if exist "android\app\build\outputs\apk\debug\app-debug.apk" (
            copy /Y "android\app\build\outputs\apk\debug\app-debug.apk" "AshkeGhalam-v16.51.0.apk" >nul
            echo.
            echo [SUCCESS] AshkeGhalam-v16.51.0.apk built successfully!
            echo Location: %~dp0AshkeGhalam-v16.51.0.apk
            pause
            exit /b 0
        )
    ) else (
        echo [NOTICE] Java JDK / Android SDK not detected in PATH.
    )
)

:: 4. Fallback: Run packaging script
echo Packaging offline web container APK...
node scripts/build-apk.js

echo.
echo ================================================================
echo   NOTICE FOR ANDROID INSTALLATION:
echo   1. If you have Android Studio / JDK installed, run this script again.
echo   2. You can also install directly on any Android phone / POS:
echo      Open the app URL in Chrome, tap Menu (3 dots) -> 'Install App'
echo      or 'Add to Home screen'. It installs as a full native app!
echo ================================================================
pause
