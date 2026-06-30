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
  /** 无完整分段可揭示时，仍展示尾部 partial 单元 */
  showPartialDuringGap?: boolean
  /** partial 达到多少字符才立即展示；避免上游单字 chunk 导致逐字蹦出 */
  partialRevealMinChars?: number
  /** partial 未达到最小长度时，最多等待多久也展示一次 */
  partialRevealMs?: number
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
  segmentMaxChars: number = STREAM_SEGMENT_MAX_CHARS,
  revealedPartialCharCount?: number
): string {
  if (!buffer) return ''
  const { completeUnits, partialUnit } = splitStreamingRevealUnits(buffer, segmentMaxChars)
  const shownCount = Math.min(revealedUnitCount, completeUnits.length)
  let display = completeUnits.slice(0, shownCount).join('')
  if (includePartialUnit && revealedUnitCount >= completeUnits.length && partialUnit) {
    display +=
      revealedPartialCharCount == null
        ? partialUnit
        : partialUnit.slice(0, Math.min(revealedPartialCharCount, partialUnit.length))
  }
  return display
}

/** 将高频回调合并到每帧最多一次（移动端流式 UI 更新） */
export function createRafBatchedCallback<T>(callback: (value: T) => void) {
  let pending: T | undefined
  let rafId: number | null = null

  const flush = () => {
    if (rafId != null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    if (pending !== undefined) {
      const value = pending
      pending = undefined
      callback(value)
    }
  }

  const schedule = (value: T) => {
    pending = value
    if (rafId != null) return
    rafId = requestAnimationFrame(() => {
      rafId = null
      if (pending !== undefined) {
        const value = pending
        pending = undefined
        callback(value)
      }
    })
  }

  return { schedule, flush }
}

export function createStreamingTextDisplayBuffer(
  onDisplayChange: (text: string) => void,
  options?: StreamingTextDisplayBufferOptions
): StreamingTextDisplayBuffer {
  const lineRevealMs = options?.lineRevealMs ?? STREAM_LINE_REVEAL_MS
  const maxCatchUpLines = options?.maxCatchUpLines ?? STREAM_MAX_CATCHUP_LINES
  const segmentMaxChars = options?.segmentMaxChars ?? STREAM_SEGMENT_MAX_CHARS
  const showPartialDuringGap = options?.showPartialDuringGap ?? false
  const partialRevealMinChars = options?.partialRevealMinChars ?? 0
  const partialRevealMs =
    options?.partialRevealMs ?? options?.partialFlushMs ?? STREAM_PARTIAL_LINE_FLUSH_MS
  const immediate = options?.immediate ?? false
  const immediateDisplay = immediate ? createRafBatchedCallback(onDisplayChange) : null

  let buffer = ''
  let revealedUnitCount = 0
  let includePartialUnit = false
  let revealedPartialCharCount = 0
  let lineRevealTimer: ReturnType<typeof setTimeout> | null = null
  let partialRevealTimer: ReturnType<typeof setTimeout> | null = null

  const clearLineRevealTimer = () => {
    if (!lineRevealTimer) return
    clearTimeout(lineRevealTimer)
    lineRevealTimer = null
  }

  const clearPartialRevealTimer = () => {
    if (!partialRevealTimer) return
    clearTimeout(partialRevealTimer)
    partialRevealTimer = null
  }

  const emitDisplay = () => {
    const next = buildStreamingDisplayText(
      buffer,
      revealedUnitCount,
      includePartialUnit,
      segmentMaxChars,
      revealedPartialCharCount
    )
    onDisplayChange(next)
  }

  const emitPartialDisplay = (partialLength: number) => {
    revealedPartialCharCount = partialLength
    includePartialUnit = true
    emitDisplay()
  }

  const schedulePartialReveal = () => {
    if (partialRevealTimer) return
    partialRevealTimer = setTimeout(() => {
      partialRevealTimer = null
      const { completeUnits, partialUnit } = splitStreamingRevealUnits(buffer, segmentMaxChars)
      if (completeUnits.length > revealedUnitCount || !partialUnit) return
      emitPartialDisplay(partialUnit.length)
    }, partialRevealMs)
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
      revealedPartialCharCount = 0
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
        immediateDisplay?.schedule(buffer)
        return
      }
      const { completeUnits, partialUnit } = splitStreamingRevealUnits(buffer, segmentMaxChars)
      if (completeUnits.length > revealedUnitCount) {
        clearPartialRevealTimer()
        includePartialUnit = false
        revealedPartialCharCount = 0
        scheduleLineReveal()
        return
      }

      if (showPartialDuringGap && partialUnit) {
        const partialGrowth = partialUnit.length - revealedPartialCharCount
        if (partialRevealMinChars <= 0 || partialGrowth >= partialRevealMinChars) {
          clearPartialRevealTimer()
          emitPartialDisplay(partialUnit.length)
        } else {
          schedulePartialReveal()
        }
      } else {
        clearPartialRevealTimer()
        includePartialUnit = false
        revealedPartialCharCount = 0
      }
    },

    flush() {
      clearLineRevealTimer()
      clearPartialRevealTimer()
      immediateDisplay?.flush()
      const { completeUnits } = splitStreamingRevealUnits(buffer, segmentMaxChars)
      revealedUnitCount = completeUnits.length
      includePartialUnit = true
      revealedPartialCharCount = Number.POSITIVE_INFINITY
      onDisplayChange(buffer)
    },

    reset() {
      clearLineRevealTimer()
      clearPartialRevealTimer()
      buffer = ''
      revealedUnitCount = 0
      includePartialUnit = false
      revealedPartialCharCount = 0
      immediateDisplay?.flush()
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
        segmentMaxChars,
        revealedPartialCharCount
      )
    }
  }
}
