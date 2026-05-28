#!/usr/bin/env node
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { METRO_PORT, devClientEnv, getLanIp } from './mobile-dev-env.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const mobileRoot = path.resolve(__dirname, '..')
const clean = process.argv.includes('--clean')

const host = getLanIp()
console.log(`\n🔨 编译安装 Android 开发版，Metro: http://${host}:${METRO_PORT}\n`)

const args = ['expo', 'run:android', '--port', METRO_PORT]
if (clean) {
  args.push('-c')
}

const child = spawn('npx', args, {
  cwd: mobileRoot,
  env: devClientEnv(),
  stdio: 'inherit'
})

child.on('exit', (code) => process.exit(code ?? 0))
