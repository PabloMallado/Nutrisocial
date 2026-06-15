import { spawn } from 'node:child_process'
import { copyFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import electronPath from 'electron'

const rendererUrl = 'http://127.0.0.1:5173'
const apiHealthUrl = 'http://127.0.0.1:4000/api/health'
const isWindows = process.platform === 'win32'
const npmCommand = isWindows ? 'npm.cmd' : 'npm'
const children = []
const projectRoot = fileURLToPath(new URL('../', import.meta.url))

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function isReachable(url) {
  try {
    const response = await fetch(url)
    return response.ok
  } catch {
    return false
  }
}

function runProcess(command, args, label, extraEnv = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: isWindows && command === npmCommand,
    cwd: projectRoot,
    env: { ...process.env, ...extraEnv },
  })

  children.push(child)
  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`[${label}] terminado con codigo ${code}`)
    }
  })

  return child
}

function runOneShot(command, args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: isWindows && command === 'docker',
      cwd: projectRoot,
    })

    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`${label} terminado con codigo ${code}`))
    })
  })
}

function getApiCommand() {
  if (isWindows) {
    return { command: 'py', args: ['-m', 'uvicorn'] }
  }

  return { command: 'python3', args: ['-m', 'uvicorn'] }
}

async function ensureLocalEnv() {
  const envPath = fileURLToPath(new URL('../.env', import.meta.url))
  const examplePath = fileURLToPath(new URL('../.env.example', import.meta.url))
  if (!existsSync(envPath) && existsSync(examplePath)) {
    copyFileSync(examplePath, envPath)
  }
}

async function ensureDatabase() {
  try {
    console.log('[desktop] levantando MySQL...')
    await runOneShot('docker', ['compose', 'up', '-d', 'mysql'], 'docker compose')
    await waitForMysqlContainer()
  } catch (error) {
    console.warn(`[desktop] no se pudo levantar MySQL automaticamente: ${error.message}`)
    console.warn('[desktop] arranca Docker Desktop y ejecuta: npm run db:up')
  }
}

async function getMysqlHealthStatus() {
  return new Promise((resolve) => {
    const child = spawn('docker', ['inspect', '-f', '{{.State.Health.Status}}', 'tfg-mysql'], {
      cwd: projectRoot,
      shell: isWindows,
    })

    let output = ''
    child.stdout.on('data', (chunk) => {
      output += chunk.toString()
    })

    child.on('exit', (code) => {
      resolve(code === 0 ? output.trim() : '')
    })
  })
}

async function waitForMysqlContainer(timeoutMs = 90000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const status = await getMysqlHealthStatus()
    if (status === 'healthy') {
      return
    }
    await sleep(1000)
  }

  throw new Error('MySQL no esta healthy. Revisa los logs con: npm run db:logs')
}

async function waitForService(url, label, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await isReachable(url)) {
      return
    }
    await sleep(700)
  }
  throw new Error(`Tiempo agotado esperando ${label} en ${url}`)
}

function stopChildren() {
  for (const child of children) {
    if (!child.killed) {
      child.kill()
    }
  }
}

process.on('SIGINT', () => {
  stopChildren()
  process.exit(0)
})

process.on('SIGTERM', () => {
  stopChildren()
  process.exit(0)
})

async function main() {
  await ensureLocalEnv()
  await ensureDatabase()

  const apiWasRunning = await isReachable(apiHealthUrl)
  const webWasRunning = await isReachable(rendererUrl)

  if (!apiWasRunning) {
    console.log('[desktop] arrancando API...')
    const apiCommand = getApiCommand()
    runProcess(
      apiCommand.command,
      [...apiCommand.args, 'backend.api.main:app', '--host', '127.0.0.1', '--port', '4000'],
      'api',
    )
  }

  if (!webWasRunning) {
    console.log('[desktop] arrancando Vite...')
    runProcess(npmCommand, ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173'], 'vite')
  }

  await waitForService(apiHealthUrl, 'API')
  await waitForService(rendererUrl, 'frontend')

  console.log('[desktop] lanzando Electron...')
  const electronProcess = runProcess(
    electronPath,
    ['.'],
    'electron',
    { ELECTRON_RENDERER_URL: rendererUrl },
  )

  electronProcess.on('exit', () => {
    stopChildren()
    process.exit(0)
  })
}

main().catch((error) => {
  console.error(`[desktop] ${error.message}`)
  stopChildren()
  process.exit(1)
})
