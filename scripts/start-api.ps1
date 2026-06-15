$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $projectRoot

function Test-Command($name) {
  return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function Get-PythonCommand {
  if (Get-Command py -ErrorAction SilentlyContinue) {
    return @('py', '-m')
  }

  if (Get-Command python -ErrorAction SilentlyContinue) {
    return @('python', '-m')
  }

  throw 'Python 3.11+ no esta instalado o no esta en el PATH.'
}

function Get-EnvValue($name, $fallback) {
  if (-not (Test-Path '.env')) {
    return $fallback
  }

  $line = Get-Content '.env' | Where-Object { $_ -match "^\s*$name\s*=" } | Select-Object -First 1
  if (-not $line) {
    return $fallback
  }

  return ($line -replace "^\s*$name\s*=\s*", '').Trim()
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

if (-not (Test-Command docker)) {
  throw 'Docker Desktop no esta instalado o no esta en el PATH.'
}

Write-Host 'Levantando MySQL con Docker...'
docker compose up -d mysql
Wait-ForMysqlContainer

$apiPort = Get-EnvValue 'API_PORT' '4000'
$python = Get-PythonCommand

Write-Host "Arrancando API en http://127.0.0.1:$apiPort ..."
& $python[0] $python[1] uvicorn backend.api.main:app --reload --host 0.0.0.0 --port $apiPort
