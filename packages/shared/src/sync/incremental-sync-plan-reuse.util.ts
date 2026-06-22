import type { SyncManifest } from '../types/version-control.types'

/** 确认弹窗内复用首次规划结果的最长有效期 */
export const INCREMENTAL_SYNC_PLAN_REUSE_TTL_MS = 120_000

export type IncrementalSyncPlanReuseOptions = {
  vaultRegistryChanged?: boolean
  /** 用户已在确认弹窗中确认高差异 */
  highDivergenceConfirmed?: boolean
  /** 用户已选择删除传播处理方式 */
  deletePropagationChoiceProvided?: boolean
  /** 规划后本地同步树摘要与当前扫描不一致 */
  localTreeDrifted?: boolean
  /** 规划后远端 manifest 与当前拉取结果不一致（含 files 与 removed） */
  remoteManifestDrifted?: boolean
}

export function shouldReplanIncrementalSyncOnConfirm(
  preview: {
    deletePropagationBlocked: boolean
    requiresHighDivergenceConfirm: boolean
    requiresDeletePropagationChoice?: boolean
  },
  planPreparedAtMs: number | null,
  options?: IncrementalSyncPlanReuseOptions
): boolean {
  if (!planPreparedAtMs) return true
  if (Date.now() - planPreparedAtMs > INCREMENTAL_SYNC_PLAN_REUSE_TTL_MS) return true
  if (preview.deletePropagationBlocked && !options?.deletePropagationChoiceProvided) return true
  if (preview.requiresHighDivergenceConfirm && !options?.highDivergenceConfirmed) return true
  if (options?.vaultRegistryChanged) return true
  if (options?.localTreeDrifted) return true
  if (options?.remoteManifestDrifted) return true
  if (
    options?.deletePropagationChoiceProvided &&
    (preview.requiresDeletePropagationChoice || preview.deletePropagationBlocked)
  ) {
    return true
  }
  return false
}

export type SyncTreeEntrySummary = {
  relPath: string
  size: number
  mtimeMs: number
}

export type LocalSyncTreeSummary = {
  fileCount: number
  maxMtimeMs: number
  /** 按路径排序的 size/mtime 指纹，用于检测非 max-mtime 文件的变更 */
  fingerprint: string
}

export function buildSyncTreeFingerprint(files: SyncTreeEntrySummary[]): string {
  if (files.length === 0) return ''
  return files
    .map((file) => `${file.relPath}\t${file.size}\t${file.mtimeMs}`)
    .sort()
    .join('\n')
}

function summarizeSyncTreeEntries(files: SyncTreeEntrySummary[]): LocalSyncTreeSummary {
  let maxMtimeMs = 0
  for (const file of files) {
    maxMtimeMs = Math.max(maxMtimeMs, file.mtimeMs)
  }
  return {
    fileCount: files.length,
    maxMtimeMs,
    fingerprint: buildSyncTreeFingerprint(files)
  }
}

export function summarizeSyncManifestFiles(manifest: SyncManifest): LocalSyncTreeSummary {
  const files = Object.entries(manifest.files).map(([relPath, entry]) => ({
    relPath,
    size: entry.size,
    mtimeMs: entry.lastModified
  }))
  return summarizeSyncTreeEntries(files)
}

export function summarizeScannedSyncFiles(files: SyncTreeEntrySummary[]): LocalSyncTreeSummary {
  return summarizeSyncTreeEntries(files)
}

export function hasLocalSyncTreeDrift(
  baseline: LocalSyncTreeSummary,
  current: LocalSyncTreeSummary
): boolean {
  return baseline.fingerprint !== current.fingerprint
}

/** 远端 manifest 中 removed 表指纹（路径 + hash + removedAt） */
export function buildSyncManifestRemovedFingerprint(manifest: SyncManifest): string {
  const removed = manifest.removed ?? {}
  return Object.entries(removed)
    .map(([filePath, entry]) => `${filePath}\t${entry.hash}\t${entry.removedAt}`)
    .sort()
    .join('\n')
}

export function hasRemoteManifestDrift(baseline: SyncManifest, current: SyncManifest): boolean {
  const baselineFiles = summarizeSyncManifestFiles(baseline)
  const currentFiles = summarizeSyncManifestFiles(current)
  if (hasLocalSyncTreeDrift(baselineFiles, currentFiles)) {
    return true
  }
  return buildSyncManifestRemovedFingerprint(baseline) !== buildSyncManifestRemovedFingerprint(current)
}

export type IncrementalSyncPlanReuseBaseline = {
  localFilesFingerprint: string
  remoteFilesFingerprint: string
  remoteRemovedFingerprint: string
  preparedAtMs: number
}

export function buildIncrementalSyncPlanReuseBaseline(
  local: SyncManifest,
  remote: SyncManifest,
  preparedAtMs: number = Date.now()
): IncrementalSyncPlanReuseBaseline {
  return {
    localFilesFingerprint: summarizeSyncManifestFiles(local).fingerprint,
    remoteFilesFingerprint: summarizeSyncManifestFiles(remote).fingerprint,
    remoteRemovedFingerprint: buildSyncManifestRemovedFingerprint(remote),
    preparedAtMs
  }
}

export function evaluateIncrementalSyncPlanDrift(
  baseline: IncrementalSyncPlanReuseBaseline,
  localManifest: SyncManifest,
  remoteManifest: SyncManifest,
  nowMs: number = Date.now()
): { localTreeDrifted: boolean; remoteManifestDrifted: boolean; ttlExpired: boolean } {
  const localSummary = summarizeSyncManifestFiles(localManifest)
  const remoteSummary = summarizeSyncManifestFiles(remoteManifest)
  return {
    ttlExpired: nowMs - baseline.preparedAtMs > INCREMENTAL_SYNC_PLAN_REUSE_TTL_MS,
    localTreeDrifted: baseline.localFilesFingerprint !== localSummary.fingerprint,
    remoteManifestDrifted:
      baseline.remoteFilesFingerprint !== remoteSummary.fingerprint ||
      baseline.remoteRemovedFingerprint !== buildSyncManifestRemovedFingerprint(remoteManifest)
  }
}

type VaultRegistryFingerprintFs = {
  exists: (path: string) => Promise<boolean>
  stat: (path: string) => Promise<{ mtimeMs?: number }>
  readFile: (path: string) => Promise<string>
}

/** 用于检测确认弹窗期间 vault_registry.json 是否被改写 */
export async function readVaultRegistryFingerprint(
  fileSystem: VaultRegistryFingerprintFs,
  registryPath: string
): Promise<string> {
  try {
    if (!(await fileSystem.exists(registryPath))) return 'missing'
    const [stat, content] = await Promise.all([
      fileSystem.stat(registryPath),
      fileSystem.readFile(registryPath)
    ])
    return `${stat.mtimeMs ?? 0}:${content.length}:${content}`
  } catch {
    return 'error'
  }
}
