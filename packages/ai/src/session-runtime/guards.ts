/**
 * Session Runtime 护栏：maxSteps 钳位 + doom-loop 指纹熔断。
 */

export function clampMaxSteps(value: unknown, fallback = 10): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) return fallback
  return Math.max(1, Math.min(50, Math.trunc(value)))
}

export function fingerprintToolCall(toolName: string, args: unknown): string {
  let serialized: string
  try {
    serialized = JSON.stringify(args ?? null)
  } catch {
    serialized = String(args)
  }
  return `${toolName}::${serialized}`
}

export interface DoomLoopTracker {
  observe(toolName: string, args: unknown): { tripped: boolean; fingerprint: string; count: number }
  reset(): void
}

export function createDoomLoopTracker(threshold = 3): DoomLoopTracker {
  const limit = Math.max(2, Math.min(20, Math.trunc(threshold)))
  let lastFp = ''
  let count = 0

  return {
    observe(toolName: string, args: unknown) {
      const fp = fingerprintToolCall(toolName, args)
      if (fp === lastFp) {
        count += 1
      } else {
        lastFp = fp
        count = 1
      }
      return { tripped: count >= limit, fingerprint: fp, count }
    },
    reset() {
      lastFp = ''
      count = 0
    }
  }
}

/** 并发 Drain 上限（按活跃 session） */
export class SessionConcurrencyLimiter {
  private active = 0

  constructor(private readonly maxConcurrent: number = 8) {}

  tryAcquire(): boolean {
    if (this.active >= this.maxConcurrent) return false
    this.active += 1
    return true
  }

  release(): void {
    this.active = Math.max(0, this.active - 1)
  }

  getActiveCount(): number {
    return this.active
  }
}

let sharedLimiter = new SessionConcurrencyLimiter(8)

export function getSessionConcurrencyLimiter(): SessionConcurrencyLimiter {
  return sharedLimiter
}

export function setSessionConcurrencyLimit(max: number): void {
  sharedLimiter = new SessionConcurrencyLimiter(Math.max(1, Math.min(64, Math.trunc(max))))
}

export function resetSessionConcurrencyLimiterForTests(): void {
  sharedLimiter = new SessionConcurrencyLimiter(8)
}
