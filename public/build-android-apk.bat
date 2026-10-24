@echo off
setlocal
chcp 65001 >nul
title AshkeGhalam - Android APK Builder

echo ================================================================
echo   AshkeGhalam Android APK Builder (Capacitor)
echo ================================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

node scripts/build-apk.js
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Build process encountered an issue.
    pause
    exit /b %errorlevel%
)

echo.
echo Build completed successfully.
pause
