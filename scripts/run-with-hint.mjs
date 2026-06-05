#!/usr/bin/env node
/**
 * 打印一行说明后执行命令。用于 package.json scripts 自描述。
 * 用法: node scripts/run-with-hint.mjs "说明文字" command arg1 arg2 ...
 */
import { spawnSync } from 'node:child_process'

const argv = process.argv.slice(2)
if (argv.length < 2) {
  console.error('用法: node scripts/run-with-hint.mjs "<说明>" <command> [args...]')
  process.exit(1)
}

const [hint, command, ...args] = argv
console.log(`\n📌 ${hint}\n`)

const result = spawnSync(command, args, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env
})

process.exit(result.status === null ? 1 : result.status)
