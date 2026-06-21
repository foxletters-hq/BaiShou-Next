import type {
  IncrementalSyncBoundaryIssues,
  IncrementalSyncPlanItem,
  IncrementalSyncPlanPreview,
  IncrementalSyncVaultSummary
} from '../types/incremental-sync-plan.types'
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

export function buildIncrementalSyncBoundaryIssues(options: {
  registeredVaults: string[]
  diskVaultNames: string[]
  planItems: IncrementalSyncPlanItem[]
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

  const onDisk = new Set(options.diskVaultNames)
  const registryVaultsMissingOnDisk = options.registeredVaults.filter((name) => !onDisk.has(name))

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

function toPlanItem(decision: MergeDecision): IncrementalSyncPlanItem | null {
  if (decision.type === 'skip') return null
  const action =
    decision.type === 'conflict-resolved'
      ? ('conflict-resolved' as const)
      : decision.type
  return {
    filePath: decision.filePath,
    action,
    vaultScope: resolveIncrementalSyncVaultScope(decision.filePath)
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
      samplePaths: []
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
    planItems: items
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

  return {
    activeVaultName: options.activeVaultName,
    registeredVaults: [...options.registeredVaults],
    vaultSummaries: summarizeByVault(items),
    items,
    warnings,
    changeCount: items.length,
    skippedCount,
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
