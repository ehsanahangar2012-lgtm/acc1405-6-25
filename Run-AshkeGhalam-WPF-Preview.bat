@echo off
setlocal
chcp 65001 >nul
title Ashke Ghalam - Native WPF Live Preview
set "AG_PREVIEW_PS1=%TEMP%\ashkghalam-wpf-launch-%RANDOM%-%RANDOM%.ps1"

echo ============================================================
echo  Ashk Ghalam - Native WPF Live Preview
echo  Fetches and runs the latest source from feature/windows-native-dotnet
echo ============================================================
echo.
echo The app runs on this Windows desktop. Chrome Remote Desktop only
echo mirrors the desktop so you can view and control it remotely.
echo.

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; $p=$env:AG_PREVIEW_PS1; $rc=0; try { $u='https://api.github.com/repos/ehsanahangar2012-lgtm/acc1405-6-25/contents/Run-AshkeGhalam-WPF-Preview.ps1?ref=feature%2Fwindows-native-dotnet'; $h=@{'User-Agent'='AshkeGhalam-Wpf-Local-Preview'}; $r=Invoke-RestMethod -Headers $h -Uri $u; $b=[Convert]::FromBase64String(($r.content -replace '\s','')); [IO.File]::WriteAllBytes($p,$b); & $p; if ($null -ne $LASTEXITCODE) { $rc=[int]$LASTEXITCODE } } catch { Write-Host ('Preview launcher failed: ' + $_) -ForegroundColor Red; $rc=1 } finally { Remove-Item -LiteralPath $p -Force -ErrorAction SilentlyContinue }; exit $rc"
set "RESULT=%ERRORLEVEL%"

echo.
if not "%RESULT%"=="0" (
  echo Preview did not start successfully. Read the error above.
) else (
  echo Preview finished.
)
echo.
pause
exit /b %RESULT%
