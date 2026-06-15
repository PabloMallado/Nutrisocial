$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $projectRoot

function Test-Command($name) {
  return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function Wait-ForMysqlContainer {
  param([int]$TimeoutSeconds = 90)

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $status = docker inspect -f '{{.State.Health.Status}}' tfg-mysql 2>$null
    if ($LASTEXITCODE -eq 0 -and $status -eq 'healthy') {
      return
    }

    Start-Sleep -Seconds 2
  }

  throw 'MySQL no esta healthy. Revisa los logs con: npm run db:logs'
}

if (-not (Test-Path '.env')) {
  Copy-Item '.env.example' '.env'
  Write-Host 'Creado .env desde .env.example'
}

if (-not (Test-Path 'node_modules')) {
  & "$PSScriptRoot\setup.ps1"
}

if (-not (Test-Command docker)) {
  throw 'Docker Desktop no esta instalado o no esta en el PATH.'
}

Write-Host 'Levantando MySQL con Docker...'
docker compose up -d mysql
Wait-ForMysqlContainer

Write-Host 'Arrancando NutriSocial en modo escritorio...'
npm run dev:desktop
