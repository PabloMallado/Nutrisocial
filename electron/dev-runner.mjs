import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import electronPath from 'electron'

const rendererUrl = 'http://127.0.0.1:5173'
const apiHealthUrl = 'http://127.0.0.1:4000/api/health'
const isWindows = process.platform === 'win32'
const npmCommand = isWindows ? 'npm.cmd' : 'npm'
const pythonCommand = isWindows ? 'python' : 'python3'
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
  const apiWasRunning = await isReachable(apiHealthUrl)
  const webWasRunning = await isReachable(rendererUrl)

  if (!apiWasRunning) {
    console.log('[desktop] arrancando API...')
    runProcess(
      pythonCommand,
      ['-m', 'uvicorn', 'backend.api.main:app', '--host', '127.0.0.1', '--port', '4000'],
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
