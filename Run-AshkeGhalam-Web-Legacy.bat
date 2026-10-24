@echo off
setlocal enabledelayedexpansion
cls
echo ================================================================
echo   LEGACY WEB LAUNCHER - AshkeGhalam v16.51.0
echo   Legacy WebView / Edge window. Use Run-AshkeGhalam.bat for native WPF.
echo ================================================================

:: 1. Ensure Isolated Data Directory Exists
set "APP_DATA_DIR=%APPDATA%\AshkeGhalam"
if not exist "%APP_DATA_DIR%" mkdir "%APP_DATA_DIR%"
if not exist "%APP_DATA_DIR%\Backups" mkdir "%APP_DATA_DIR%\Backups"

:: 2. Ensure Default Backup Directory in Documents Exists
if not exist "%USERPROFILE%\Documents\AshkeGhalam_Backups" (
    mkdir "%USERPROFILE%\Documents\AshkeGhalam_Backups"
)

:: 3. Check if dist/index.html exists for instant startup
set "TARGET_HTML=%~dp0dist\index.html"
if not exist "%TARGET_HTML%" (
    echo [INFO] Dist folder not found. Building web assets...
    where node >nul 2>nul
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Node.js is required to build the initial assets.
        pause
        exit /b 1
    )
    if not exist "node_modules" call npm install
    call npm run build
)

:: 4. Search for Microsoft Edge (WebView2 Evergreen Engine for Native App Mode)
set "EDGE_EXE="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE_EXE if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE_EXE if exist "%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"

echo [STARTING] Launching application with high-performance native acceleration...
if defined EDGE_EXE (
    start "" "%EDGE_EXE%" --app="file:///%TARGET_HTML%" --user-data-dir="%APP_DATA_DIR%" --window-size=1280,850 --enable-gpu-rasterization --in-process-gpu
) else (
    start "" "explorer.exe" "%TARGET_HTML%"
)

echo.
echo ================================================================
echo   AshkeGhalam is now running in independent mode!
echo ================================================================
timeout /t 3 >nul
exit
