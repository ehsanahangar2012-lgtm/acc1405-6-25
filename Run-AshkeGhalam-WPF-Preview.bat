@echo off
setlocal
title Ashk Ghalam - Native WPF Preview
set "ROOT=%~dp0"
set "PROJECT=%ROOT%windows-native-dotnet\src\AshkeGhalam.Windows\AshkeGhalam.Windows.csproj"

echo ============================================================
echo  Ashk Ghalam Accounting - Native Windows WPF Preview
echo  Builds and launches the current source from this checkout
echo ============================================================
echo.

if not exist "%PROJECT%" (
    echo [ERROR] WPF project was not found:
    echo         "%PROJECT%"
    echo.
    echo Make sure this script is in the repository root and that
    echo branch feature/windows-native-dotnet is checked out.
    pause
    exit /b 1
)

where dotnet >nul 2>nul
if errorlevel 1 (
    echo [ERROR] The .NET SDK is not installed or not on PATH.
    echo Install the .NET 10 SDK, then run this file again.
    pause
    exit /b 1
)

pushd "%ROOT%windows-native-dotnet\src\AshkeGhalam.Windows"
echo [BUILD] Building the current WPF source in Release configuration...
echo [SOURCE] %PROJECT%
echo.
dotnet run --project "%PROJECT%" --configuration Release
set "RESULT=%ERRORLEVEL%"
popd

if not "%RESULT%"=="0" (
    echo.
    echo [ERROR] WPF build or startup failed with exit code %RESULT%.
    echo The error above is from the current source build, not an old EXE.
    pause
)

exit /b %RESULT%
