@echo off
setlocal enabledelayedexpansion
cls
echo ================================================================
echo   Native Windows Compiler - AshkeGhalam v16.51.0
echo   Independent, Fast, and Secure Architecture
echo ================================================================

:: 1. Search for Windows Built-in Native Compiler (csc.exe - Zero Downloads Required!)
set "CSC="
if exist "%SystemRoot%\Microsoft.NET\Framework64\v4.0.30319\csc.exe" set "CSC=%SystemRoot%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not defined CSC if exist "%SystemRoot%\Microsoft.NET\Framework\v4.0.30319\csc.exe" set "CSC=%SystemRoot%\Microsoft.NET\Framework\v4.0.30319\csc.exe"

if defined CSC (
    echo [1/3] Using Windows Built-in Compiler: %CSC%
    "%CSC%" /target:winexe /optimize+ /out:AshkeGhalam-Native.exe AshkeGhalamLauncher.cs
    if %ERRORLEVEL% EQU 0 (
        echo [SUCCESS] AshkeGhalam-Native.exe built successfully!
        goto done
    )
)

:: 2. Search for MinGW g++ in common installation directories
echo [2/3] Searching for MinGW-w64 compiler...
set "MINGW_PATH="
if exist "C:\mingw64\bin\g++.exe" set "MINGW_PATH=C:\mingw64\bin"
if not defined MINGW_PATH if exist "C:\msys64\mingw64\bin\g++.exe" set "MINGW_PATH=C:\msys64\mingw64\bin"
if not defined MINGW_PATH if exist "C:\msys64\ucrt64\bin\g++.exe" set "MINGW_PATH=C:\msys64\ucrt64\bin"
if not defined MINGW_PATH if exist "C:\MinGW\bin\g++.exe" set "MINGW_PATH=C:\MinGW\bin"
if not defined MINGW_PATH if exist "%USERPROFILE%\mingw64\bin\g++.exe" set "MINGW_PATH=%USERPROFILE%\mingw64\bin"
if not defined MINGW_PATH if exist "D:\mingw64\bin\g++.exe" set "MINGW_PATH=D:\mingw64\bin"

if defined MINGW_PATH (
    echo Found MinGW at %MINGW_PATH%, adding to PATH...
    set "PATH=%MINGW_PATH%;%PATH%"
)

where g++ >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Compiling with GCC / MinGW...
    g++ -O3 -mwindows main.cpp -lole32 -lshell32 -luser32 -o AshkeGhalam-Native.exe
    if %ERRORLEVEL% EQU 0 (
        echo [SUCCESS] AshkeGhalam-Native.exe built with MinGW!
        goto done
    )
)

:: 3. Check for MSVC cl.exe
where cl >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [3/3] Compiling with MSVC...
    cl /O2 /EHsc /W3 main.cpp /link user32.lib shell32.lib ole32.lib /OUT:AshkeGhalam-Native.exe
    if %ERRORLEVEL% EQU 0 (
        echo [SUCCESS] AshkeGhalam-Native.exe built with MSVC!
        goto done
    )
)

echo.
echo Notice: Pre-built launcher is ready in Build-Output and downloads folder.
:done
echo Build process finished.
pause
