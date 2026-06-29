/** 每显现一段完整文本的间隔（毫秒） */
export const STREAM_LINE_REVEAL_MS = 90
/** @deprecated 流式期间不再增量刷新 partial，仅 flush 时展示尾部 */
export const STREAM_PARTIAL_LINE_FLUSH_MS = 320
/** 落后多段时，每次追赶的最大段数 */
export const STREAM_MAX_CATCHUP_LINES = 2
/** 无换行时长段按固定字数切分为「伪行」 */
export const STREAM_SEGMENT_MAX_CHARS = 36

export interface StreamingTextDisplayBufferOptions {
  lineRevealMs?: number
  partialFlushMs?: number
  maxCatchUpLines?: number
  segmentMaxChars?: number
  /** 无完整分段可揭示时，仍展示尾部 partial 单元（更平滑的逐字感） */
  showPartialDuringGap?: boolean
  /**
   * 每次 push 立即输出完整缓冲（配合 XMarkdown 流式 Markdown 渲染，不做逐段显现）。
   * 与 Playground 一致：UI 侧只负责累积全文，未完成语法由 XMarkdown 处理。
   */
  immediate?: boolean
}

export interface StreamingTextDisplayBuffer {
  push: (delta: string) => void
  flush: () => void
  reset: () => void
  getFullText: () => string
  getDisplayText: () => string
}

export function splitStreamingTextLines(text: string): {
  completeLines: string[]
  partialLine: string
} {
  if (!text) return { completeLines: [], partialLine: '' }
  const parts = text.split('\n')
  const partialLine = parts.pop() ?? ''
  return { completeLines: parts, partialLine }
}

/** 将流式文本拆成可逐段显现的单元（换行 / 句末标点 / 超长切段） */
export function splitStreamingRevealUnits(
  text: string,
  segmentMaxChars: number = STREAM_SEGMENT_MAX_CHARS
): { completeUnits: string[]; partialUnit: string } {
  if (!text) return { completeUnits: [], partialUnit: '' }

  const completeUnits: string[] = []
  let index = 0

  while (index < text.length) {
    let unitEnd = index

    while (unitEnd < text.length) {
      const ch = text.charAt(unitEnd)
      unitEnd += 1
      if (ch === '\n') break
      if (/[。！？.!?]/.test(ch)) break
      if (unitEnd - index >= segmentMaxChars) break
    }

    const unit = text.slice(index, unitEnd)
    if (unitEnd >= text.length) {
      const isComplete =
        unit.endsWith('\n') || /[。！？.!?]$/.test(unit) || unit.length >= segmentMaxChars
      if (isComplete) {
        completeUnits.push(unit)
        return { completeUnits, partialUnit: '' }
      }
      return { completeUnits, partialUnit: unit }
    }

    completeUnits.push(unit)
    index = unitEnd
  }

  return { completeUnits, partialUnit: '' }
}

export function buildStreamingDisplayText(
  buffer: string,
  revealedUnitCount: number,
  includePartialUnit: boolean,
  segmentMaxChars: number = STREAM_SEGMENT_MAX_CHARS
): string {
  if (!buffer) return ''
  const { completeUnits, partialUnit } = splitStreamingRevealUnits(buffer, segmentMaxChars)
  const shownCount = Math.min(revealedUnitCount, completeUnits.length)
  let display = completeUnits.slice(0, shownCount).join('')
  if (includePartialUnit && revealedUnitCount >= completeUnits.length && partialUnit) {
    display += partialUnit
  }
  return display
}

export function createStreamingTextDisplayBuffer(
  onDisplayChange: (text: string) => void,
  options?: StreamingTextDisplayBufferOptions
): StreamingTextDisplayBuffer {
  const lineRevealMs = options?.lineRevealMs ?? STREAM_LINE_REVEAL_MS
  const maxCatchUpLines = options?.maxCatchUpLines ?? STREAM_MAX_CATCHUP_LINES
  const segmentMaxChars = options?.segmentMaxChars ?? STREAM_SEGMENT_MAX_CHARS
  const showPartialDuringGap = options?.showPartialDuringGap ?? false
  const immediate = options?.immediate ?? false

  let buffer = ''
  let revealedUnitCount = 0
  let includePartialUnit = false
  let lineRevealTimer: ReturnType<typeof setTimeout> | null = null

  const clearLineRevealTimer = () => {
    if (!lineRevealTimer) return
    clearTimeout(lineRevealTimer)
    lineRevealTimer = null
  }

  const emitDisplay = () => {
    const next = buildStreamingDisplayText(
      buffer,
      revealedUnitCount,
      includePartialUnit,
      segmentMaxChars
    )
    onDisplayChange(next)
  }

  const scheduleLineReveal = () => {
    if (lineRevealTimer) return

    const tick = () => {
      lineRevealTimer = null
      const { completeUnits } = splitStreamingRevealUnits(buffer, segmentMaxChars)
      const behind = completeUnits.length - revealedUnitCount
      if (behind <= 0) return

      const step = behind > maxCatchUpLines ? Math.min(maxCatchUpLines, behind) : 1
      revealedUnitCount += step
      includePartialUnit = false
      emitDisplay()

      if (revealedUnitCount < completeUnits.length) {
        lineRevealTimer = setTimeout(tick, lineRevealMs)
      }
    }

    lineRevealTimer = setTimeout(tick, lineRevealMs)
  }

  return {
    push(delta: string) {
      if (!delta) return
      buffer += delta
      if (immediate) {
        onDisplayChange(buffer)
        return
      }
      const { completeUnits, partialUnit } = splitStreamingRevealUnits(buffer, segmentMaxChars)
      if (completeUnits.length > revealedUnitCount) {
        includePartialUnit = false
        scheduleLineReveal()
        return
      }

      if (showPartialDuringGap && partialUnit) {
        includePartialUnit = true
        emitDisplay()
      } else {
        includePartialUnit = false
      }
    },

    flush() {
      clearLineRevealTimer()
      const { completeUnits } = splitStreamingRevealUnits(buffer, segmentMaxChars)
      revealedUnitCount = completeUnits.length
      includePartialUnit = true
      onDisplayChange(buffer)
    },

    reset() {
      clearLineRevealTimer()
      buffer = ''
      revealedUnitCount = 0
      includePartialUnit = false
      onDisplayChange('')
    },

    getFullText() {
      return buffer
    },

    getDisplayText() {
      if (immediate) {
        return buffer
      }
      return buildStreamingDisplayText(
        buffer,
        revealedUnitCount,
        includePartialUnit,
        segmentMaxChars
      )
    }
  }
}
