import { createHash } from 'node:crypto'
import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import type { LegacyMigrationSectionId } from '@baishou/shared'
import { parseJournalMarkdown } from '../diary/journal-markdown.parser'
import { parseFlutterSharedPreferencesJson } from './flutter-shared-prefs.util'

export const LEGACY_MIGRATION_SECTION_LABELS: Record<LegacyMigrationSectionId, string> = {
  avatar: '用户头像',
  identityCards: '身份卡',
  config: '配置',
  diaries: '日记',
  assistants: '伙伴',
  chatMessages: '聊天记录',
  workspaces: '工作空间'
}

export function formatMigrationSizeBytes(bytes: number): string {
  if (bytes <= 0) return '0 MB'
  const mb = bytes / (1024 * 1024)
  if (mb < 0.01) return '< 0.01 MB'
  return `${mb.toFixed(2)} MB`
}

/** 在名称末尾追加两位随机数字，避免同名冲突 */
export function appendTwoRandomDigits(baseName: string): string {
  const trimmed = baseName.trim()
  const suffix = String(Math.floor(Math.random() * 90) + 10)
  return `${trimmed} ${suffix}`
}

export function parseFlutterPersonasFromSp(
  sp: Record<string, unknown> | null
): Array<{ id: string; facts: Record<string, string> }> {
  if (!sp) return []
  const raw = sp['user_personas']
  if (typeof raw !== 'string' || !raw.trim()) {
    const legacyFacts = sp['user_identity_facts']
    if (typeof legacyFacts === 'string' && legacyFacts.trim()) {
      try {
        const facts = JSON.parse(legacyFacts) as Record<string, string>
        return [{ id: '默认身份', facts }]
      } catch {
        return []
      }
    }
    return []
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, Record<string, string>>
    return Object.entries(parsed).map(([id, facts]) => ({
      id,
      facts: Object.fromEntries(Object.entries(facts ?? {}).map(([k, v]) => [k, String(v)]))
    }))
  } catch {
    return []
  }
}

export async function sumDirectorySizeBytes(
  fileSystem: IFileSystem,
  rootDir: string,
  options?: { skipDirNames?: Set<string> }
): Promise<number> {
  if (!(await fileSystem.exists(rootDir))) return 0

  let total = 0
  async function walk(dir: string): Promise<void> {
    let entries: string[] = []
    try {
      entries = await fileSystem.readdir(dir)
    } catch {
      return
    }
    for (const name of entries) {
      if (options?.skipDirNames?.has(name)) continue
      const full = path.join(dir, name)
      let stat
      try {
        stat = await fileSystem.stat(full)
      } catch {
        continue
      }
      if (stat.isDirectory) {
        await walk(full)
      } else if (stat.isFile) {
        total += stat.size ?? 0
      }
    }
  }
  await walk(rootDir)
  return total
}

export async function countJournalMarkdownFiles(
  fileSystem: IFileSystem,
  journalsDir: string
): Promise<{ count: number; sizeBytes: number; samples: string[] }> {
  if (!(await fileSystem.exists(journalsDir))) {
    return { count: 0, sizeBytes: 0, samples: [] }
  }

  let count = 0
  let sizeBytes = 0
  const samples: string[] = []

  async function walk(dir: string): Promise<void> {
    let entries: string[] = []
    try {
      entries = await fileSystem.readdir(dir)
    } catch {
      return
    }
    for (const name of entries) {
      const full = path.join(dir, name)
      let stat
      try {
        stat = await fileSystem.stat(full)
      } catch {
        continue
      }
      if (stat.isDirectory) {
        await walk(full)
        continue
      }
      if (!name.endsWith('.md')) continue
      count += 1
      sizeBytes += stat.size ?? 0
      if (samples.length < 5) {
        samples.push(name.replace(/\.md$/, ''))
      }
    }
  }

  await walk(journalsDir)
  return { count, sizeBytes, samples }
}

export function parseSharedPreferencesJson(raw: string): Record<string, unknown> {
  return parseFlutterSharedPreferencesJson(raw)
}

/** 从日记 Markdown 文件名或 frontmatter 日期提取 YYYY-MM-DD */
export function extractJournalDateKey(raw: string, fallbackBaseName: string): string | null {
  const candidates = [raw, fallbackBaseName]
  for (const candidate of candidates) {
    const match = candidate.match(/(\d{4}-\d{2}-\d{2})/)
    if (match?.[1]) return match[1]
  }
  return null
}

