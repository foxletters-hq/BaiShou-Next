/**
 * 跨平台入口：在仓库任意子目录执行 `pnpm ci:check` 即可跑完整本地 CI。
 */
import { execSync, spawnSync } from 'node:child_process'
import { join } from 'node:path'

const root = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim()
const isWin = process.platform === 'win32'
const script = join(root, 'scripts', isWin ? 'ci-check.ps1' : 'ci-check.sh')

const result = isWin
  ? spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script], {
      stdio: 'inherit',
      cwd: root
    })
  : spawnSync('bash', [script], { stdio: 'inherit', cwd: root })

process.exit(result.status === null ? 1 : result.status)
