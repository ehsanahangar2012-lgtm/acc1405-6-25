@echo off
setlocal
chcp 65001 >nul
title Ashke Ghalam - Native Windows WPF
cls
echo ============================================================
echo   ASHKE GHALAM - NATIVE WINDOWS ACCOUNTING
echo   Fetches the latest feature/windows-native-dotnet source
echo   and starts the real WPF app on this Windows desktop.
echo ============================================================
echo.
echo For Google Chrome Remote Desktop, run this BAT on the
echo remote Windows computer. The remote session only mirrors it.
echo.

set "WPF_LAUNCHER=%~dp0Run-AshkeGhalam-WPF-Preview.bat"
if exist "%WPF_LAUNCHER%" goto :run_existing_launcher

rem Fallback for a copied BAT when the companion launcher is absent.
set "AG_PREVIEW_PS1=%TEMP%\ashkghalam-wpf-launch-%RANDOM%-%RANDOM%.ps1"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; $p=$env:AG_PREVIEW_PS1; $rc=0; try { $u='https://api.github.com/repos/ehsanahangar2012-lgtm/acc1405-6-25/contents/Run-AshkeGhalam-WPF-Preview.ps1?ref=feature%2Fwindows-native-dotnet'; $h=@{'User-Agent'='AshkeGhalam-Wpf-Local-Preview'}; $r=Invoke-RestMethod -Headers $h -Uri $u; $b=[Convert]::FromBase64String(($r.content -replace '\s','')); [IO.File]::WriteAllBytes($p,$b); & $p; if ($null -ne $LASTEXITCODE) { $rc=[int]$LASTEXITCODE } } catch { Write-Host ('Native WPF launch failed: ' + $_) -ForegroundColor Red; $rc=1 } finally { Remove-Item -LiteralPath $p -Force -ErrorAction SilentlyContinue }; exit $rc"
set "RESULT=%ERRORLEVEL%"
goto :report

:run_existing_launcher
call "%WPF_LAUNCHER%"
set "RESULT=%ERRORLEVEL%"

:report
echo.
if not "%RESULT%"=="0" (
  echo WPF launch did not complete successfully. Read the error above.
  pause
) else (
  echo Native WPF preview exited.
)
exit /b %RESULT%
