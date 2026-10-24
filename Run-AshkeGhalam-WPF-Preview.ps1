$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$repo = 'ehsanahangar2012-lgtm/acc1405-6-25'
$branchName = 'feature/windows-native-dotnet'
$workRoot = Join-Path $env:LOCALAPPDATA 'AshkeGhalam\WpfPreview\ManualRun'
$sourceRoot = Join-Path $workRoot 'source'
$dataRoot = Join-Path $workRoot 'data'
New-Item -ItemType Directory -Path $workRoot, $dataRoot -Force | Out-Null

Write-Host ''
Write-Host 'Ashke Ghalam - Native WPF local preview' -ForegroundColor Cyan
Write-Host 'Runs the real WPF application on this Windows desktop.'
Write-Host 'Chrome Remote Desktop only mirrors the desktop; it is not the application host.'
Write-Host 'A separate encrypted preview-data file is used; normal accounting data is not opened.'
Write-Host ''

# Find .NET 10 SDK; if missing, install it for this Windows user.
$dotnetCommand = Get-Command dotnet.exe -ErrorAction SilentlyContinue
$dotnetExe = $null
$hasNet10 = $false
if ($dotnetCommand) {
    $sdkList = (& $dotnetCommand.Source --list-sdks 2>$null | Out-String)
    if ($sdkList -match '(?m)^\s*10\.') {
        $hasNet10 = $true
        $dotnetExe = $dotnetCommand.Source
    }
}
if (-not $hasNet10) {
    Write-Host '.NET 10 SDK was not found. Installing it into the current Windows user profile...' -ForegroundColor Yellow
    $dotnetDir = Join-Path $env:LOCALAPPDATA 'Programs\dotnet'
    $installer = Join-Path $env:TEMP ('dotnet-install-' + [guid]::NewGuid().ToString('N') + '.ps1')
    try {
        Invoke-WebRequest -UseBasicParsing -Uri 'https://dot.net/v1/dotnet-install.ps1' -OutFile $installer
        & $installer -Channel '10.0' -Architecture 'x64' -InstallDir $dotnetDir -NoPath
        if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) {
            throw '.NET SDK installer returned a failure code.'
        }
    } finally {
        Remove-Item -LiteralPath $installer -Force -ErrorAction SilentlyContinue
    }
    $env:DOTNET_ROOT = $dotnetDir
    $env:PATH = $dotnetDir + ';' + $env:PATH
    $dotnetExe = Join-Path $dotnetDir 'dotnet.exe'
    if (-not (Test-Path -LiteralPath $dotnetExe)) {
        throw 'Could not find dotnet.exe after installation. See https://dotnet.microsoft.com/download/dotnet/10.0'
    }
    $sdkList = (& $dotnetExe --list-sdks 2>$null | Out-String)
    if ($sdkList -notmatch '(?m)^\s*10\.') {
        throw '.NET 10 SDK installation could not be verified.'
    }
}
Write-Host ("Using SDK: " + ((& $dotnetExe --version 2>$null | Out-String).Trim())) -ForegroundColor Green

# Resolve the latest exact commit from the intended WPF branch.
$headers = @{ 'User-Agent' = 'AshkeGhalam-Wpf-Local-Preview' }
$branchUrl = "https://api.github.com/repos/$repo/branches/feature%2Fwindows-native-dotnet"
$branchInfo = Invoke-RestMethod -Headers $headers -Uri $branchUrl
$sourceSha = [string]$branchInfo.commit.sha
if ($sourceSha -notmatch '^[0-9a-f]{40}$') {
    throw 'Could not verify the latest commit SHA for the WPF source branch.'
}
Write-Host ("Fetching WPF source at commit: " + $sourceSha) -ForegroundColor Cyan

