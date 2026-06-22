import type { S3SyncConfig, SyncManifest } from '../types/version-control.types'
import { SYNC_DIVERGENCE_THRESHOLD_OPTIONS } from '../constants/incremental-sync.constants'
import type { IncrementalSyncStorageHistory } from '../utils/incremental-sync-storage.util'

export type SyncDivergenceThresholdOption =
  | (typeof SYNC_DIVERGENCE_THRESHOLD_OPTIONS)[number]
  | null

/** 双向同步因本地/远端差异过大被阻断 */
export class SyncDivergenceExceededError extends Error {
  constructor(
    public readonly divergencePercent: number,
    public readonly maxDivergencePercent: number
  ) {
    super(
      `SyncDivergenceExceededError: local/remote divergence ${divergencePercent}% exceeds limit ${maxDivergencePercent}%`
    )
    this.name = 'SyncDivergenceExceededError'
  }
}

/** 本机首次连接该云存储且差异过大，需用户确认后继续 */
export class SyncDivergenceConfirmationRequiredError extends Error {
  constructor(
    public readonly divergencePercent: number,
    public readonly maxDivergencePercent: number
  ) {
    super(
      `SyncDivergenceConfirmationRequiredError: local/remote divergence ${divergencePercent}% exceeds limit ${maxDivergencePercent}% on first sync`
    )
    this.name = 'SyncDivergenceConfirmationRequiredError'
  }
}

export function isSyncDivergenceConfirmationRequiredError(
  error: unknown
): error is SyncDivergenceConfirmationRequiredError {
  return (
    error instanceof SyncDivergenceConfirmationRequiredError ||
    (error instanceof Error && error.name === 'SyncDivergenceConfirmationRequiredError')
  )
}

/** 未配置或历史 `null`（旧「不限制」）均视为 100%，即关闭差异保护 */
export function getEffectiveMaxDivergencePercent(
  config: Pick<S3SyncConfig, 'maxDivergencePercent'>
): number {
  const value = config.maxDivergencePercent
  if (value === null || value === undefined || value < 0 || value > 100) {
    return 100
  }
  return value
}

/** 统计本地与远端 manifest 中有差异的文件占比（0–100，整数） */
export function computeManifestDivergencePercent(
  local: SyncManifest,
  remote: SyncManifest
): number {
  const allPaths = new Set([...Object.keys(local.files), ...Object.keys(remote.files)])
  if (allPaths.size === 0) return 0

  let divergent = 0
  for (const filePath of allPaths) {
    const localEntry = local.files[filePath]
    const remoteEntry = remote.files[filePath]
    if (!localEntry || !remoteEntry || localEntry.hash !== remoteEntry.hash) {
      divergent++
    }
  }

  return Math.round((divergent / allPaths.size) * 100)
}

export function isSyncDivergenceAllowed(
  divergencePercent: number,
  maxDivergencePercent: number
): boolean {
  return divergencePercent <= maxDivergencePercent
}

/** 任一侧尚无同步文件时跳过差异保护（典型：首次下载或首次上传） */
export function shouldSkipSyncDivergenceCheck(local: SyncManifest, remote: SyncManifest): boolean {
  const localCount = Object.keys(local.files).length
  const remoteCount = Object.keys(remote.files).length
  return localCount === 0 || remoteCount === 0
}

export type AssertBidirectionalSyncDivergenceOptions = {
  storageHistory: IncrementalSyncStorageHistory
  highDivergenceConfirmed?: boolean
}

/** 双向同步前校验 */
export function assertBidirectionalSyncDivergenceAllowed(
  local: SyncManifest,
  remote: SyncManifest,
  config: Pick<S3SyncConfig, 'maxDivergencePercent'>,
  options: AssertBidirectionalSyncDivergenceOptions
): number {
  const divergencePercent = computeManifestDivergencePercent(local, remote)

  if (shouldSkipSyncDivergenceCheck(local, remote)) {
    return divergencePercent
  }

  const maxDivergencePercent = getEffectiveMaxDivergencePercent(config)
  if (isSyncDivergenceAllowed(divergencePercent, maxDivergencePercent)) {
    return divergencePercent
  }

  if (options.storageHistory === 'none') {
    if (!options.highDivergenceConfirmed) {
      throw new SyncDivergenceConfirmationRequiredError(divergencePercent, maxDivergencePercent)
    }
    return divergencePercent
  }

  throw new SyncDivergenceExceededError(divergencePercent, maxDivergencePercent)
}
