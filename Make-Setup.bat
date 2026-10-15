@echo off
setlocal enabledelayedexpansion
cls
echo ================================================================
echo   AshkeGhalam Accounting System v16.51.0
echo   Automated Windows Standalone Builder & Setup Generator
echo ================================================================

:: 1. Build web assets if needed
echo [1/4] Checking and building frontend assets...
if not exist "dist\index.html" (
    where node >nul 2>nul
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Node.js is required to compile dist.
        pause
        exit /b 1
    )
    call npm run build
)

:: 2. Prepare Build-Output directory
echo [2/4] Assembling standalone distribution package...
if not exist "Build-Output" mkdir "Build-Output"
if exist "Build-Output\dist" rmdir /s /q "Build-Output\dist"

xcopy /E /I /Y "dist" "Build-Output\dist" >nul
copy /Y "Run-AshkeGhalam.bat" "Build-Output\Run-AshkeGhalam.bat" >nul
if exist "favicon.ico" copy /Y "favicon.ico" "Build-Output\favicon.ico" >nul

:: 3. Compile native Windows launcher executable using built-in csc.exe
echo [3/4] Compiling native Windows executable (using built-in csc.exe)...
set "CSC="
if exist "%SystemRoot%\Microsoft.NET\Framework64\v4.0.30319\csc.exe" set "CSC=%SystemRoot%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not defined CSC if exist "%SystemRoot%\Microsoft.NET\Framework\v4.0.30319\csc.exe" set "CSC=%SystemRoot%\Microsoft.NET\Framework\v4.0.30319\csc.exe"

if defined CSC (
    "%CSC%" /target:winexe /optimize+ /out:Build-Output\AshkeGhalam.exe windows-native\AshkeGhalamLauncher.cs >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo [SUCCESS] Build-Output\AshkeGhalam.exe generated successfully!
    )
)

:: 4. Create Desktop Shortcut
echo [4/4] Creating Desktop shortcut...
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([System.IO.Path]::Combine([Environment]::GetFolderPath('Desktop'), 'AshkeGhalam.lnk')); $s.TargetPath = [System.IO.Path]::Combine('%~dp0Build-Output', 'Run-AshkeGhalam.bat'); $s.WorkingDirectory = [System.IO.Path]::Combine('%~dp0Build-Output'); $s.Description = 'AshkeGhalam Accounting System'; $s.Save()" >nul 2>&1

echo.
echo ================================================================
echo   STANDALONE PACKAGE COMPLETED!
echo ================================================================
echo Directory: %~dp0Build-Output
echo - To run: Double-click Run-AshkeGhalam.bat inside Build-Output
echo - A shortcut 'AshkeGhalam' has been added to your Desktop.
echo - Data is safely isolated in: %%APPDATA%%\AshkeGhalam
echo ================================================================
pause