# Download and extract a disposable checkout. This never touches a user's existing Git worktree.
$archive = Join-Path $env:TEMP ('ashkghalam-wpf-source-' + [guid]::NewGuid().ToString('N') + '.zip')
$extractRoot = Join-Path $workRoot 'extract-temp'
try {
    if (Test-Path -LiteralPath $extractRoot) {
        Remove-Item -LiteralPath $extractRoot -Recurse -Force
    }
    if (Test-Path -LiteralPath $sourceRoot) {
        Remove-Item -LiteralPath $sourceRoot -Recurse -Force
    }
    Invoke-WebRequest -UseBasicParsing -Headers $headers -Uri "https://api.github.com/repos/$repo/zipball/$sourceSha" -OutFile $archive
    New-Item -ItemType Directory -Path $extractRoot -Force | Out-Null
    Expand-Archive -LiteralPath $archive -DestinationPath $extractRoot -Force
    $extractedRoot = Get-ChildItem -LiteralPath $extractRoot -Directory | Select-Object -First 1
    if (-not $extractedRoot) { throw 'The GitHub source archive did not contain a source folder.' }
    Move-Item -LiteralPath $extractedRoot.FullName -Destination $sourceRoot
} finally {
    Remove-Item -LiteralPath $archive -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $extractRoot -Recurse -Force -ErrorAction SilentlyContinue
}

$projectDir = Join-Path $sourceRoot 'windows-native-dotnet\src\AshkeGhalam.Windows'
$projectFile = Join-Path $projectDir 'AshkeGhalam.Windows.csproj'
$storeFile = Join-Path $projectDir 'Services\LocalDataStore.cs'
if (-not (Test-Path -LiteralPath $projectFile)) { throw 'The WPF project file was not found in the selected branch.' }
if (-not (Test-Path -LiteralPath $storeFile)) {
    throw 'LocalDataStore.cs was not found; refusing to run without checking data isolation.'
}

# Restore the font that the actual WPF UI expects; the binary is not committed to this branch.
$fontDir = Join-Path $projectDir 'Assets\Fonts'
New-Item -ItemType Directory -Path $fontDir -Force | Out-Null
$fontBase = 'https://raw.githubusercontent.com/rastikerdar/vazirmatn/6e553e33489a8f9dfaccc76860a2e3f3c1e66de7'
Invoke-WebRequest -UseBasicParsing -Uri "$fontBase/fonts/ttf/Vazirmatn-Regular.ttf" -OutFile (Join-Path $fontDir 'Vazirmatn-Regular.ttf')
Invoke-WebRequest -UseBasicParsing -Uri "$fontBase/OFL.txt" -OutFile (Join-Path $fontDir 'OFL.txt')
if ((Get-Item (Join-Path $fontDir 'Vazirmatn-Regular.ttf')).Length -lt 50000) {
    throw 'The Persian font download appears incomplete.'
}

# Patch only this disposable source checkout so preview data cannot overwrite normal accounting data.
$storeText = Get-Content -LiteralPath $storeFile -Raw
if ($storeText -notmatch 'ASHKGHALAM_DATA_PATH') {
    $pattern = '(?m)^[\t ]*_filePath = filePath \?\? Path\.Combine\(\r?\n[\t ]*Environment\.GetFolderPath\(Environment\.SpecialFolder\.LocalApplicationData\),\r?\n[\t ]*"AshkeGhalam", "WindowsNative", "accounting-data\.dat"\);'
    $replacement = @'
        var previewPath = Environment.GetEnvironmentVariable("ASHKGHALAM_DATA_PATH");
        _filePath = filePath ?? (!string.IsNullOrWhiteSpace(previewPath)
            ? Path.GetFullPath(previewPath)
            : Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "AshkeGhalam", "WindowsNative", "accounting-data.dat"));
'@
    $updatedText = [regex]::Replace($storeText, $pattern, $replacement.TrimEnd())
    if ($updatedText -eq $storeText) {
        throw 'Could not safely isolate the preview data path; the app was not launched.'
    }
    Set-Content -LiteralPath $storeFile -Value $updatedText -Encoding utf8
}

$dataFile = Join-Path $dataRoot 'accounting-data-preview.dat'
$env:ASHKGHALAM_DATA_PATH = $dataFile
Write-Host ''
Write-Host 'Starting the native WPF app on this desktop...' -ForegroundColor Green
Write-Host ("Source commit: " + $sourceSha)
Write-Host ("Isolated preview data: " + $dataFile)
Write-Host 'Close the WPF application window to finish this script.'
Write-Host 'If viewing through Chrome Remote Desktop, keep the remote connection but do not open its viewer inside the desktop being mirrored.'
Write-Host ''
& $dotnetExe run --project $projectFile --configuration Debug
if ($LASTEXITCODE -ne 0) {
    throw "WPF exited with code $LASTEXITCODE. Review the messages above."
}
Write-Host 'WPF closed normally.' -ForegroundColor Green
