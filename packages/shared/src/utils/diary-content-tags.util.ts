import { normalizeDiaryTags } from './diary-tags.util'

const TAG_TOKEN_RE = /#([^\s#]+)/g

/** Markdown 标题行（`# ` 后有空格） */
export function isMarkdownHeadingLine(line: string): boolean {
  return /^#{1,6}\s/.test(line.trim())
}

/** 日记时间戳行（##### HH:mm:ss） */
export function isDiaryTimestampLine(line: string): boolean {
  return /^#####\s*\d{2}:\d{2}:\d{2}/.test(line.trim())
}

/** 该行不参与标签解析 / 不着色（标题、时间戳） */
export function shouldSkipDiaryTagExtractionLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return true
  if (isMarkdownHeadingLine(trimmed)) return true
  if (isDiaryTimestampLine(trimmed)) return true
  return false
}

/** @deprecated 仅用于识别旧版「首行纯标签行」 */
export function isDiaryTagLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return true
  if (isMarkdownHeadingLine(trimmed)) return false
  if (isDiaryTimestampLine(trimmed)) return false
  return trimmed.includes('#')
}

export function extractTagsFromTagLine(line: string): string[] {
  const tags: string[] = []
  const seen = new Set<string>()
  for (const match of line.matchAll(TAG_TOKEN_RE)) {
    const tag = match[1]?.trim()
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    tags.push(tag)
  }
  return tags
}

/** 从全文扫描内联 `#标签`（跳过标题行与时间戳行） */
export function extractDiaryTagsFromContent(full: string): string[] {
  if (!full) return []
  const tags: string[] = []
  const seen = new Set<string>()
  for (const line of full.split('\n')) {
    if (shouldSkipDiaryTagExtractionLine(line)) continue
    for (const tag of extractTagsFromTagLine(line)) {
      if (seen.has(tag)) continue
      seen.add(tag)
      tags.push(tag)
    }
  }
  return tags
}

/** 从编辑器全文解析标签与正文（正文保留内联标签） */
export function parseDiaryEditorContent(full: string): { tags: string[]; body: string } {
  return {
    tags: extractDiaryTagsFromContent(full),
    body: full
  }
}

/** 旧版「首行仅标签」专用行（不含正文混排） */
export function isLegacyDedicatedTagLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  if (isMarkdownHeadingLine(trimmed)) return false
  if (isDiaryTimestampLine(trimmed)) return false
  if (!trimmed.includes('#')) return false
  return trimmed.replace(/#([^\s#]+)/g, '').trim() === ''
}

function stripLegacyTopTagLine(body: string): string {
  const lines = body.split('\n')
  const firstLine = lines[0] ?? ''
  if (!isLegacyDedicatedTagLine(firstLine)) {
    return body
  }
  let bodyStart = 1
  while (bodyStart < lines.length && lines[bodyStart]?.trim() === '') {
    bodyStart += 1
  }
  return lines.slice(bodyStart).join('\n')
}

function insertTagLineAfterLeadingBlock(body: string, tagLine: string): string {
  const lines = body.split('\n')
  if (lines.length === 0) return `${tagLine}\n\n`

  const first = lines[0]?.trim() ?? ''
  if (isDiaryTimestampLine(first) || isMarkdownHeadingLine(first)) {
    let insertAt = 1
    while (insertAt < lines.length && lines[insertAt]?.trim() === '') {
      insertAt += 1
    }
    const before = lines.slice(0, insertAt).join('\n')
    const after = lines.slice(insertAt).join('\n')
    if (!after.trim()) return `${before}\n${tagLine}\n\n`
    return `${before}\n${tagLine}\n\n${after}`
  }

  if (!body.trim()) return `${tagLine}\n\n`
  return `${tagLine}\n\n${body}`
}

function appendMissingInlineTags(body: string, missing: string[]): string {
  if (!missing.length) return body
  const suffix = missing.map((t) => `#${t}`).join(' ')
  const lines = body.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (shouldSkipDiaryTagExtractionLine(line)) continue
    if (extractTagsFromTagLine(line).length > 0) {
      lines[i] = `${line.trimEnd()} ${suffix}`
      return lines.join('\n')
    }
  }
  return insertTagLineAfterLeadingBlock(body, suffix)
}

/**
 * 将 frontmatter 标签与正文合成为编辑器展示内容。
 * 内联标签优先；仅当 FM 中有标签但正文未出现时才插入（时间戳块之后或追加到已有标签行）。
 */
export function composeDiaryEditorContent(body: string, tags: unknown): string {
  const normalizedTags = normalizeDiaryTags(tags)
  const cleanBody = stripLegacyTopTagLine(body)
  if (!normalizedTags.length) return cleanBody

  const existing = new Set(extractDiaryTagsFromContent(cleanBody))
  const missing = normalizedTags.filter((t) => !existing.has(t))
  if (!missing.length) return cleanBody

  return appendMissingInlineTags(cleanBody, missing)
}

/** 保存前剥离旧版首行纯标签行（内联标签保留在正文中） */
export function stripDiaryTagLineFromContent(full: string): string {
  return stripLegacyTopTagLine(full)
}
