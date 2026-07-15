#!/usr/bin/env node
/**
 * 按贡献量排名生成 README 贡献者头像墙（过滤 Bot / CI）。
 *
 *   node scripts/sync-contributors-wall.mjs
 *   node scripts/sync-contributors-wall.mjs --check   # CI：与仓库不一致则失败
 *
 * 环境变量：
 *   GITHUB_TOKEN / GH_TOKEN  可选，提高 API 限额
 *   CONTRIBUTORS_REPO        默认 foxletters-hq/BaiShou-Next
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const check = process.argv.includes('--check')
const repo = process.env.CONTRIBUTORS_REPO || 'foxletters-hq/BaiShou-Next'
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ''

const START = '<!-- CONTRIBUTORS-WALL:START -->'
const END = '<!-- CONTRIBUTORS-WALL:END -->'
const AVATAR_SIZE = 64
const MAX = 48

/** 额外排除的登录名（大小写不敏感）；GitHub type=Bot 与 [bot] 后缀也会过滤 */
const EXCLUDE_LOGINS = new Set([
  'github-actions[bot]',
  'dependabot[bot]',
  'renovate[bot]',
  'ci-bot',
  'imgbot[bot]'
])

const TARGETS = [
  path.join(root, 'README.md'),
  path.join(root, 'docs/3-Project/README_EN.md')
]

function isBot(contributor) {
  const login = (contributor.login || '').toLowerCase()
  if (contributor.type === 'Bot') return true
  if (login.endsWith('[bot]')) return true
  if (EXCLUDE_LOGINS.has(login)) return true
  if (login.includes('bot') && login.includes('ci')) return true
  return false
}

async function fetchContributors() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'baishou-contributors-wall'
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const all = []
  let page = 1
  while (page <= 5) {
    const url = `https://api.github.com/repos/${repo}/contributors?per_page=100&page=${page}`
    const res = await fetch(url, { headers })
    if (!res.ok) {
      throw new Error(`GitHub contributors API ${res.status}: ${await res.text()}`)
    }
    const batch = await res.json()
    if (!Array.isArray(batch) || batch.length === 0) break
    all.push(...batch)
    if (batch.length < 100) break
    page += 1
  }

  return all
    .filter((c) => c?.login && !isBot(c))
    .sort((a, b) => (b.contributions || 0) - (a.contributions || 0))
    .slice(0, MAX)
}

function renderWall(contributors) {
  if (contributors.length === 0) {
    return `${START}\n_暂无贡献者数据_\n${END}`
  }

  const links = contributors.map((c) => {
    const login = c.login
    const avatar =
      c.avatar_url || `https://avatars.githubusercontent.com/u/${c.id}?v=4`
    const src = `${avatar}${avatar.includes('?') ? '&' : '?'}s=${AVATAR_SIZE}`
    return `<a href="https://github.com/${login}" title="${login}"><img src="${src}" width="${AVATAR_SIZE}" height="${AVATAR_SIZE}" alt="${login}"/></a>`
  })

  return [
    START,
    `<!-- 按 GitHub 贡献量自动排序；已过滤 Bot / CI。勿手改；运行: pnpm sync:contributors -->`,
    links.join('\n'),
    END
  ].join('\n')
}

function updateFile(filePath, wall) {
  const original = readFileSync(filePath, 'utf8')
  if (!original.includes(START) || !original.includes(END)) {
    throw new Error(`${path.relative(root, filePath)} 缺少 ${START} / ${END} 标记`)
  }
  const next = original.replace(
    new RegExp(`${START}[\\s\\S]*?${END}`),
    () => wall
  )
  if (next === original) return false
  if (check) {
    console.error(`[sync-contributors-wall] 过期: ${path.relative(root, filePath)}`)
    return true
  }
  writeFileSync(filePath, next)
  console.log(`[sync-contributors-wall] 已更新 ${path.relative(root, filePath)}`)
  return true
}

const contributors = await fetchContributors()
console.log(
  `[sync-contributors-wall] ${contributors.length} 人（已按贡献量排序、过滤 Bot）:`,
  contributors.map((c) => `${c.login}(${c.contributions})`).join(', ')
)

const wall = renderWall(contributors)
let changed = false
for (const file of TARGETS) {
  if (updateFile(file, wall)) changed = true
}

if (check && changed) {
  console.error('[sync-contributors-wall] README 贡献者墙与 API 不一致，请运行 pnpm sync:contributors')
  process.exit(1)
}

if (!changed) {
  console.log('[sync-contributors-wall] 无需更新')
}
