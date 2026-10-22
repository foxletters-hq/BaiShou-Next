import { JOURNAL_TREE_SKIP_DIR_NAMES, isJournalPathUnderSkippedDir } from '@baishou/shared'
import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'

export { JOURNAL_TREE_SKIP_DIR_NAMES, isJournalPathUnderSkippedDir }

const JOURNAL_DATE_FILE = /^(\d{4}-\d{2}-\d{2})\.md$/i

function isAbsolutePath(p: string): boolean {
  return p.startsWith('/') || p.startsWith('\\') || /^[A-Za-z]:/.test(p)
}

/**
 * 将影子索引中的 file_path 还原为磁盘绝对路径。
 * 入库时使用 path.relative(path.dirname(journalBase), absolutePath)，此处逆运算。
 */
export function resolveShadowJournalAbsolutePath(
  journalsBase: string,
  shadowFilePath: string
): string {
  if (isAbsolutePath(shadowFilePath)) {
    return shadowFilePath
  }
  const normalized = shadowFilePath.replace(/\\/g, '/')
  return path.join(path.dirname(journalsBase), normalized)
}

/** 标准日记路径：Journals/YYYY/MM/YYYY-MM-DD.md */
export function buildCanonicalJournalFilePath(journalsBase: string, dateStr: string): string {
  const year = dateStr.substring(0, 4)
  const month = dateStr.substring(5, 7)
  return path.join(journalsBase, year, month, `${dateStr}.md`)
}

/**
 * 解析某日日记的实际磁盘路径。
 * 优先使用调用方提供的 hint，其次标准嵌套布局，最后兼容 Flutter 旧版的扁平布局。
 */
export async function resolveJournalFilePath(
  fileSystem: IFileSystem,
  journalsBase: string,
  dateStr: string,
  hintPath?: string
): Promise<string | null> {
  if (hintPath && (await fileSystem.exists(hintPath))) {
    return hintPath
  }

  const canonical = buildCanonicalJournalFilePath(journalsBase, dateStr)
  if (await fileSystem.exists(canonical)) {
    return canonical
  }

  const flat = path.join(journalsBase, `${dateStr}.md`)
  if (await fileSystem.exists(flat)) {
    return flat
  }

  return null
}

function isPathInsideDir(rootDir: string, absolutePath: string): boolean {
  const root = path.resolve(rootDir).replace(/\\/g, '/').replace(/\/+$/, '')
  const abs = path.resolve(absolutePath).replace(/\\/g, '/')
  const rootLower = root.toLowerCase()
  const absLower = abs.toLowerCase()
  return absLower === rootLower || absLower.startsWith(`${rootLower}/`)
}

/**
 * 解析关系图谱抽取所需的日记绝对路径：
 * 兼容默认 Vault 内路径、外部日记目录（如 Obsidian `2.日记/...`），以及跨端同步后的标准 `Journals/YYYY/MM/YYYY-MM-DD.md` 回退。
 */
export async function resolveGraphExtractDiaryPath(options: {
  filePath: string
  pathService: {
    getActiveVaultPath: () => Promise<string | null>
    getJournalsBaseDirectory?: () => Promise<string>
  }
  fs: IFileSystem
  dateStr?: string | null
}): Promise<string> {
  const rel = options.filePath.replace(/\\/g, '/').replace(/^\/+/, '').trim()
  if (!rel || rel.includes('\0') || rel.startsWith('/') || /^[A-Za-z]:/.test(rel)) {
    throw new Error(`Invalid diary path (must be vault-relative): ${options.filePath}`)
  }
  if (rel.split('/').some((seg) => seg === '..')) {
    throw new Error(`Invalid diary path (path traversal): ${options.filePath}`)
  }
  const vault = await options.pathService.getActiveVaultPath()
  const journalsBase =
    typeof options.pathService.getJournalsBaseDirectory === 'function'
      ? await options.pathService.getJournalsBaseDirectory().catch(() => '')
      : ''
  if (!vault && !journalsBase) {
    throw new Error('No active vault')
  }

  if (vault) {
    const absInVault = path.resolve(vault, rel)
    if (!isPathInsideDir(vault, absInVault)) {
      throw new Error(`Diary path escapes vault: ${options.filePath}`)
    }
    if (await options.fs.exists(absInVault)) {
      return absInVault
    }
  }

  const effectiveJournalsBase = journalsBase || (vault ? path.join(vault, 'Journals') : '')
  if (effectiveJournalsBase) {
    const hintAbs = path.resolve(resolveShadowJournalAbsolutePath(effectiveJournalsBase, rel))
    const hintSafe =
      isPathInsideDir(effectiveJournalsBase, hintAbs) ||
      (vault ? isPathInsideDir(vault, hintAbs) : false)
    if (hintSafe && (await options.fs.exists(hintAbs))) {
      return hintAbs
    }
    if (options.dateStr && /^\d{4}-\d{2}-\d{2}$/.test(options.dateStr)) {
      const fallback = await resolveJournalFilePath(
        options.fs,
        effectiveJournalsBase,
        options.dateStr,
        hintSafe ? hintAbs : undefined
      )
      if (
        fallback &&
        (isPathInsideDir(effectiveJournalsBase, fallback) ||
          (vault ? isPathInsideDir(vault, fallback) : false))
      ) {
        return fallback
      }
    }
  }

  throw new Error(`Diary file not found: ${rel}`)
}

