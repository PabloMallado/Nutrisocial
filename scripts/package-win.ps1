$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$packageDir = Join-Path $projectRoot 'dist-package'
$stagingDir = Join-Path $packageDir 'NutriSocial-win-support'
$zipPath = Join-Path $packageDir 'NutriSocial-win-complete.zip'

Set-Location $projectRoot

if (-not (Test-Path 'node_modules')) {
  npm ci
}

if (-not (Test-Path '.env') -and (Test-Path '.env.example')) {
  Copy-Item '.env.example' '.env'
}

npm run build:desktop:win

if (Test-Path $stagingDir) {
  Remove-Item -LiteralPath $stagingDir -Recurse -Force
}

if (Test-Path $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

New-Item -ItemType Directory -Path $stagingDir | Out-Null

$itemsToCopy = @(
  '.env',
  '.env.example',
  'backend',
  'docker-compose.yml',
  'package-lock.json',
  'package.json',
  'README.md',
  'requirements.txt',
  'scripts'
)

foreach ($item in $itemsToCopy) {
  if (Test-Path $item) {
    Copy-Item -LiteralPath $item -Destination $stagingDir -Recurse -Force
  }
}

$desktopBuildDir = Join-Path $stagingDir 'electron-build'
New-Item -ItemType Directory -Path $desktopBuildDir | Out-Null

$desktopArtifacts = @(
  'dist/NutriSocial*.exe',
  'dist/NutriSocial*.zip',
  'dist/*.blockmap',
  'dist/latest*.yml'
)

foreach ($artifactPattern in $desktopArtifacts) {
  Copy-Item -Path $artifactPattern -Destination $desktopBuildDir -Force -ErrorAction SilentlyContinue
}

$startScript = @'
@echo off
setlocal
cd /d "%~dp0"

if not exist .env (
  copy .env.example .env >nul
)

docker compose up -d mysql
call npm ci
python -m pip install -r requirements.txt
start "NutriSocial API" python -m uvicorn backend.api.main:app --host 127.0.0.1 --port 4000
echo.
echo Install NutriSocial from electron-build, then open it.
echo The API and database are now running.
pause
'@

Set-Content -LiteralPath (Join-Path $stagingDir 'START-WINDOWS.bat') -Value $startScript -Encoding ASCII

$readme = @'
NutriSocial Windows package
===========================

1. Install prerequisites if they are not installed:
   - Node.js 20+
   - Python 3.11+
   - Docker Desktop

2. Review .env. The default database uses MySQL on port 3307.

3. Run START-WINDOWS.bat.

Database
--------

The full initial database schema and seed data are included in:

backend/db/init.sql

Docker loads that SQL automatically the first time the MySQL volume is created.
If you already had an old Docker volume, run "docker compose down -v" before
START-WINDOWS.bat to recreate the database from init.sql.
'@

Set-Content -LiteralPath (Join-Path $stagingDir 'README-WINDOWS.txt') -Value $readme -Encoding ASCII

Compress-Archive -LiteralPath $stagingDir -DestinationPath $zipPath -Force

Write-Host "Created $zipPath"
Write-Host "Electron Windows artifacts are in $(Join-Path $projectRoot 'dist')"
