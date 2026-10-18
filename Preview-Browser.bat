@echo off
setlocal
cd /d "%~dp0"
set "ROOT=%~dp0"

echo.
echo ========================================================
echo   AshkeGhalam - Local Browser Preview
echo   Cloud/server connection is disabled in this mode.
echo ========================================================
echo.

REM When launched from the source repository, build the isolated preview first.
if exist "%ROOT%package.json" (
  where bun >nul 2>nul
  if errorlevel 1 (
    echo Bun is required to build from source. Install it from https://bun.sh/
    pause
    exit /b 1
  )
  call bun install --frozen-lockfile
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
  call bun run build:browser-preview
  if errorlevel 1 (
    echo Browser preview build failed.
    pause
    exit /b 1
  )
)

if not exist "%ROOT%dist\index.html" (
  echo Preview files were not found. Download/extract the browser preview artifact,
  echo or run this file from the project source folder.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is required to serve the preview locally.
  echo Download it from https://nodejs.org/
  pause
  exit /b 1
)

if exist "%ROOT%scripts\serve-browser-preview.mjs" (
  set "SERVER=%ROOT%scripts\serve-browser-preview.mjs"
) else if exist "%ROOT%serve-browser-preview.mjs" (
  set "SERVER=%ROOT%serve-browser-preview.mjs"
) else (
  echo Browser preview server script was not found.
  pause
  exit /b 1
)

start "" "http://127.0.0.1:4173/"
node "%SERVER%"
