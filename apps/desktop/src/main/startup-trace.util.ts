import { logger } from '@baishou/shared'

/** 相对 Electron 进程启动的毫秒数（含模块加载） */
export function startupElapsedMs(fromMs?: number): number {
  if (typeof fromMs === 'number') {
    return Math.round(performance.now() - fromMs)
  }
  return Math.round(process.uptime() * 1000)
}

/**
 * 冷启动分段计时。日志统一前缀 `[Startup]`，便于过滤。
 * 例：`[Startup] agent-db.open 412ms (t+820ms)`
 */
export async function traceStartupStep<T>(
  step: string,
  work: () => Promise<T> | T,
  detail?: Record<string, unknown>
): Promise<T> {
  const started = performance.now()
  logger.info(`[Startup] ▶ ${step}`, detail ?? {})
  try {
    const result = await work()
    logger.info(`[Startup] ◀ ${step} ${startupElapsedMs(started)}ms (t+${startupElapsedMs()}ms)`, {
      ...detail,
      ok: true
    })
    return result
  } catch (error) {
    logger.error(
      `[Startup] ✖ ${step} ${startupElapsedMs(started)}ms (t+${startupElapsedMs()}ms)`,
      error as Error
    )
    throw error
  }
}

export function markStartup(step: string, detail?: Record<string, unknown>): void {
  logger.info(`[Startup] ● ${step} (t+${startupElapsedMs()}ms)`, detail ?? {})
}
