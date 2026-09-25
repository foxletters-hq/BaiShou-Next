/**
 * Session Runtime 护栏：maxSteps 钳位 + doom-loop 指纹观察。
 * 重复工具调用只记事件，不掐断本轮。
 */

export function clampMaxSteps(value: unknown, fallback = 10): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) return fallback
  return Math.max(1, Math.min(50, Math.trunc(value)))
}

/** 参数尚未拼完或还是空对象时不能计入死循环。 */
export function isEmptyToolCallInput(input: unknown): boolean {
  if (input == null) return true
  if (typeof input !== 'object') return false
  if (Array.isArray(input)) return input.length === 0
  return Object.keys(input as Record<string, unknown>).length === 0
}

export function shouldObserveDoomLoopToolCall(chunk: {
  partial?: boolean
  input?: unknown
}): boolean {
  if (chunk.partial === true) return false
  return !isEmptyToolCallInput(chunk.input)
}

/**
 * 死循环只在工具真正返回之后计数。
 * 同一模型步里并行打开 3 个网页读取时，开始瞬间参数都是 {}，不能在调用开始就计入。
 */
export function createDoomLoopCallGate(observe: (toolName: string, args: unknown) => boolean): {
  onToolCall(chunk: {
    toolCallId?: string
    toolName: string
    input: unknown
    partial?: boolean
  }): void
  onToolResult(toolCallId?: string): boolean
} {
  const pending = new Map<string, { toolName: string; input: unknown }>()
  return {
    onToolCall(chunk) {
      const id = chunk.toolCallId?.trim()
      if (!id || !shouldObserveDoomLoopToolCall(chunk)) return
      pending.set(id, { toolName: chunk.toolName, input: chunk.input })
    },
    onToolResult(toolCallId) {
      const id = toolCallId?.trim()
      if (!id) return false
      const call = pending.get(id)
      if (!call) return false
      pending.delete(id)
      return observe(call.toolName, call.input)
    }
  }
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
