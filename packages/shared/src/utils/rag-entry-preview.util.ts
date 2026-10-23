import { formatSemanticChunkSnippet } from './diary-preview.util'

export const RAG_ENTRY_LIST_PREVIEW_RADIUS = 80
const ELLIPSIS = '…'

export type RagTextHighlightSegment =
  | { kind: 'text'; value: string }
  | { kind: 'mark'; value: string }

export function findKeywordRange(
  text: string,
  keyword: string | null | undefined
): { start: number; end: number } | null {
  const needle = keyword?.trim() ?? ''
  if (!text || !needle) return null
  const start = text.toLocaleLowerCase().indexOf(needle.toLocaleLowerCase())
  if (start < 0) return null
  return { start, end: start + needle.length }
}

/** 列表预览：有关键词时切到首次命中附近，避免日记日期前缀占满三行 */
export function buildRagEntryListPreview(
  text: string,
  keyword?: string | null,
  radius = RAG_ENTRY_LIST_PREVIEW_RADIUS
): { preview: string; matchStart: number; matchLength: number } {
  const raw = text ?? ''
  const range = findKeywordRange(raw, keyword)
  if (!range) {
    const stripped = formatSemanticChunkSnippet(raw) || raw
    return { preview: stripped, matchStart: -1, matchLength: 0 }
  }

  const from = Math.max(0, range.start - radius)
  const to = Math.min(raw.length, range.end + radius)
  const prefix = from > 0 ? ELLIPSIS : ''
  const suffix = to < raw.length ? ELLIPSIS : ''
  const preview = `${prefix}${raw.slice(from, to)}${suffix}`
  return {
    preview,
    matchStart: prefix.length + (range.start - from),
    matchLength: range.end - range.start
  }
}

export function splitTextByKeyword(
  text: string,
  keyword?: string | null
): RagTextHighlightSegment[] {
  const raw = text ?? ''
  if (!raw) return []
  const needle = keyword?.trim() ?? ''
  if (!needle) return [{ kind: 'text', value: raw }]

  const lowerText = raw.toLocaleLowerCase()
  const lowerNeedle = needle.toLocaleLowerCase()
  const segments: RagTextHighlightSegment[] = []
  let cursor = 0

  while (cursor < raw.length) {
    const start = lowerText.indexOf(lowerNeedle, cursor)
    if (start < 0) {
      segments.push({ kind: 'text', value: raw.slice(cursor) })
      break
    }
    if (start > cursor) {
      segments.push({ kind: 'text', value: raw.slice(cursor, start) })
    }
    segments.push({ kind: 'mark', value: raw.slice(start, start + needle.length) })
    cursor = start + needle.length
  }

  return segments.length > 0 ? segments : [{ kind: 'text', value: raw }]
}
