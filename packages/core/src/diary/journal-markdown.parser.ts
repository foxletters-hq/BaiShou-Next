import { parseDateStr } from '@baishou/shared'
import type { ParsedJournal } from '../shadow-index/shadow-index-sync.types'

function safeParseDateTime(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback
  const d = new Date(value.replace(/^["']|["']$/g, ''))
  return isNaN(d.getTime()) ? fallback : d
}

function stripQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, '').trim()
}

function isNullishYaml(val: string): boolean {
  const v = val.trim().toLowerCase()
  return v === 'null' || v === '~' || v === ''
}

/** 剥离 UTF-8 BOM */
function stripBom(raw: string): string {
  return raw.replace(/^\uFEFF/, '')
}

/**
 * 将 Markdown 文件拆分为 frontmatter 元数据块与正文。
 * 兼容旧版移动端写入的多种边界格式（无正文、闭合 --- 后无换行等）。
 */
export function splitJournalFrontmatter(raw: string): { metaBlock: string; body: string } | null {
  const text = stripBom(raw).trimStart()
  if (!text.startsWith('---')) return null

  const openMatch = text.match(/^---\r?\n/)
  if (!openMatch) return null

  const rest = text.slice(openMatch[0].length)

  // 标准：闭合 --- 独占一行，正文在下一行或为空
  const lineClose = rest.match(/^([\s\S]*?)\r?\n---[ \t]*(?:\r?\n([\s\S]*)|\s*$)/)
  if (lineClose) {
    return { metaBlock: lineClose[1] ?? '', body: (lineClose[2] ?? '').trim() }
  }

  // 旧版：闭合 --- 后紧跟正文（无换行）
  const inlineClose = rest.match(/^([\s\S]*?)\r?\n---[ \t]*(.+)$/s)
  if (inlineClose) {
    return { metaBlock: inlineClose[1] ?? '', body: (inlineClose[2] ?? '').trim() }
  }

  return null
}

function parseYamlListTags(metaBlock: string): string[] {
  const tags: string[] = []
  let inTagsList = false

  for (const line of metaBlock.split('\n')) {
    const trimmed = line.trim()

    if (!inTagsList) {
      if (/^tags:\s*$/.test(trimmed)) {
        inTagsList = true
        continue
      }
      if (/^tags:\s*\[\s*\]\s*$/.test(trimmed)) {
        return []
      }
      continue
    }

    const item = line.match(/^\s*-\s*(.+?)\s*$/)
    if (item) {
      tags.push(stripQuotes(item[1]!))
      continue
    }

    if (trimmed && !line.startsWith(' ') && !line.startsWith('\t')) {
      break
    }
  }

  return tags
}

function parseInlineTags(tagVal: string): string[] {
  const bracket = tagVal.match(/^\[(.*)\]$/s)
  const inner = bracket ? bracket[1]! : tagVal
  return inner
    .split(',')
    .map(stripQuotes)
    .filter(Boolean)
}

function parseFrontmatterMeta(metaBlock: string): Record<string, string> {
  const meta: Record<string, string> = {}

  for (const line of metaBlock.split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.substring(0, colonIdx).trim()
    const val = line.substring(colonIdx + 1).trim()
    if (!key || isNullishYaml(val)) continue
    if (key === 'tags' && !val) continue
    meta[key] = stripQuotes(val)
  }

  return meta
}

function parseTags(meta: Record<string, string>, metaBlock: string): string[] {
  const listTags = parseYamlListTags(metaBlock)
  if (listTags.length > 0) return listTags

  const tagVal = meta['tags']
  if (!tagVal) return []
  return parseInlineTags(tagVal)
}

/**
 * 解析 Markdown 文件内容（含 Frontmatter）
 *
 * 支持：
 * - 标准 `tags: [日记, 生活]` 与 YAML 列表 `tags:\n  - "日记"`
 * - 旧版移动端完整元数据（createdAt / updatedAt / mediaPaths 等）
 * - UTF-8 BOM、闭合 --- 后无正文或无换行
 */
export function parseJournalMarkdown(raw: string, fallbackDate: string): ParsedJournal | null {
  const split = splitJournalFrontmatter(raw)
  const content = split ? split.body : stripBom(raw).trim()

  const meta = split ? parseFrontmatterMeta(split.metaBlock) : {}
  const tags = split ? parseTags(meta, split.metaBlock) : []

  const dateStr = meta['date']
  const parsedDate = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : fallbackDate

  let mediaPaths: string[] = []
  if (meta['mediaPaths'] || meta['media_paths']) {
    try {
      const parsed = JSON.parse(meta['mediaPaths'] || meta['media_paths'] || '[]')
      mediaPaths = Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : []
    } catch {
      /* ignore */
    }
  }

  const now = new Date()
  return {
    id: meta['id'] ? Number(meta['id']) : 0,
    date: parsedDate,
    content,
    tags,
    createdAt: safeParseDateTime(
      meta['created_at'] || meta['createdAt'],
      meta['date'] ? parseDateStr(parsedDate) : now
    ),
    updatedAt: safeParseDateTime(meta['updated_at'] || meta['updatedAt'], now),
    weather: meta['weather'] || undefined,
    mood: meta['mood'] || undefined,
    location: meta['location'] || undefined,
    locationDetail: meta['location_detail'] || meta['locationDetail'] || undefined,
    isFavorite: meta['is_favorite'] === 'true' || meta['isFavorite'] === 'true',
    mediaPaths
  }
}
