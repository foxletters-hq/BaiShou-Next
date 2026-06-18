import type { IncrementalSyncRunOptions } from '../types/version-control.types'
import { isSyncDivergenceConfirmationRequiredError } from './sync-divergence'

/**
 * 执行双向/仅下载同步；若本机首次连接且差异过大，先回调 confirm 再重试。
 * 用户取消确认时返回 undefined。
 */
export async function runIncrementalSyncWithDivergenceConfirmation<T>(
  run: (runOptions?: IncrementalSyncRunOptions) => Promise<T>,
  confirm: (divergencePercent: number, maxDivergencePercent: number) => Promise<boolean>
): Promise<T | undefined> {
  try {
    return await run()
  } catch (error) {
    if (!isSyncDivergenceConfirmationRequiredError(error)) {
      throw error
    }
    const ok = await confirm(error.divergencePercent, error.maxDivergencePercent)
    if (!ok) return undefined
    return await run({ highDivergenceConfirmed: true })
  }
}