/** 扫描与导入统一的 Markdown 日记日期解析（含 frontmatter） */
export function resolveJournalMarkdownDateKey(rawContent: string, baseName: string): string | null {
  const parsed = parseJournalMarkdown(rawContent, baseName)
  const dateKey =
    extractJournalDateKey(parsed?.date ?? '', baseName) ??
    extractJournalDateKey(rawContent, baseName)
  if (!dateKey || !isValidDateKey(dateKey)) return null
  return dateKey
}

export interface LegacyDiaryMarkdownEntry {
  path: string
  vaultName: string
  dateKey: string
  content: string
  contentHash: string
  tags?: string
  weather?: string
  mood?: string
  location?: string
  locationDetail?: string
  isFavorite?: boolean
}

export interface LegacyDiarySqliteEntry {
  vaultName: string
  dateKey: string
  content: string
  contentHash: string
  tags?: string
  weather?: string
  mood?: string
  location?: string
  locationDetail?: string
  isFavorite?: boolean
}

export function parseLegacyDiaryMarkdownFile(
  rawContent: string,
  filePath: string,
  vaultName: string
): LegacyDiaryMarkdownEntry | null {
  const baseName = filePath.split(/[/\\]/).pop()?.replace(/\.md$/, '') ?? ''
  const dateKey = resolveJournalMarkdownDateKey(rawContent, baseName)
  if (!dateKey) return null
  const parsed = parseJournalMarkdown(rawContent, baseName)
  const content = parsed?.content?.trim() || rawContent.trim()
  if (!content) return null
  return {
    path: filePath,
    vaultName,
    dateKey,
    content,
    contentHash: hashDiaryContent(content),
    tags: parsed?.tags?.join(',') ?? undefined,
    weather: parsed?.weather,
    mood: parsed?.mood,
    location: parsed?.location,
    locationDetail: parsed?.locationDetail,
    isFavorite: parsed?.isFavorite ?? false
  }
}

export async function collectLegacyDiaryMarkdownEntries(
  fileSystem: IFileSystem,
  journalsDir: string,
  vaultName: string
): Promise<LegacyDiaryMarkdownEntry[]> {
  const out: LegacyDiaryMarkdownEntry[] = []

  async function walk(dir: string): Promise<void> {
    if (!(await fileSystem.exists(dir))) return
    let entries: string[] = []
    try {
      entries = await fileSystem.readdir(dir)
    } catch {
      return
    }
    for (const name of entries) {
      const full = path.join(dir, name)
      let stat
      try {
        stat = await fileSystem.stat(full)
      } catch {
        continue
      }
      if (stat.isDirectory) {
        await walk(full)
        continue
      }
      if (!name.endsWith('.md')) continue
      try {
        const raw = await fileSystem.readFile(full, 'utf8')
        const entry = parseLegacyDiaryMarkdownFile(raw, full, vaultName)
        if (entry) out.push(entry)
      } catch {
        // skip unreadable
      }
    }
  }

  await walk(journalsDir)
  return out
}

export type LegacyDiaryImportItem = Omit<LegacyDiaryMarkdownEntry, 'path'> & {
  source: 'markdown' | 'sqlite'
  path?: string
}

/** 构建可导入日记列表：每篇 Markdown 独立一项；SQLite 仅补缺未被 Markdown 覆盖的日期 */
export function buildLegacyDiaryImportItems(
  markdownEntries: LegacyDiaryMarkdownEntry[],
  sqliteEntries: LegacyDiarySqliteEntry[]
): LegacyDiaryImportItem[] {
  const items: LegacyDiaryImportItem[] = markdownEntries.map((entry) => ({
    ...entry,
    source: 'markdown' as const
  }))

  const markdownDatesByVault = new Map<string, Set<string>>()
  for (const entry of markdownEntries) {
    const dates = markdownDatesByVault.get(entry.vaultName) ?? new Set<string>()
    dates.add(entry.dateKey)
    markdownDatesByVault.set(entry.vaultName, dates)
  }

  for (const row of sqliteEntries) {
    if (!isValidDateKey(row.dateKey)) continue
    const covered = markdownDatesByVault.get(row.vaultName)?.has(row.dateKey)
    if (covered) continue
    const content = row.content.trim()
    if (!content) continue
    items.push({
      vaultName: row.vaultName,
      dateKey: row.dateKey,
      content,
      contentHash: hashDiaryContent(content),
      tags: row.tags,
      weather: row.weather,
      mood: row.mood,
      location: row.location,
      locationDetail: row.locationDetail,
      isFavorite: row.isFavorite,
      source: 'sqlite'
    })
  }

  return items
}

