// `npm run dev` (after building the API): start the Functions host ourselves, then the
// Static Web Apps emulator in front of it (which starts Vite via `run`).
//
// Why not let `swa start` launch the API itself? SWA CLI 2.0.10 refuses to
// start Core Tools on Node 24 because its version table is out of date —
// Core Tools runs fine on Node 24. Pointing SWA at an already-running API
// (apiDevserverUrl in swa-cli.config.json) skips that check.
import { spawn, spawnSync } from 'node:child_process'

const children = []

function run(cmd, args, cwd) {
  const child = spawn(cmd, args, { cwd, stdio: 'inherit', shell: true })
  children.push(child)
  child.on('exit', (code) => {
    if (code) console.error(`\n${cmd} ${args.join(' ')} exited with code ${code}`)
    stop(code ?? 0)
  })
  return child
}

// On Windows, child.kill() only stops the shell wrapper and leaves func, the
// SWA server and Vite holding their ports — kill each whole process tree.
function stop(code) {
  for (const c of children) {
    if (c.exitCode !== null || !c.pid) continue
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(c.pid), '/T', '/F'], { stdio: 'ignore' })
    else c.kill()
  }
  process.exit(code)
}
process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))

const api = new URL('../api/', import.meta.url)
const root = new URL('../', import.meta.url)

run('npx', ['func', 'start', '--port', '7071'], api)
run('npx', ['swa', 'start', 'resale-prep'], root)
