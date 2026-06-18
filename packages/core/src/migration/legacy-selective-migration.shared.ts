import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import type { LegacyMigrationSectionId } from '@baishou/shared'
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
