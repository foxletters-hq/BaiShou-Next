import { appendDiagnosticBreadcrumb } from '../services/mobile-diagnostic-log.service'

interface NavStartRecord {
  tag: string
  detail: string
  wallTimeMs: number
  perfTimeMs: number
}

let lastNavStart: NavStartRecord | null = null

function nowPerfMs(): number {
  if (typeof globalThis.performance?.now === 'function') {
    return globalThis.performance.now()
  }
  return Date.now()
}

export function markNavigationStart(tag: string, detail = ''): void {
  const perfTimeMs = nowPerfMs()
  lastNavStart = {
    tag,
    detail,
    wallTimeMs: Date.now(),
    perfTimeMs
  }
  const msg = `[TransitionDiag] start tag=${tag} detail=${detail}`
  appendDiagnosticBreadcrumb(msg)
  console.info(msg)
}

export function logNavigationPhase(
  tag: string,
  phase: string,
  extra?: Record<string, unknown>
): number {
  const currentPerf = nowPerfMs()
  const dtMs = lastNavStart ? Math.round((currentPerf - lastNavStart.perfTimeMs) * 10) / 10 : -1
  const extraStr = extra ? ` ${JSON.stringify(extra)}` : ''
  const msg = `[TransitionDiag] phase=${phase} tag=${tag} dtMs=${dtMs}${extraStr}`
  appendDiagnosticBreadcrumb(msg)
  console.info(msg)
  return dtMs
}

export function sampleTransitionFrames(tag: string, durationMs = 360): () => void {
  const startPerf = nowPerfMs()
  let lastFramePerf = startPerf
  const gaps: number[] = []
  let rafId: number | null = null
  let cancelled = false

  const step = () => {
    if (cancelled) return
    const now = nowPerfMs()
    const gap = Math.round((now - lastFramePerf) * 10) / 10
    gaps.push(gap)
    lastFramePerf = now

    if (now - startPerf < durationMs) {
      rafId = requestAnimationFrame(step)
    } else {
      const totalMs = Math.round((now - startPerf) * 10) / 10
      const maxGapMs = gaps.length > 0 ? Math.max(...gaps) : 0
      const msg = `[TransitionDiag] frames tag=${tag} count=${gaps.length} totalMs=${totalMs} maxGapMs=${maxGapMs} gaps=[${gaps.join(',')}]`
      appendDiagnosticBreadcrumb(msg)
      console.info(msg)
    }
  }

  rafId = requestAnimationFrame(step)

  return () => {
    cancelled = true
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
    }
  }
}