export type CollectJournalPathsResult = {
  /** 每个日历日保留一条路径（优先标准 yyyy/MM/ 布局） */
  pathsByDate: Map<string, string>
  /** 磁盘上匹配的 .md 文件总数（同一日期多份文件时大于 pathsByDate.size） */
  fileCount: number
}

/** 将 Journals 目录树中的日记文件按日期收集为路径映射（与 count 统计共用遍历规则） */
export async function collectJournalPathsByDateInTree(
  fileSystem: IFileSystem,
  journalsDir: string
): Promise<CollectJournalPathsResult> {
  const pathsByDate = new Map<string, string>()
  let fileCount = 0

  if (!(await fileSystem.exists(journalsDir))) {
    return { pathsByDate, fileCount }
  }

  async function walk(dir: string): Promise<void> {
    let entries: string[] = []
    try {
      entries = await fileSystem.readdir(dir)
    } catch {
      return
    }

    for (const name of entries) {
      const fullPath = path.join(dir, name)
      const dateMatch = JOURNAL_DATE_FILE.exec(name)
      if (dateMatch?.[1]) {
        try {
          const stat = await fileSystem.stat(fullPath)
          if (!stat.isFile) continue
        } catch {
          continue
        }

        const dateStr = dateMatch[1]
        fileCount += 1
        const canonicalPath = buildCanonicalJournalFilePath(journalsDir, dateStr)
        const existing = pathsByDate.get(dateStr)
        if (!existing || path.resolve(fullPath) === path.resolve(canonicalPath)) {
          pathsByDate.set(dateStr, fullPath)
        }
        continue
      }

      try {
        const stat = await fileSystem.stat(fullPath)
        if (stat.isDirectory) {
          if (JOURNAL_TREE_SKIP_DIR_NAMES.has(name)) continue
          await walk(fullPath)
        }
      } catch {
        // skip unreadable entries (e.g. Unicode paths on some Android FS layers)
      }
    }
  }

  await walk(journalsDir)
  return { pathsByDate, fileCount }
}

async function walkJournalsDir(
  fileSystem: IFileSystem,
  dir: string,
  onMatch?: () => void
): Promise<number> {
  let entries: string[] = []
  try {
    entries = await fileSystem.readdir(dir)
  } catch {
    return 0
  }

  let count = 0
  for (const name of entries) {
    const fullPath = path.join(dir, name)
    if (JOURNAL_DATE_FILE.test(name)) {
      count += 1
      onMatch?.()
      continue
    }
    try {
      const stat = await fileSystem.stat(fullPath)
      if (stat.isDirectory) {
        if (JOURNAL_TREE_SKIP_DIR_NAMES.has(name)) continue
        count += await walkJournalsDir(fileSystem, fullPath, onMatch)
      }
    } catch {
      // skip unreadable entries (e.g. Unicode paths on some Android FS layers)
    }
  }

  return count
}

/**
 * 递归检查 Journals 目录下是否存在 yyyy-MM-dd.md（含 yyyy/MM/ 嵌套布局）。
 */
export async function journalMarkdownExistsInTree(
  fileSystem: IFileSystem,
  journalsDir: string
): Promise<boolean> {
  if (!(await fileSystem.exists(journalsDir))) return false
  return (await walkJournalsDir(fileSystem, journalsDir)) > 0
}

/** 统计 Journals 目录树中的日记 Markdown 文件数量 */
export async function countJournalMarkdownInTree(
  fileSystem: IFileSystem,
  journalsDir: string
): Promise<number> {
  if (!(await fileSystem.exists(journalsDir))) return 0
  return walkJournalsDir(fileSystem, journalsDir)
}
