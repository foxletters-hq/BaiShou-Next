import type {
  IncrementalSyncBoundaryIssues,
  IncrementalSyncPlanItem,
  IncrementalSyncPlanPreview,
  IncrementalSyncVaultSummary
} from '../types/incremental-sync-plan.types'
import type { SyncManifest } from '../types/version-control.types'
import type { MergeDecision } from './three-way-merge'

const ROOT_SCOPE = '__root__'
const UNKNOWN_SCOPE = '__unknown__'
const ROOT_FILES = new Set(['vault_registry.json'])

export function resolveIncrementalSyncVaultScope(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  if (ROOT_FILES.has(normalized)) return ROOT_SCOPE
  const slash = normalized.indexOf('/')
  if (slash === -1) return ROOT_SCOPE
  return normalized.slice(0, slash)
}

/** 与 core vault-name.util 一致：判断注册名是否已有对应磁盘目录（大小写不敏感） */
export function isRegistryVaultOnDisk(
  vaultName: string,
  diskVaultNames: readonly string[]
): boolean {
  const sanitized = vaultName.replace(/[\\/:%#?*\x00-\x1f]/g, '_').trim() || 'vault'
  const targets = new Set(
    [vaultName, sanitized].map((name) => name.trim().toLocaleLowerCase()).filter(Boolean)
  )
  return diskVaultNames.some((diskName) => targets.has(diskName.trim().toLocaleLowerCase()))
}

/** 汇总 manifest 中出现的工作区作用域（不含 __root__ / __unknown__） */
export function collectManifestVaultScopes(
  ...manifests: Array<Pick<SyncManifest, 'files'>>
): Set<string> {
  const scopes = new Set<string>()
  for (const manifest of manifests) {
    for (const filePath of Object.keys(manifest.files)) {
      const scope = resolveIncrementalSyncVaultScope(filePath)
      if (scope !== ROOT_SCOPE && scope !== UNKNOWN_SCOPE) {
        scopes.add(scope)
      }
    }
  }
  return scopes
}

export function buildIncrementalSyncBoundaryIssues(options: {
  registeredVaults: string[]
  diskVaultNames: string[]
  planItems: IncrementalSyncPlanItem[]
  manifestVaultScopes?: ReadonlySet<string>
}): IncrementalSyncBoundaryIssues {
  const registered = new Set(options.registeredVaults)
  const planVaultScopes = new Set(
    options.planItems
      .map((item) => item.vaultScope)
      .filter((scope) => scope !== ROOT_SCOPE && scope !== UNKNOWN_SCOPE)
  )

  const unknownVaultPaths = [...planVaultScopes].filter((scope) => !registered.has(scope))

  // 仅警告「本次同步有变更」且未注册的工作区，避免磁盘上的空目录/历史残留误报
  const diskVaultsNotInRegistry = options.diskVaultNames.filter(
    (name) => !registered.has(name) && planVaultScopes.has(name)
  )

  const registryVaultsMissingOnDisk = options.registeredVaults.filter((name) => {
    if (isRegistryVaultOnDisk(name, options.diskVaultNames)) return false
    const hasPlan = planVaultScopes.has(name)
    const hasManifest = options.manifestVaultScopes?.has(name) ?? false
    // 仅警告本机确实需要同步数据、但缺少目录的工作区（其它设备遗留的空注册项不提示）
    return hasPlan || hasManifest
  })

  return {
    unknownVaultPaths,
    diskVaultsNotInRegistry,
    registryVaultsMissingOnDisk
  }
}

export type IncrementalSyncBoundaryHintKey =
  | 'data_sync.plan_warning_unknown_vault_paths'
  | 'data_sync.plan_warning_disk_vaults_not_in_registry'
  | 'data_sync.plan_warning_registry_vaults_missing_on_disk'

export interface IncrementalSyncBoundaryHint {
  messageKey: IncrementalSyncBoundaryHintKey
  listParam: 'paths' | 'vaults' | 'missing'
  names: string[]
}

/** 与 buildIncrementalSyncPlanPreview 的 warnings 优先级一致，避免 UI 重复展示同类边界提示 */
export function buildIncrementalSyncBoundaryHints(
  issues: IncrementalSyncBoundaryIssues
): IncrementalSyncBoundaryHint[] {
  const hints: IncrementalSyncBoundaryHint[] = []
  if (issues.unknownVaultPaths.length > 0) {
    hints.push({
      messageKey: 'data_sync.plan_warning_unknown_vault_paths',
      listParam: 'paths',
      names: issues.unknownVaultPaths
    })
  } else if (issues.diskVaultsNotInRegistry.length > 0) {
    hints.push({
      messageKey: 'data_sync.plan_warning_disk_vaults_not_in_registry',
      listParam: 'vaults',
      names: issues.diskVaultsNotInRegistry
    })
  }
  if (issues.registryVaultsMissingOnDisk.length > 0) {
    hints.push({
      messageKey: 'data_sync.plan_warning_registry_vaults_missing_on_disk',
      listParam: 'missing',
      names: issues.registryVaultsMissingOnDisk
    })
  }
  return hints
}

function normalizeSizeBytes(size: number | undefined): number {
  if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) return 0
  return size
}

/**
 * 将计划项字节归入上传/下载。
 * 删除不产生传输；冲突按 direction 归类；无 direction 的冲突不计流量。
 */
export function resolveIncrementalSyncTransferBytes(item: Pick<
  IncrementalSyncPlanItem,
  'action' | 'sizeBytes' | 'direction'
>): { uploadBytes: number; downloadBytes: number } {
  const sizeBytes = normalizeSizeBytes(item.sizeBytes)
  switch (item.action) {
    case 'upload':
      return { uploadBytes: sizeBytes, downloadBytes: 0 }
    case 'download':
      return { uploadBytes: 0, downloadBytes: sizeBytes }
    case 'conflict-resolved':
      if (item.direction === 'upload') return { uploadBytes: sizeBytes, downloadBytes: 0 }
      if (item.direction === 'download') return { uploadBytes: 0, downloadBytes: sizeBytes }
      return { uploadBytes: 0, downloadBytes: 0 }
    case 'delete-local':
    case 'delete-remote':
    default:
      return { uploadBytes: 0, downloadBytes: 0 }
  }
}

/** 人类可读字节（如 `12.4 MB`），供确认弹窗流量摘要使用 */
export function formatIncrementalSyncPlanBytes(bytes: number): string {
  const value = normalizeSizeBytes(bytes)
  if (value >= 1024 * 1024 * 1024) return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`
  if (value >= 1024) return `${Math.round(value / 1024)} KB`
  return `${Math.round(value)} B`
}

function toPlanItem(decision: MergeDecision): IncrementalSyncPlanItem | null {
  if (decision.type === 'skip') return null
  const action =
    decision.type === 'conflict-resolved' ? ('conflict-resolved' as const) : decision.type
  return {
    filePath: decision.filePath,
    action,
    vaultScope: resolveIncrementalSyncVaultScope(decision.filePath),
    sizeBytes: normalizeSizeBytes(decision.size),
    ...(decision.direction ? { direction: decision.direction } : {})
  }
}

function summarizeByVault(items: IncrementalSyncPlanItem[]): IncrementalSyncVaultSummary[] {
  const map = new Map<string, IncrementalSyncVaultSummary>()

  const ensure = (vaultName: string): IncrementalSyncVaultSummary => {
    const existing = map.get(vaultName)
    if (existing) return existing
    const created: IncrementalSyncVaultSummary = {
      vaultName,
      upload: 0,
      download: 0,
      deleteLocal: 0,
      deleteRemote: 0,
      conflict: 0,
      samplePaths: [],
      uploadBytes: 0,
      downloadBytes: 0
    }
    map.set(vaultName, created)
    return created
  }

  for (const item of items) {
    const summary = ensure(item.vaultScope)
    switch (item.action) {
      case 'upload':
        summary.upload += 1
        break
      case 'download':
        summary.download += 1
        break
      case 'delete-local':
        summary.deleteLocal += 1
        break
      case 'delete-remote':
        summary.deleteRemote += 1
        break
      case 'conflict-resolved':
        summary.conflict += 1
        break
    }
    const transfer = resolveIncrementalSyncTransferBytes(item)
    summary.uploadBytes += transfer.uploadBytes
    summary.downloadBytes += transfer.downloadBytes
    if (summary.samplePaths.length < 5) {
      summary.samplePaths.push(item.filePath)
    }
  }

  return [...map.values()].sort((a, b) => a.vaultName.localeCompare(b.vaultName, 'zh-CN'))
}

export function buildIncrementalSyncPlanPreview(options: {
  decisions: MergeDecision[]
  registeredVaults: string[]
  diskVaultNames: string[]
  activeVaultName: string | null
  manifestVaultScopes?: ReadonlySet<string>
  requiresHighDivergenceConfirm?: boolean
  divergencePercent?: number
  maxDivergencePercent?: number
  deletePropagationBlocked?: boolean
  deletePropagationReason?: 'mass_delete' | 'local_data_loss' | 'remote_data_loss'
  blockedDeleteCount?: number
  blockedDeleteDirection?: 'local' | 'remote'
  extraWarnings?: string[]
}): IncrementalSyncPlanPreview {
  const skippedCount = options.decisions.filter((d) => d.type === 'skip').length
  const items = options.decisions
    .map(toPlanItem)
    .filter((item): item is IncrementalSyncPlanItem => item != null)

  const boundaryIssues = buildIncrementalSyncBoundaryIssues({
    registeredVaults: options.registeredVaults,
    diskVaultNames: options.diskVaultNames,
    planItems: items,
    manifestVaultScopes: options.manifestVaultScopes
  })

  const warnings = [...(options.extraWarnings ?? [])]
  if (boundaryIssues.unknownVaultPaths.length > 0) {
    warnings.push('data_sync.plan_warning_unknown_vault_paths')
  } else if (boundaryIssues.diskVaultsNotInRegistry.length > 0) {
    warnings.push('data_sync.plan_warning_disk_vaults_not_in_registry')
  }
  if (boundaryIssues.registryVaultsMissingOnDisk.length > 0) {
    warnings.push('data_sync.plan_warning_registry_vaults_missing_on_disk')
  }
  if (options.requiresHighDivergenceConfirm) {
    warnings.push('data_sync.plan_warning_high_divergence')
  }
  if (options.deletePropagationBlocked) {
    warnings.push('data_sync.plan_warning_delete_blocked')
  }

  const vaultSummaries = summarizeByVault(items)
  let totalUploadBytes = 0
  let totalDownloadBytes = 0
  for (const summary of vaultSummaries) {
    totalUploadBytes += summary.uploadBytes
    totalDownloadBytes += summary.downloadBytes
  }

  return {
    activeVaultName: options.activeVaultName,
    registeredVaults: [...options.registeredVaults],
    vaultSummaries,
    items,
    warnings,
    changeCount: items.length,
    skippedCount,
    totalUploadBytes,
    totalDownloadBytes,
    boundaryIssues,
    requiresHighDivergenceConfirm: options.requiresHighDivergenceConfirm ?? false,
    divergencePercent: options.divergencePercent,
    maxDivergencePercent: options.maxDivergencePercent,
    deletePropagationBlocked: options.deletePropagationBlocked ?? false,
    deletePropagationReason: options.deletePropagationReason,
    requiresDeletePropagationChoice: options.deletePropagationBlocked ?? false,
    blockedDeleteCount: options.blockedDeleteCount,
    blockedDeleteDirection: options.blockedDeleteDirection
  }
}
