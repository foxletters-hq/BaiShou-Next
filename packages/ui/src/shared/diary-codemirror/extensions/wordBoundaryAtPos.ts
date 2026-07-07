/** 行内弱助词：单独选中体验差，尽量并入相邻实词 */
const WEAK_SINGLE_CHARS = new Set('了的地得吗呢吧啊嘛着过于在和与及')

let cachedSegmenter: Intl.Segmenter | null | undefined

function getWordSegmenter(): Intl.Segmenter | null {
  if (cachedSegmenter !== undefined) return cachedSegmenter
  try {
    cachedSegmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' })
  } catch {
    cachedSegmenter = null
  }
  return cachedSegmenter
}

function isHanChar(ch: string): boolean {
  return /[\u4e00-\u9fff]/.test(ch)
}

function isLatinOrDigit(ch: string): boolean {
  return /[a-zA-Z0-9_]/.test(ch)
}

function isWordContentChar(ch: string): boolean {
  if (!ch) return false
  if (isLatinOrDigit(ch)) return true
  return isHanChar(ch) || /[\u3040-\u30ff\u3400-\u4dbf\uac00-\ud7af]/.test(ch)
}

const MARKUP_DELIMS = ['**', '~~', '`', '*', '_'] as const

/** 触摸长按选词：行内语境分词 + 落点校正 + 跳过 Markdown 标记 */

function getLineBounds(doc: string, pos: number): { from: number; to: number } {
  let from = Math.max(0, Math.min(pos, doc.length))
  let to = from
  while (from > 0 && doc[from - 1] !== '\n') from -= 1
  while (to < doc.length && doc[to] !== '\n') to += 1
  return { from, to }
}

function snapFromInlineMarkup(doc: string, pos: number): number | null {
  for (const delim of MARKUP_DELIMS) {
    const searchFrom = Math.max(0, pos - 16)
    const searchTo = Math.min(doc.length, pos + 16)
    const slice = doc.slice(searchFrom, searchTo)
    const localPos = pos - searchFrom

    let openIdx = -1
    for (let i = localPos; i >= 0; i--) {
      if (slice.slice(i, i + delim.length) === delim) {
        openIdx = i
        break
      }
    }
    if (openIdx < 0) continue

    const closeIdx = slice.indexOf(delim, openIdx + delim.length)
    if (closeIdx < 0) continue

    const innerStart = searchFrom + openIdx + delim.length
    const innerEnd = searchFrom + closeIdx
    if (innerStart >= innerEnd) continue

    const onDelimiter =
      (pos >= searchFrom + openIdx && pos < innerStart) ||
      (pos >= innerEnd && pos < searchFrom + closeIdx + delim.length)
    const inside = pos >= innerStart && pos < innerEnd
    if (!onDelimiter && !inside) continue

    if (inside && isWordContentChar(doc[pos] ?? '')) return pos
    if (pos <= innerStart) return innerStart
    return innerEnd - 1
  }
  return null
}

/** 落点在 ** / ` 等标记上时，向两侧寻找最近的可读字符 */
export function snapTouchSelectPos(doc: string, pos: number, searchRadius = 16): number {
  const len = doc.length
  if (len === 0) return 0
  const clamped = Math.max(0, Math.min(pos, len - 1))
  if (isWordContentChar(doc[clamped] ?? '')) return clamped

  const fromMarkup = snapFromInlineMarkup(doc, clamped)
  if (fromMarkup != null) return fromMarkup

  for (let d = 1; d <= searchRadius; d++) {
    const right = clamped + d
    const left = clamped - d
    if (right < len && isWordContentChar(doc[right] ?? '')) return right
    if (left >= 0 && isWordContentChar(doc[left] ?? '')) return left
  }
  return clamped
}

function trimMarkupDelimiters(doc: string, from: number, to: number): { from: number; to: number } {
  let f = from
  let t = to
  let changed = true
  while (changed && f < t) {
    changed = false
    for (const delim of MARKUP_DELIMS) {
      if (doc.slice(f, f + delim.length) === delim) {
        f += delim.length
        changed = true
      }
      if (doc.slice(t - delim.length, t) === delim) {
        t -= delim.length
        changed = true
      }
    }
  }
  return f < t ? { from: f, to: t } : { from, to }
}