export interface LegacyBaishouDiaryPreview {
  vaultName: string
  dateKey: string
  sizeBytes: number
}

/** 将 baishou.sqlite 路径映射到所属 vault 名称 */
export function mapBaishouDbToVaultName(dbPath: string, vaultNames: string[]): string | null {
  const normalized = dbPath.replace(/\\/g, '/')
  for (const vaultName of vaultNames) {
    const marker = `/${vaultName}/.baishou/baishou.sqlite`
    if (normalized.endsWith(marker) || normalized.includes(`${marker}`)) {
      return vaultName
    }
  }
  return null
}

export function normalizeDiaryImportKey(vaultName: string, dateKey: string): string {
  return `${vaultName}/${dateKey}`
}

export function hashDiaryContent(content: string): string {
  return createHash('sha256').update(content.trim()).digest('hex').slice(0, 16)
}

export function diaryManifestKey(vaultName: string, dateKey: string, contentHash: string): string {
  return `${normalizeDiaryImportKey(vaultName, dateKey)}:${contentHash}`
}

export function hashIdentityFacts(facts: Record<string, string>): string {
  const sorted = Object.keys(facts)
    .sort()
    .map((k) => `${k}=${facts[k]}`)
    .join('|')
  return createHash('sha256').update(sorted).digest('hex').slice(0, 16)
}

export function personaManifestKey(sourceId: string, facts: Record<string, string>): string {
  return `${sourceId}:${hashIdentityFacts(facts)}`
}

export function isValidDateKey(dateKey: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return false
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number]
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

/** 从 SP 或 device_preferences.identity_facts 解析可导入身份卡 */
export { resolveLegacyIdentityPersonas } from './legacy-version-migration.util'

export async function countArchiveMarkdownFiles(
  fileSystem: IFileSystem,
  archivesDir: string
): Promise<{ count: number; sizeBytes: number; samples: string[] }> {
  return countJournalMarkdownFiles(fileSystem, archivesDir)
}

/** @deprecated 使用 countImportableDiaryEntries */
export function countUniqueDiaryEntries(
  markdownByVault: Map<string, Set<string>>,
  sqliteByVault: Map<string, Set<string>>
): number {
  const markdownCountByVault = new Map<string, number>()
  for (const [vault, dates] of markdownByVault) {
    markdownCountByVault.set(vault, dates.size)
  }
  return countImportableDiaryEntries(markdownCountByVault, markdownByVault, sqliteByVault)
}

/** 统计可导入日记数：每篇 Markdown 计一项；SQLite 仅补缺未被 Markdown 覆盖的日期 */
export function countImportableDiaryEntries(
  markdownCountByVault: Map<string, number>,
  markdownDatesByVault: Map<string, Set<string>>,
  sqliteByVault: Map<string, Set<string>>
): number {
  let total = 0
  for (const count of markdownCountByVault.values()) {
    total += count
  }
  for (const [vault, sqDates] of sqliteByVault) {
    const mdDates = markdownDatesByVault.get(vault) ?? new Set<string>()
    for (const dateKey of sqDates) {
      if (!mdDates.has(dateKey)) total += 1
    }
  }
  return total
}

export function resolveLegacyAvatarCandidates(
  sp: Record<string, unknown> | null,
  sourceDir: string,
  options: { includeMachinePaths: boolean; documentsAvatarsDir?: string }
): string[] {
  const paths: string[] = []
  const fromSp = sp?.['user_avatar_path']
  if (typeof fromSp === 'string' && fromSp.trim()) {
    paths.push(fromSp.trim())
  }
  if (options.includeMachinePaths && options.documentsAvatarsDir) {
    for (const name of [
      'user_avatar.jpg',
      'user_avatar.png',
      'user_avatar.webp',
      'user_avatar.jpeg'
    ]) {
      paths.push(path.join(options.documentsAvatarsDir, name))
    }
  }
  const configDir = path.join(sourceDir, 'config')
  for (const name of ['avatar.jpg', 'avatar.png', 'avatar.webp', 'avatar.jpeg']) {
    paths.push(path.join(configDir, name))
  }
  return paths
}
