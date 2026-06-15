$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $projectRoot

function Get-PythonCommand {
  if (Get-Command py -ErrorAction SilentlyContinue) {
    return @('py', '-m')
  }

  if (Get-Command python -ErrorAction SilentlyContinue) {
    return @('python', '-m')
  }

  throw 'Python 3.11+ no esta instalado o no esta en el PATH.'
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw 'Node.js 20+ no esta instalado o npm no esta en el PATH.'
}

if (-not (Test-Path '.env')) {
  Copy-Item '.env.example' '.env'
  Write-Host 'Creado .env desde .env.example'
}

Write-Host 'Instalando dependencias de Node...'
npm ci

$python = Get-PythonCommand
Write-Host 'Instalando dependencias de Python...'
& $python[0] $python[1] pip install -r requirements.txt

Write-Host 'Preparacion completada.'