type SegmentSlice = {
  from: number
  to: number
  text: string
  wordLike: boolean
}

function collectSegments(
  segmenter: Intl.Segmenter,
  doc: string,
  from: number,
  to: number
): SegmentSlice[] {
  const slice = doc.slice(from, to)
  const out: SegmentSlice[] = []
  for (const segment of segmenter.segment(slice)) {
    const segFrom = from + segment.index
    const segTo = segFrom + segment.segment.length
    out.push({
      from: segFrom,
      to: segTo,
      text: segment.segment,
      wordLike: segment.isWordLike
    })
  }
  return out
}

function findSegmentAt(segments: SegmentSlice[], pos: number): number {
  return segments.findIndex((s) => pos >= s.from && pos < s.to)
}

function nearestWordSegment(segments: SegmentSlice[], pos: number): SegmentSlice | null {
  const direct = findSegmentAt(segments, pos)
  if (direct >= 0 && segments[direct]!.wordLike && segments[direct]!.to > segments[direct]!.from) {
    return segments[direct]!
  }

  let best: SegmentSlice | null = null
  let bestDist = Infinity
  for (const seg of segments) {
    if (!seg.wordLike || seg.to <= seg.from) continue
    const dist = pos < seg.from ? seg.from - pos : pos >= seg.to ? pos - seg.to + 1 : 0
    if (dist < bestDist) {
      bestDist = dist
      best = seg
    }
  }
  return best
}

function expandHanWordAtPos(doc: string, pos: number, maxLen = 4): { from: number; to: number } {
  const len = doc.length
  if (len === 0) return { from: 0, to: 0 }

  const center = Math.max(0, Math.min(pos, len - 1))
  if (!isHanChar(doc[center] ?? '')) {
    return { from: center, to: Math.min(center + 1, len) }
  }

  let from = center
  let to = center + 1

  while (to - from < maxLen) {
    const canLeft = from > 0 && isHanChar(doc[from - 1] ?? '')
    const canRight = to < len && isHanChar(doc[to] ?? '')
    if (!canLeft && !canRight) break

    const leftRoom = center - from
    const rightRoom = to - 1 - center
    const preferLeft = leftRoom > rightRoom || (leftRoom === rightRoom && canLeft)

    if (preferLeft && canLeft) from -= 1
    else if (canRight) to += 1
    else if (canLeft) from -= 1
    else break
  }

  return { from, to }
}

function tryExtendHanCompound(
  doc: string,
  pos: number,
  from: number,
  to: number,
  segmenter: Intl.Segmenter
): { from: number; to: number } {
  const text = doc.slice(from, to)
  if (!/^[\u4e00-\u9fff]+$/.test(text)) return { from, to }

  let end = to
  while (end < doc.length && end - from < 4 && isHanChar(doc[end] ?? '')) {
    const trial = doc.slice(from, end + 1)
    const parts = [...segmenter.segment(trial)].filter((s) => s.isWordLike)
    if (parts.length === 1 && parts[0]!.segment === trial) {
      end += 1
      continue
    }
    break
  }

  let start = from
  while (start > 0 && end - start < 4 && isHanChar(doc[start - 1] ?? '')) {
    const trial = doc.slice(start - 1, end)
    const parts = [...segmenter.segment(trial)].filter((s) => s.isWordLike)
    if (parts.length === 1 && parts[0]!.segment === trial) {
      start -= 1
      continue
    }
    break
  }

  if (end - start > 1) return { from: start, to: end }
  if (WEAK_SINGLE_CHARS.has(doc[pos] ?? '')) return { from, to }
  return expandHanWordAtPos(doc, pos, 4)
}

