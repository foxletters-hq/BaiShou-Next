#!/usr/bin/env node
/**
 * 从上一次分端 tag 到 HEAD 提取提交摘要，供发版前撰写中文 Release 说明。
 * 贡献者与 PR 列表由 GitHub generate_release_notes 在 CI 中自动追加。
 *
 *   node scripts/generate-release-notes.mjs --platform mobile --version 1.2.9
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolvePreviousPlatformTag } from './release-tags.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const SKIP_COMMIT_RE =
  /^chore\(release\):|^chore: release|更新 releases\/channel\.json|\[skip ci\]/i

const CONVENTIONAL_PREFIX = {
  feat: '新功能',
  fix: '修复',
  perf: '性能',
  refactor: '重构',
  docs: '文档',
  test: '测试',
  build: '构建',
  ci: 'CI',
  chore: '维护',
  style: '样式'
}

function parseArgs() {
  const args = process.argv.slice(2)
  const get = (flag) => {
    const i = args.indexOf(flag)
    return i >= 0 ? args[i + 1] : undefined
  }
  const platform = get('--platform')
  const version = get('--version')
  const format = get('--format') || 'markdown'
  const since = get('--since')
  if (!platform || !version) {
    console.error(
      '用法: generate-release-notes.mjs --platform mobile|desktop --version 1.2.9 [--since mobile/v1.2.8] [--format markdown|json]'
    )
    process.exit(1)
  }
  if (platform !== 'mobile' && platform !== 'desktop') {
    console.error('platform 须为 mobile 或 desktop')
    process.exit(1)
  }
  return { platform, version, format, since }
}

function git(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `git ${args.join(' ')} failed`)
  }
  return result.stdout.trim()
}

function normalizeSubject(subject) {
  const match = subject.match(/^(\w+)(?:\([^)]+\))?!?:\s*(.+)$/)
  if (!match) return { category: null, summary: subject.trim() }
  const [, type, rest] = match
  const label = CONVENTIONAL_PREFIX[type] || type
  return { category: label, summary: rest.trim() }
}

function collectCommits(fromRef) {
  const range = fromRef ? `${fromRef}..HEAD` : 'HEAD'
  const out = git([
    'log',
    range,
    '--no-merges',
    '--pretty=format:%an|%ae|%s'
  ])
  if (!out) return []

  const commits = []
  for (const line of out.split('\n')) {
    const [authorName, authorEmail, ...rest] = line.split('|')
    const subject = rest.join('|')
    if (SKIP_COMMIT_RE.test(subject)) continue
    const { category, summary } = normalizeSubject(subject)
    commits.push({ authorName, authorEmail, subject, category, summary })
  }
  return commits
}

function groupByCategory(commits) {
  const groups = new Map()
  for (const commit of commits) {
    const key = commit.category || '其他'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(commit)
  }
  return groups
}

export function generateReleaseNotesData({ platform, version, since }) {
  const previousTag = since || resolvePreviousPlatformTag(platform, version)
  const notesPath = join(root, 'releases', 'notes', `${platform}-${version}.md`)
  const draftedNotes = existsSync(notesPath) ? readFileSync(notesPath, 'utf8').trim() : ''

  const commits = collectCommits(previousTag)
  const groups = groupByCategory(commits)

  return {
    platform,
    version,
    previousTag: previousTag || null,
    draftedNotes,
    draftedNotesPath: existsSync(notesPath) ? notesPath : null,
    commits,
    groups
  }
}

function renderMarkdown(data) {
  const platformLabel = data.platform === 'mobile' ? 'Android' : 'Windows'
  const lines = [
    `# ${platformLabel} v${data.version} 发版素材`,
    '',
    data.previousTag
      ? `对比范围：\`${data.previousTag}\` … \`HEAD\`（${data.commits.length} 条有效提交）`
      : `未找到上一分端 tag，对比范围：仓库首次提交 … \`HEAD\`（${data.commits.length} 条有效提交）`,
    '',
    '贡献者与 PR 列表由 **GitHub 自动生成 Release 说明** 追加，无需手写 @。',
    ''
  ]

  if (data.draftedNotes) {
    lines.push('## 已写入的 Release 说明（将用于 CI）', '', data.draftedNotes, '')
  } else {
    lines.push(
      '## 待撰写：Release 说明',
      '',
      `请将通俗易懂的更新说明写入 \`releases/notes/${data.platform}-${data.version}.md\`，再提交到 main。`,
      '',
      '### 撰写要求（Agent / 维护者）',
      '',
      '- 用**用户能听懂的话**写 3～6 条亮点，避免堆砌 commit hash',
      '- 合并相近改动，不要一条 commit 抄一行',
      '- **不要**写贡献者 @ 或感谢语',
      ''
    )
  }

  if (data.commits.length > 0) {
    lines.push('## 提交摘要（供归纳，勿原样粘贴）', '')
    for (const [category, items] of data.groups) {
      lines.push(`### ${category}`, '')
      for (const item of items) {
        lines.push(`- ${item.summary} — ${item.authorName}`)
      }
      lines.push('')
    }
  }

  return lines.join('\n').trimEnd() + '\n'
}

function main() {
  const { platform, version, format, since } = parseArgs()
  const data = generateReleaseNotesData({ platform, version, since })
  if (format === 'json') {
    console.log(JSON.stringify(data, null, 2))
  } else {
    process.stdout.write(renderMarkdown(data))
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
