import { isSqliteDatabaseCorruptionError } from './sqlite-corruption.util'

export type AgentDbRecoveryLogger = {
  error: (message: string, error?: unknown) => void
  info: (message: string) => void
  warn: (message: string) => void
}

const defaultLogger: AgentDbRecoveryLogger = {
  error: (message, error) => console.error(message, error),
  info: (message) => console.info(message),
  warn: (message) => console.warn(message)
}

export class AgentDbRecoveryCoordinator {
  private reloadFn: (() => Promise<void>) | null = null
  private afterReloadFn: (() => Promise<void>) | null = null
  private recoveryInFlight: Promise<boolean> | null = null
  private bareOperationDepth = 0
  private onRecoverStart?: (reason: string) => void
  private onRecoverComplete?: () => void
  private onRecoverFailed?: (error: unknown) => void
  private logger: AgentDbRecoveryLogger = defaultLogger

  registerReload(fn: () => Promise<void>): void {
    this.reloadFn = fn
  }

  registerAfterReload(fn: () => Promise<void>): void {
    this.afterReloadFn = fn
  }

  setDiagnostics(hooks: {
    onRecoverStart?: (reason: string) => void
    onRecoverComplete?: () => void
    onRecoverFailed?: (error: unknown) => void
    logger?: AgentDbRecoveryLogger
  }): void {
    this.onRecoverStart = hooks.onRecoverStart
    this.onRecoverComplete = hooks.onRecoverComplete
    this.onRecoverFailed = hooks.onRecoverFailed
    if (hooks.logger) this.logger = hooks.logger
  }

  isCorruptionError(error: unknown): boolean {
    return isSqliteDatabaseCorruptionError(error)
  }

  async handleCorruptionError(error: unknown, reason: string): Promise<boolean> {
    if (!this.isCorruptionError(error)) return false
    return this.recover(reason)
  }

  async runBare<T>(operation: () => Promise<T>): Promise<T> {
    this.bareOperationDepth += 1
    try {
      return await operation()
    } finally {
      this.bareOperationDepth -= 1
    }
  }

  async runWithRecovery<T>(
    operation: () => Promise<T>,
    reason: string,
    retryAfterRecovery?: () => Promise<T>
  ): Promise<T> {
    if (this.bareOperationDepth > 0) {
      return operation()
    }

    try {
      return await operation()
    } catch (error) {
      if (await this.handleCorruptionError(error, reason)) {
        if (retryAfterRecovery) {
          return retryAfterRecovery()
        }
        // afterReload 已从磁盘恢复；勿用 reload 前的 stale repo/service 重试
        return undefined as T
      }
      throw error
    }
  }

  private recover(reason: string): Promise<boolean> {
    if (this.recoveryInFlight) return this.recoveryInFlight
    this.recoveryInFlight = this.doRecover(reason).finally(() => {
      this.recoveryInFlight = null
    })
    return this.recoveryInFlight
  }

  private async doRecover(reason: string): Promise<boolean> {
    if (!this.reloadFn) {
      this.logger.error(`[AgentDbRecovery] 无法自愈（reload 未注册）: ${reason}`)
      return false
    }

    this.onRecoverStart?.(reason)
    this.logger.error(`[AgentDbRecovery] 检测到 Agent 数据库损坏，开始自愈: ${reason}`)

    try {
      await this.reloadFn()
      if (this.afterReloadFn) {
        await this.afterReloadFn()
      } else {
        this.logger.warn('[AgentDbRecovery] reload 完成但未注册 afterReload，跳过磁盘重同步')
      }
      this.onRecoverComplete?.()
      this.logger.info('[AgentDbRecovery] Agent 数据库自愈完成')
      return true
    } catch (e) {
      this.onRecoverFailed?.(e)
      this.logger.error('[AgentDbRecovery] 自愈失败:', e)
      return false
    }
  }
}
