import * as path from '../fs/path.util'
import { md5Hex } from '../fs/md5'
import { parseJournalMarkdown } from '../diary/journal-markdown.parser'
import type { IFileSystem } from '../fs/file-system.types'
import { formatLocalDate, parseDateStr, type CreateDiaryInput } from '@baishou/shared'

/** 由日期字符串构建日记 Markdown 路径：Journals/YYYY/MM/YYYY-MM-DD.md */
export function buildJournalFilePathFromDateStr(journalsBase: string, dateStr: string): string {
  const year = dateStr.substring(0, 4)
  const month = dateStr.substring(5, 7)
  return path.join(journalsBase, year, month, `${dateStr}.md`)
}

/** 比对前统一换行与尾部空白，避免平台差异导致误判 */
export function normalizeJournalFileRaw(raw: string): string {
  return raw.replace(/\r\n/g, '\n').trimEnd()
}

function extractJournalBody(raw: string, dateStr: string): string {
  const parsed = parseJournalMarkdown(raw, dateStr)
  if (parsed?.content != null) {
    return parsed.content.trim()
  }
  return normalizeJournalFileRaw(raw)
}

/**
 * 判断旧版日记是否已在目标工作区落盘（无需再次导入）。
 * 1. 归一化后全文 MD5 一致（启动迁移整文件复制）
 * 2. 正文相同
 * 3. 目标正文已包含旧版正文（此前经 diaryService 同日合并过）
 */
export function legacyJournalAlreadyMigrated(
  legacyRaw: string,
  targetRaw: string,
  dateStr: string
): boolean {
  const legacyNorm = normalizeJournalFileRaw(legacyRaw)
  const targetNorm = normalizeJournalFileRaw(targetRaw)

  if (!legacyNorm) return true

  if (legacyNorm === targetNorm) return true
  if (md5Hex(legacyNorm) === md5Hex(targetNorm)) return true

  const legacyBody = extractJournalBody(legacyRaw, dateStr)
  if (!legacyBody) return true

  const targetBody = extractJournalBody(targetRaw, dateStr)
  if (legacyBody === targetBody) return true
  if (targetBody.includes(legacyBody)) return true

  return false
}

function parseTagsList(tags: string[] | string | undefined): string[] {
  if (!tags) return []
  if (Array.isArray(tags)) return tags
  return tags
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function mergeTagLists(...lists: Array<string[] | string | undefined>): string[] {
  const merged = new Set<string>()
  for (const list of lists) {
    for (const tag of parseTagsList(list)) {
      merged.add(tag)
    }
  }
  return [...merged]
}

async function ensureParentDir(fileSystem: IFileSystem, filePath: string): Promise<void> {
  const parent = path.dirname(filePath)
  if (!(await fileSystem.exists(parent))) {
    await fileSystem.mkdir(parent, { recursive: true })
  }
}

/** 将日记写入磁盘 Markdown（不触发影子索引，供迁移/归档后 resync 使用） */
export async function writeJournalMarkdownToDisk(
  fileSystem: IFileSystem,
  journalsBase: string,
  input: CreateDiaryInput & { id?: number }
): Promise<void> {
  const filePath = buildJournalFilePathFromDateStr(journalsBase, formatLocalDate(input.date))
  await ensureParentDir(fileSystem, filePath)

  const lines: string[] = ['---']
  if (input.id) lines.push(`id: ${input.id}`)
  lines.push(`date: ${formatLocalDate(input.date)}`)

  const tagArr = parseTagsList(input.tags as string | string[] | undefined)
  if (tagArr.length > 0) lines.push(`tags: [${tagArr.join(', ')}]`)

  if (input.weather) lines.push(`weather: ${input.weather}`)
  if (input.mood) lines.push(`mood: ${input.mood}`)
  if (input.location) lines.push(`location: ${input.location}`)
  if (input.locationDetail) lines.push(`location_detail: ${input.locationDetail}`)
  if (input.isFavorite) lines.push(`is_favorite: true`)
  lines.push(`updated_at: ${new Date().toISOString()}`)
  lines.push('---', '', input.content ?? '')

  await fileSystem.writeFile(filePath, lines.join('\n'), 'utf8')
}

/**
 * 迁移专用：仅写 Markdown 文件，不经过 DiaryService（避免 quiesce 期间影子索引不可用）。
 * 迁移结束后由 bootstrapper.resyncFromDisk 重建索引。
 */
export async function importLegacyJournalToDisk(
  fileSystem: IFileSystem,
  journalsBase: string,
  dateStr: string,
  legacyRaw: string,
  targetRaw: string | null
): Promise<'imported' | 'skipped'> {
  if (targetRaw != null && legacyJournalAlreadyMigrated(legacyRaw, targetRaw, dateStr)) {
    return 'skipped'
  }

  const targetPath = buildJournalFilePathFromDateStr(journalsBase, dateStr)

  if (targetRaw == null) {
    await ensureParentDir(fileSystem, targetPath)
    await fileSystem.writeFile(targetPath, legacyRaw, 'utf8')
    return 'imported'
  }

  const legacyParsed = parseJournalMarkdown(legacyRaw, dateStr)
  const targetParsed = parseJournalMarkdown(targetRaw, dateStr)
  const legacyBody = (legacyParsed?.content ?? legacyRaw).trimEnd()
  const targetBody = (targetParsed?.content ?? targetRaw).trimEnd()
  const mergedBody = targetBody ? `${targetBody}\n\n${legacyBody}` : legacyBody

  const date = parseDateStr(dateStr) ?? new Date()
  await writeJournalMarkdownToDisk(fileSystem, journalsBase, {
    id: targetParsed?.id ?? legacyParsed?.id,
    date,
    content: mergedBody,
    tags: mergeTagLists(targetParsed?.tags, legacyParsed?.tags).join(','),
    weather: legacyParsed?.weather ?? targetParsed?.weather,
    mood: legacyParsed?.mood ?? targetParsed?.mood,
    location: legacyParsed?.location ?? targetParsed?.location,
    locationDetail: legacyParsed?.locationDetail ?? targetParsed?.locationDetail,
    isFavorite: legacyParsed?.isFavorite ?? targetParsed?.isFavorite
  })

  return 'imported'
}
