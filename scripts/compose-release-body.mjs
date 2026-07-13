#!/usr/bin/env node
/**
 * CI / 本地预览：拼装 GitHub Release 自定义正文（下载入口 + 中文更新说明 + 本端产物表）。
 * 贡献者与 PR 列表由 GitHub generate_release_notes 自动追加在正文之后。
 *
 *   node scripts/compose-release-body.mjs --scope mobile --version 1.2.9 \
 *     --display-version 1.2.12 --repo org/repo --append false --output body.md
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RELEASE_ARTIFACTS_VERSIONED, maxSemver } from './release-constants.mjs'
import { renderReleaseDownloadsMarkdown } from './render-release-downloads.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function parseArgs() {
  const args = process.argv.slice(2)
  const get = (flag) => {
    const i = args.indexOf(flag)
    return i >= 0 ? args[i + 1] : undefined
  }
  const scope = get('--scope')
  const version = get('--version')
  const displayVersion = get('--display-version')
  const repo = get('--repo') || 'foxletters-hq/BaiShou-Next'
  const append = get('--append') === 'true'
  const output = get('--output')
  if (!scope || !version) {
    console.error(
      '用法: compose-release-body.mjs --scope mobile|desktop --version 1.2.9 [--display-version 1.2.12] [--repo org/repo] [--append true|false] [--output body.md]'
    )
    process.exit(1)
  }
  return { scope, version, displayVersion, repo, append, output }
}

function readDraftNotes(scope, version) {
  const path = join(root, 'releases', 'notes', `${scope}-${version}.md`)
  if (!existsSync(path)) return ''
  return readFileSync(path, 'utf8').trim()
}

function readAppVersion(app) {
  return JSON.parse(readFileSync(join(root, 'apps', app, 'src/version.json'), 'utf8')).version
}

function platformSection(scope, version) {
  const isMobile = scope === 'mobile'
  const title = isMobile ? 'Android' : 'Windows'
  const versioned = isMobile
    ? RELEASE_ARTIFACTS_VERSIONED.android(version)
    : RELEASE_ARTIFACTS_VERSIONED.windows(version)
  const alias = isMobile ? 'BaiShou-Android.apk' : 'BaiShou-Windows-Setup.exe'

  return [
    `### ${title}`,
    '',
    '| 文件 | 说明 |',
    '|------|------|',
    `| \`${versioned}\` | 带版本号归档 |`,
    `| \`${alias}\` | 固定文件名 |`,
    ''
  ].join('\n')
}

function sanitizeDraftNotes(text) {
  if (!text) return ''
  return text
    .replace(/^##\s*贡献者[\s\S]*?(?=^##\s|\z)/gm, '')
    .replace(/^感谢\s+@.+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function composeReleaseBody({
  scope,
  version,
  displayVersion,
  repo,
  append = false,
  draftNotes = sanitizeDraftNotes(readDraftNotes(scope, version))
}) {
  const shown = displayVersion || version
  const parts = []

  if (!append) {
    parts.push(`## 白守 v${shown}`, '')
    parts.push(
      renderReleaseDownloadsMarkdown({
        repo,
        displayVersion: shown
      })
    )
    if (draftNotes) {
      parts.push('## 本版本更新', '', draftNotes, '')
    }
  }

  parts.push(platformSection(scope, version))
  return parts.join('\n').trimEnd() + '\n'
}

function main() {
  const { scope, version, displayVersion, repo, append, output } = parseArgs()
  const resolvedDisplay =
    displayVersion || maxSemver(readAppVersion('mobile'), readAppVersion('desktop'))
  const body = composeReleaseBody({
    scope,
    version,
    displayVersion: resolvedDisplay,
    repo,
    append
  })
  if (output) {
    writeFileSync(output, body)
  } else {
    process.stdout.write(body)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
