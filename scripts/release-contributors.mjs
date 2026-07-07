/**
 * 从 git 提交邮箱解析 GitHub 贡献者（避免误 @ 无关账号）。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const MAP_PATH = join(root, 'releases/contributor-map.json')

const SKIP_COMMIT_RE =
  /^chore\(release\):|^chore: release|更新 releases\/channel\.json|\[skip ci\]/i

let cachedMap

export function loadContributorMap() {
  if (cachedMap) return cachedMap
  const raw = JSON.parse(readFileSync(MAP_PATH, 'utf8'))
  const emails = Object.fromEntries(
    Object.entries(raw.emails || {}).map(([k, v]) => [k.trim().toLowerCase(), v])
  )
  cachedMap = {
    emails,
    bots: new Set((raw.bots || []).map((b) => b.toLowerCase()))
  }
  return cachedMap
}

/** @returns {{ displayName: string, github: string | null, email: string }} */
export function resolveContributor(authorName, authorEmail) {
  const map = loadContributorMap()
  const email = (authorEmail || '').trim().toLowerCase()
  const name = (authorName || '').trim()

  if (!name && !email) {
    return { displayName: '贡献者', github: null, email }
  }

  if (name && map.bots.has(name.toLowerCase())) {
    return { displayName: name, github: null, email }
  }

  const noreply = email.match(/^(?:\d+\+)?([^@+]+)@users\.noreply\.github\.com$/i)
  if (noreply?.[1] && !map.bots.has(noreply[1].toLowerCase())) {
    return { displayName: name || noreply[1], github: noreply[1], email }
  }

  const mapped = map.emails[email]
  if (mapped) {
    return { displayName: name || mapped, github: mapped, email }
  }

  return { displayName: name || email, github: null, email }
}

function git(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `git ${args.join(' ')} failed`)
  }
  return result.stdout.trim()
}

export function listPlatformTags(platform) {
  const out = git(['tag', '-l', `${platform}/v*`, '--sort=-v:refname'])
  return out ? out.split('\n').filter(Boolean) : []
}

export function resolvePreviousPlatformTag(platform, version) {
  const current = `${platform}/v${version}`
  const tags = listPlatformTags(platform)
  const idx = tags.indexOf(current)
  if (idx >= 0 && tags[idx + 1]) return tags[idx + 1]
  return tags.find((tag) => tag !== current)
}

/** @returns {Array<{ displayName: string, github: string | null, email: string }>} */
export function collectReleaseContributors(fromRef) {
  const range = fromRef ? `${fromRef}..HEAD` : 'HEAD'
  const out = git(['log', range, '--no-merges', '--pretty=format:%an|%ae|%s'])
  if (!out) return []

  const byGithub = new Map()
  const byEmail = new Map()

  for (const line of out.split('\n')) {
    const [authorName, authorEmail, ...rest] = line.split('|')
    const subject = rest.join('|')
    if (SKIP_COMMIT_RE.test(subject)) continue

    const person = resolveContributor(authorName, authorEmail)
    if (!person.github) {
      if (!byEmail.has(person.email)) byEmail.set(person.email, person)
      continue
    }

    const key = person.github.toLowerCase()
    if (!byGithub.has(key)) {
      byGithub.set(key, person)
    }
  }

  return [...byGithub.values()].sort((a, b) =>
    a.github.localeCompare(b.github, undefined, { sensitivity: 'base' })
  )
}

export function formatContributorThanks(contributors) {
  if (!contributors.length) return ''

  const handles = contributors.filter((c) => c.github).map((c) => `@${c.github}`)
  if (!handles.length) return ''

  const list =
    handles.length === 1
      ? handles[0]
      : handles.length === 2
        ? `${handles[0]}、${handles[1]}`
        : `${handles.slice(0, -1).join('、')}、${handles[handles.length - 1]}`

  return `感谢 ${list} 在本版本的贡献。`
}

export function renderContributorSection(contributors) {
  const thanks = formatContributorThanks(contributors)
  if (!thanks) return ''

  const lines = ['## 贡献者', '', thanks, '']
  const unmapped = contributors.filter((c) => !c.github)
  if (unmapped.length > 0) {
    lines.push(
      '（另有提交署名：' +
        [...new Set(unmapped.map((c) => c.displayName))].join('、') +
        '，未配置 GitHub 邮箱映射）',
      ''
    )
  }
  return lines.join('\n')
}
