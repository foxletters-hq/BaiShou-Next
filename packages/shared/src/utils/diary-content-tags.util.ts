import { normalizeDiaryTags } from './diary-tags.util'

const TAG_TOKEN_RE = /#([^\s#]+)/g

/** Markdown 标题行（`# ` 后有空格） */
export function isMarkdownHeadingLine(line: string): boolean {
  return /^#{1,6}\s/.test(line.trim())
}

/** 日记时间戳行（Markdown 标题 + HH:mm，支持 1–6 级；兼容旧版 HH:mm:ss） */
export function isDiaryTimestampLine(line: string): boolean {
  return /^#{1,6}\s*\d{2}:\d{2}(:\d{2})?\s*$/.test(line.trim())
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

function nextMarkdownHeadingIndex(lines: string[], after: number): number {
  for (let i = after + 1; i < lines.length; i++) {
    if (isMarkdownHeadingLine(lines[i] ?? '')) return i
  }
  return lines.length
}

function insertTagLineAfterHeading(lines: string[], headingIndex: number, tagLine: string): string {
  const blockEnd = nextMarkdownHeadingIndex(lines, headingIndex)
  let insertAt = headingIndex + 1
  while (insertAt < blockEnd && lines[insertAt]?.trim() === '') {
    insertAt += 1
  }
  const firstContent = lines[insertAt] ?? ''
  if (insertAt < blockEnd && isLegacyDedicatedTagLine(firstContent)) {
    lines[insertAt] = `${firstContent.trimEnd()} ${tagLine}`
    return lines.join('\n')
  }
  const before = lines.slice(0, insertAt).join('\n')
  const after = lines.slice(insertAt).join('\n')
  if (!after.trim()) return `${before}\n${tagLine}\n\n`
  return `${before}\n${tagLine}\n\n${after}`
}

function insertTagLineAfterLeadingBlock(body: string, tagLine: string): string {
  const lines = body.split('\n')
  if (lines.length === 0) return `${tagLine}\n\n`

  const first = lines[0]?.trim() ?? ''
  if (isMarkdownHeadingLine(first)) {
    return insertTagLineAfterHeading(lines, 0, tagLine)
  }

  if (!body.trim()) return `${tagLine}\n\n`
  return `${tagLine}\n\n${body}`
}

/**
 * 更新落盘时决定交给 persistDiaryTagsInBody 的标签。
 * 调用方改正文但未显式传入 tags 时，不沿用旧解析结果，避免把已删除的 #标签补回去。
 */
export function resolveDiaryTagsForPersist(args: {
  contentProvided: boolean
  tagsProvided: boolean
  incomingTags: unknown
  existingTags: unknown
}): unknown {
  if (args.tagsProvided) return args.incomingTags
  if (args.contentProvided) return undefined
  return args.existingTags
}

/**
 * 按本次写入意图落盘正文，并把 tags 字段同步成当前正文里的 #标签。
 */
export function applyDiaryPersistTags(args: {
  content: string
  contentProvided: boolean
  tagsProvided: boolean
  incomingTags: unknown
  existingTags: unknown
}): { content: string; tags: string | undefined } {
  const persistTags = resolveDiaryTagsForPersist(args)
  const content = persistDiaryTagsInBody(args.content, persistTags)
  const tags = extractDiaryTagsFromContent(content)
  return { content, tags: tags.length > 0 ? tags.join(',') : undefined }
}

/**
 * 将仍停在元数据里、正文尚未出现的标签写到第一个 Markdown 标题下面（否则写到文首）。
 * 用于落盘、导入、演示数据；正文本身始终原样保留。
 */
export function persistDiaryTagsInBody(body: string, tags: unknown): string {
  const normalizedTags = normalizeDiaryTags(tags)
  if (!normalizedTags.length) return body

  const existingSet = new Set(extractDiaryTagsFromContent(body))
  const missing = normalizedTags.filter((tag) => !existingSet.has(tag))
  if (!missing.length) return body

  const suffix = missing.map((t) => `#${t}`).join(' ')
  const lines = body.split('\n')
  const headingIndex = lines.findIndex((line) => isMarkdownHeadingLine(line ?? ''))
  if (headingIndex >= 0) {
    return insertTagLineAfterHeading(lines, headingIndex, suffix)
  }
  return insertTagLineAfterLeadingBlock(body, suffix)
}

/**
 * 将正文合成为编辑器展示内容。
 * 元数据里多出来的标签补到第一个标题下面；正文已有的不重复写入。
 */
export function composeDiaryEditorContent(body: string, tags: unknown): string {
  return persistDiaryTagsInBody(body, tags)
}

/** 保存前剥离旧版首行纯标签行（内联标签保留在正文中） */
export function stripDiaryTagLineFromContent(full: string): string {
  return stripLegacyTopTagLine(full)
}

/** 合并 frontmatter 标签与正文内联 #标签（去重，frontmatter 优先） */
export function resolveDiaryTagsFromSources(
  frontmatterTags: string[] | unknown,
  content: string
): string[] {
  const merged: string[] = []
  const seen = new Set<string>()
  for (const tag of [
    ...normalizeDiaryTags(frontmatterTags),
    ...extractDiaryTagsFromContent(content)
  ]) {
    if (seen.has(tag)) continue
    seen.add(tag)
    merged.push(tag)
  }
  return merged
}

/** 预览用：去掉仅含 #标签 的独立行，保留正文中的内联标签 */
export function stripDedicatedTagLinesFromContent(full: string): string {
  if (!full) return ''
  const kept: string[] = []
  for (const line of full.split('\n')) {
    if (isLegacyDedicatedTagLine(line)) continue
    kept.push(line)
  }
  return kept
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
