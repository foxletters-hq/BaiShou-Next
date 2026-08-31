import { emitAgentSessionRuntime, getSharedSessionInbox } from '@baishou/ai'
import { logger, type SessionInputRecord } from '@baishou/shared'

/** runPromoted 返回 aborted 时停止排空，保留剩余 pending（Stop/abort 语义） */
export type DrainPromotedResult = 'ok' | 'aborted'

export interface DrainSessionInboxParams {
  sessionId: string
  /** 当前 session 是否仍在跑流（busy 则不启动 / 循环内退出） */
  isBusy: (sessionId: string) => boolean
  /**
   * 执行已 promote 的一条输入。
   * 返回 `'aborted'`（或 void 以外的 aborted）时中断整条 drain，pending 保留。
   */
  runPromoted: (input: SessionInputRecord) => Promise<DrainPromotedResult | void>
  /** 可选：循环开始前再判一次是否应继续（默认 true） */
  shouldDrain?: (sessionId: string) => boolean
  logLabel?: string
}

/** 防重入：同 session 同时只允许一条 drain 循环 */
const drainingSessions = new Set<string>()

/**
 * 桌面 companion / workspace 共享的 inbox 串行排空。
 *
 * - Steer 优先于 queue：依赖 inbox.promoteNext
 * - Stop/abort：调用方不发起 drain，或 runPromoted 返回 aborted → 不继续排空
 * - 正常结束：循环 promote 直至空或 busy
 */
export async function drainSessionInbox(params: DrainSessionInboxParams): Promise<void> {
  const {
    sessionId,
    isBusy,
    runPromoted,
    shouldDrain = () => true,
    logLabel = 'SessionInbox'
  } = params

  if (drainingSessions.has(sessionId) || isBusy(sessionId)) return
  if (!shouldDrain(sessionId)) return

  const inbox = getSharedSessionInbox()
  if (inbox.listPending(sessionId).length === 0) {
    emitAgentSessionRuntime({ type: 'session.idle', sessionId, timestamp: Date.now() })
    return
  }

  drainingSessions.add(sessionId)
  try {
    // 串行排空：在锁内循环，避免「单次 promote 后嵌套 drain 被锁挡住」导致后续 pending 卡住
    for (;;) {
      if (isBusy(sessionId) || !shouldDrain(sessionId)) break
      const promoted = inbox.promoteNext(sessionId)
      if (!promoted) {
        emitAgentSessionRuntime({ type: 'session.idle', sessionId, timestamp: Date.now() })
        break
      }
      emitAgentSessionRuntime({
        type: 'session.promoted',
        sessionId,
        inputId: promoted.id,
        delivery: promoted.delivery,
        timestamp: Date.now()
      })
      const result = await runPromoted(promoted)
      if (result === 'aborted') break
    }
  } catch (error) {
    logger.warn(
      `[${logLabel}] drain inbox failed:`,
      error instanceof Error ? error.message : String(error)
    )
  } finally {
    drainingSessions.delete(sessionId)
  }
}

export function isSessionInboxDraining(sessionId: string): boolean {
  return drainingSessions.has(sessionId)
}

/** 等同一 session 的 drain 锁释放，避免 admit 报 started 但实际被锁挡掉 */
export async function waitForSessionInboxDrainLock(
  sessionId: string,
  maxWaitMs = 2000,
  pollMs = 50
): Promise<boolean> {
  const started = Date.now()
  while (drainingSessions.has(sessionId)) {
    if (Date.now() - started >= maxWaitMs) return false
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }
  return true
}

/** 测试用：清空 draining 锁 */
export function resetSessionInboxDrainForTests(): void {
  drainingSessions.clear()
}

export function isSessionInboxDrainingForTests(sessionId: string): boolean {
  return isSessionInboxDraining(sessionId)
}
