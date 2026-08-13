/**
 * RunCoordinator：同 session 串行 drain / wake 合并的参考实现。
 *
 * 桌面暂用 `apps/desktop/.../session-inbox-drain.ts`（companion / workspace 共享）；
 * 后续可将 admit/finally 迁到 configureSessionRunCoordinator + wake。
 * 不要在桌面再复制一套生产 drain 循环。
 */
import { emitAgentSessionRuntime } from '../agent/session-runtime-event'
import { getSharedSessionInbox, type SessionInbox } from './inbox'
import { getSessionConcurrencyLimiter } from './guards'
import type { SessionInputRecord } from '@baishou/shared'

export type SessionDrainState = 'idle' | 'draining' | 'interrupted'

export interface RunCoordinatorHooks {
  /** 真正执行一次已 promote 的输入（通常调用 streamChat） */
  runPromoted: (input: SessionInputRecord) => Promise<void>
}

/**
 * 同 session 串行 Drain：wake 合并、interrupt 清 wake。
 */
export class RunCoordinator {
  private readonly state = new Map<string, SessionDrainState>()
  private readonly wakePending = new Map<string, boolean>()
  private readonly running = new Map<string, Promise<void>>()
  private readonly recovery = new Map<string, { reason: string; at: number }>()

  constructor(
    private readonly inbox: SessionInbox = getSharedSessionInbox(),
    private readonly hooks: RunCoordinatorHooks
  ) {}

  getState(sessionId: string): SessionDrainState {
    return this.state.get(sessionId) ?? 'idle'
  }

  isBusy(sessionId: string): boolean {
    return this.getState(sessionId) === 'draining'
  }

  markRecovery(sessionId: string, reason: string): void {
    this.recovery.set(sessionId, { reason, at: Date.now() })
    emitAgentSessionRuntime({
      type: 'session.recovery_marked',
      sessionId,
      reason,
      timestamp: Date.now()
    })
  }

  consumeRecovery(sessionId: string): { reason: string; at: number } | null {
    const v = this.recovery.get(sessionId) ?? null
    if (v) this.recovery.delete(sessionId)
    return v
  }

  interrupt(sessionId: string, reason = 'interrupted'): void {
    this.wakePending.set(sessionId, false)
    this.state.set(sessionId, 'interrupted')
    emitAgentSessionRuntime({
      type: 'session.interrupted',
      sessionId,
      reason,
      timestamp: Date.now()
    })
  }

  /** 合并 wake：busy 时仅标记，idle 时启动 drain 循环 */
  wake(sessionId: string): void {
    if (this.getState(sessionId) === 'draining') {
      this.wakePending.set(sessionId, true)
      return
    }
    void this.startDrain(sessionId)
  }

  private async startDrain(sessionId: string): Promise<void> {
    const existing = this.running.get(sessionId)
    if (existing) {
      this.wakePending.set(sessionId, true)
      return
    }

    const limiter = getSessionConcurrencyLimiter()
    if (!limiter.tryAcquire()) {
      this.markRecovery(sessionId, 'concurrency_limit')
      emitAgentSessionRuntime({
        type: 'session.idle',
        sessionId,
        timestamp: Date.now()
      })
      return
    }

    const loop = (async () => {
      this.state.set(sessionId, 'draining')
      try {
        for (;;) {
          if (this.getState(sessionId) === 'interrupted') break
          const promoted = this.inbox.promoteNext(sessionId)
          if (!promoted) break

          emitAgentSessionRuntime({
            type: 'session.promoted',
            sessionId,
            inputId: promoted.id,
            delivery: promoted.delivery,
            timestamp: Date.now()
          })

          try {
            this.markRecovery(sessionId, `promoted:${promoted.id}`)
            await this.hooks.runPromoted(promoted)
            this.recovery.delete(sessionId)
          } catch (err) {
            this.inbox.markFailed(promoted.id)
            this.markRecovery(
              sessionId,
              err instanceof Error ? err.message : 'promoted_run_failed'
            )
            throw err
          }

          if (!this.wakePending.get(sessionId)) {
            // 仍可能有 pending queue
            if (this.inbox.listPending(sessionId).length === 0) break
          }
          this.wakePending.set(sessionId, false)
        }
      } finally {
        limiter.release()
        this.running.delete(sessionId)
        const wasInterrupted = this.getState(sessionId) === 'interrupted'
        this.state.set(sessionId, 'idle')
        emitAgentSessionRuntime({
          type: 'session.idle',
          sessionId,
          timestamp: Date.now()
        })
        if (!wasInterrupted && this.wakePending.get(sessionId)) {
          this.wakePending.set(sessionId, false)
          void this.startDrain(sessionId)
        } else if (!wasInterrupted && this.inbox.listPending(sessionId).length > 0) {
          void this.startDrain(sessionId)
        }
      }
    })()

    this.running.set(sessionId, loop)
    await loop
  }
}

const coordinators = new Map<string, RunCoordinator>()

/** 宿主注册「如何跑 promoted input」；按进程单例协调器 */
let defaultHooks: RunCoordinatorHooks | null = null
let defaultCoordinator: RunCoordinator | null = null

export function configureSessionRunCoordinator(hooks: RunCoordinatorHooks): RunCoordinator {
  defaultHooks = hooks
  defaultCoordinator = new RunCoordinator(getSharedSessionInbox(), hooks)
  return defaultCoordinator
}

export function getSessionRunCoordinator(): RunCoordinator | null {
  return defaultCoordinator
}

export function resetSessionRunCoordinatorForTests(): void {
  defaultHooks = null
  defaultCoordinator = null
  coordinators.clear()
}

void defaultHooks