function refineWeakSingleChar(
  doc: string,
  from: number,
  to: number,
  segments: SegmentSlice[]
): { from: number; to: number } {
  const text = doc.slice(from, to)
  if (text.length !== 1 || !WEAK_SINGLE_CHARS.has(text)) return { from, to }

  const idx = findSegmentAt(segments, from)
  if (idx < 0) return { from, to }

  const prevSlices: SegmentSlice[] = []
  for (let i = idx - 1; i >= 0 && prevSlices.length < 2; i--) {
    const seg = segments[i]
    if (!seg?.wordLike) break
    prevSlices.unshift(seg)
  }

  if (prevSlices.length > 0) {
    const candidateFrom = prevSlices[0]!.from
    const candidate = doc.slice(candidateFrom, to)
    if (candidate.length >= 2 && candidate.length <= 4 && /^[\u4e00-\u9fff]+$/.test(candidate)) {
      return { from: candidateFrom, to }
    }
  }

  const next = segments[idx + 1]
  if (next?.wordLike) {
    let endPos = next.to
    const next2 = segments[idx + 2]
    if (next.text.length === 1 && next2?.wordLike && isHanChar(next.text)) {
      endPos = next2.to
    }
    if (endPos - next.from >= 2) {
      return { from: next.from, to: endPos }
    }
  }

  return { from, to }
}

function expandLatinOrNumber(doc: string, from: number, to: number): { from: number; to: number } {
  const text = doc.slice(from, to)
  if (!/^[a-zA-Z0-9_.+-]+$/.test(text)) return { from, to }

  let f = from
  let t = to
  while (f > 0 && /[a-zA-Z0-9_.+-]/.test(doc[f - 1] ?? '')) f -= 1
  while (t < doc.length && /[a-zA-Z0-9_.+-]/.test(doc[t] ?? '')) t += 1
  return { from: f, to: t }
}

function findWordInLine(
  doc: string,
  pos: number,
  segmenter: Intl.Segmenter
): { from: number; to: number } | null {
  const line = getLineBounds(doc, pos)
  const segments = collectSegments(segmenter, doc, line.from, line.to)
  const hit = nearestWordSegment(segments, pos)
  if (!hit) return null

  let { from, to } = { from: hit.from, to: hit.to }
  if (to - from === 1 && isHanChar(doc[from] ?? '')) {
    const refined = refineWeakSingleChar(doc, from, to, segments)
    if (refined.to - refined.from > 1) {
      from = refined.from
      to = refined.to
    } else {
      const extended = tryExtendHanCompound(doc, pos, from, to, segmenter)
      from = extended.from
      to = extended.to
    }
  }

  if (isLatinOrDigit(doc[from] ?? '')) {
    const expanded = expandLatinOrNumber(doc, from, to)
    from = expanded.from
    to = expanded.to
  }

  return trimMarkupDelimiters(doc, from, to)
}

function fallbackWordRange(doc: string, pos: number): { from: number; to: number } {
  const len = doc.length
  const clamped = Math.max(0, Math.min(pos, len - 1))
  const ch = doc[clamped] ?? ''
  if (!isWordContentChar(ch)) return { from: clamped, to: clamped }

  if (isLatinOrDigit(ch)) {
    return expandLatinOrNumber(doc, clamped, clamped + 1)
  }

  if (isHanChar(ch)) {
    const { from, to } = expandHanWordAtPos(doc, clamped, 4)
    return trimMarkupDelimiters(doc, from, to)
  }

  return { from: clamped, to: clamped + 1 }
}

export function findWordRangeAtPosition(doc: string, pos: number): { from: number; to: number } {
  const len = doc.length
  if (len === 0) return { from: 0, to: 0 }

  const snapped = snapTouchSelectPos(doc, pos)
  const segmenter = getWordSegmenter()

  if (segmenter) {
    const line = findWordInLine(doc, snapped, segmenter)
    if (line && line.from < line.to) return line
  }

  const fallback = fallbackWordRange(doc, snapped)
  if (fallback.from < fallback.to) return fallback
  return { from: snapped, to: Math.min(snapped + 1, len) }
}

export function resolveTouchDocPosition(
  view: { posAtCoords: (coords: { x: number; y: number }, precise?: boolean) => number | null },
  clientX: number,
  clientY: number
): number | null {
  let pos = view.posAtCoords({ x: clientX, y: clientY }, false)
  if (pos == null) {
    pos = view.posAtCoords({ x: clientX, y: clientY }, true)
  }
  return pos
}
