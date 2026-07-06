#!/usr/bin/env node
/**
 * 分端发版打 tag（合并到 main 后执行）：
 *
 *   pnpm release:tag mobile          # 仅 Android → mobile/v{apps/mobile 版本}
 *   pnpm release:tag desktop         # 仅 Windows → desktop/v{apps/desktop 版本}
 *   pnpm release:tag all             # 两端同版本时一次发版 → mobile/v* + desktop/v*
 *   pnpm release:tag mobile --push   # 校验通过后创建并推送 tag
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const push = args.includes('--push')
const platformArg = args.find((a) => a !== '--push') || 'mobile'

const PLATFORMS = {
  mobile: { app: 'mobile', tagPrefix: 'mobile/v', label: 'Android' },
  desktop: { app: 'desktop', tagPrefix: 'desktop/v', label: 'Windows' }
}

function readVersion(app) {
  const path = join(root, 'apps', app, 'src/version.json')
  return JSON.parse(readFileSync(path, 'utf8'))
}

function run(cmd, cmdArgs) {
  const result = spawnSync(cmd, cmdArgs, { cwd: root, stdio: 'inherit', shell: false })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function resolveTargets() {
  if (platformArg === 'all') {
    return [PLATFORMS.mobile, PLATFORMS.desktop]
  }
  const target = PLATFORMS[platformArg]
  if (!target) {
    console.error(`\n❌ 未知平台 "${platformArg}"，请使用 mobile | desktop | all\n`)
    process.exit(1)
  }
  return [target]
}

const targets = resolveTargets()

if (platformArg === 'all') {
  const mobileVer = readVersion('mobile').version
  const desktopVer = readVersion('desktop').version
  if (mobileVer !== desktopVer) {
    console.error(`\n❌ 两端版本不同（mobile ${mobileVer} / desktop ${desktopVer}）`)
    console.error(
      '   请分别执行：pnpm release:tag mobile --push  或  pnpm release:tag desktop --push\n'
    )
    process.exit(1)
  }
}

console.log('\n🔄 校验 package.json / app.json 版本同步…')
run(process.execPath, [join(root, 'scripts/sync-app-version.mjs'), '--check'])

const tags = targets.map((t) => {
  const manifest = readVersion(t.app)
  return {
    ...t,
    version: manifest.version,
    tag: `${t.tagPrefix}${manifest.version}`
  }
})

const branch = spawnSync('git', ['symbolic-ref', '--short', 'HEAD'], {
  cwd: root,
  encoding: 'utf8'
})
const currentBranch = branch.stdout?.trim()

console.log('\n✅ 待发版：')
for (const item of tags) {
  console.log(`   ${item.label}: ${item.version} → ${item.tag}`)
}
console.log(`   当前分支：${currentBranch || '(detached)'}`)

if (currentBranch && currentBranch !== 'main') {
  console.warn('\n⚠️  建议在 main 上打 tag（CI 会校验 tag 指向 main 上的 commit）')
}

if (push) {
  console.log('\n🏷️  创建并推送 tag…\n')
  for (const item of tags) {
    run('git', ['tag', item.tag])
    run('git', ['push', 'origin', item.tag])
    console.log(`   ✓ ${item.tag}`)
  }
  console.log('\n✅ 已推送，GitHub Actions 将按平台构建并发布 Release\n')
} else {
  console.log('\n下一步（在 main 上执行）：')
  for (const item of tags) {
    console.log(`  git tag ${item.tag}`)
    console.log(`  git push origin ${item.tag}`)
  }
  console.log('\n或：pnpm release:tag <mobile|desktop|all> --push\n')
}
