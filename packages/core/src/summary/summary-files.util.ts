import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import { SummaryType } from '@baishou/shared'
const YEAR_DIR_NAME = /^\d{4}$/

/** Weekly / Monthly / Quarterly 支持 Archives/{Type}/{YYYY}/*.md 一层年份子目录 */
export function summaryTypeSupportsYearSubdir(type: SummaryType): boolean {
  return (
    type === SummaryType.weekly || type === SummaryType.monthly || type === SummaryType.quarterly
  )
}

export function yearFromSummaryFileName(fileName: string): string | null {
  const m = /^(\d{4})-\d{2}-\d{2}\.md$/i.exec(fileName)
  return m?.[1] ?? null
}

/**
 * 解析类型目录下单个总结文件路径：优先已有位置（平铺或年份子目录），否则建议写入年份子目录。
 */
export async function findExistingSummaryFileInTypeDir(
  fileSystem: IFileSystem,
  typeDir: string,
  fileName: string
): Promise<string | null> {
  const flat = path.join(typeDir, fileName)
  if (await fileSystem.exists(flat)) return flat

  const year = yearFromSummaryFileName(fileName)
  if (year) {
    const nested = path.join(typeDir, year, fileName)
    if (await fileSystem.exists(nested)) return nested
  }

  return null
}

export async function resolveSummaryFileInTypeDir(
  fileSystem: IFileSystem,
  typeDir: string,
  fileName: string,
  options?: { type?: SummaryType; preferYearSubdir?: boolean }
): Promise<string> {
  const existing = await findExistingSummaryFileInTypeDir(fileSystem, typeDir, fileName)
  if (existing) return existing

  const year = yearFromSummaryFileName(fileName)
  const useYearDir =
    year &&
    (options?.type ? summaryTypeSupportsYearSubdir(options.type) : true) &&
    options?.preferYearSubdir !== false

  if (useYearDir) {
    return path.join(typeDir, year, fileName)
  }

  return path.join(typeDir, fileName)
}

export type SummaryTypeDirEntry = { fileName: string; fullPath: string }

/** 列举类型目录下所有总结 md（含一层 {YYYY}/ 子目录，不含更深层） */
export async function listMarkdownInSummaryTypeDir(
  fileSystem: IFileSystem,
  typeDir: string
): Promise<SummaryTypeDirEntry[]> {
  const entries: SummaryTypeDirEntry[] = []
  let names: string[] = []
  try {
    names = await fileSystem.readdir(typeDir)
  } catch {
    return entries
  }

  for (const name of names) {
    const fullPath = path.join(typeDir, name)
    if (name.endsWith('.md')) {
      try {
        const stat = await fileSystem.stat(fullPath)
        if (stat.isFile) entries.push({ fileName: name, fullPath })
      } catch {
        // skip
      }
      continue
    }

    if (!YEAR_DIR_NAME.test(name)) continue
    let yearEntries: string[] = []
    try {
      const stat = await fileSystem.stat(fullPath)
      if (!stat.isDirectory) continue
      yearEntries = await fileSystem.readdir(fullPath)
    } catch {
      continue
    }

    for (const child of yearEntries) {
      if (!child.endsWith('.md')) continue
      const childPath = path.join(fullPath, child)
      try {
        const stat = await fileSystem.stat(childPath)
        if (stat.isFile) entries.push({ fileName: child, fullPath: childPath })
      } catch {
        // skip
      }
    }
  }

  return entries
}

/** 统计 Archives 树下各类型子目录中的总结 Markdown 数量 */
export type SummaryArchivesMarkdownCounts = {
  total: number
  weekly: number
  monthly: number
  quarterly: number
  yearly: number
}

export async function countSummaryMarkdownInArchivesTreeByType(
  fileSystem: IFileSystem,
  archivesBase: string
): Promise<SummaryArchivesMarkdownCounts> {
  const counts: SummaryArchivesMarkdownCounts = {
    total: 0,
    weekly: 0,
    monthly: 0,
    quarterly: 0,
    yearly: 0
  }
  if (!(await fileSystem.exists(archivesBase))) return counts

  const typeKeys = [
    ['Weekly', 'weekly'],
    ['Monthly', 'monthly'],
    ['Quarterly', 'quarterly'],
    ['Yearly', 'yearly']
  ] as const

  for (const [dirName, key] of typeKeys) {
    const typeDir = path.join(archivesBase, dirName)
    const files = await listMarkdownInSummaryTypeDir(fileSystem, typeDir)
    counts[key] = files.length
    counts.total += files.length
  }

  return counts
}

/** 统计 Archives 树下各类型子目录中的总结 Markdown 数量 */
export async function countSummaryMarkdownInArchivesTree(
  fileSystem: IFileSystem,
  archivesBase: string
): Promise<number> {
  const counts = await countSummaryMarkdownInArchivesTreeByType(fileSystem, archivesBase)
  return counts.total
}
