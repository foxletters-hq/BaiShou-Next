import type { MergeDecision } from '../sync/three-way-merge'

export type IncrementalSyncPlanAction =
  | 'upload'
  | 'download'
  | 'delete-local'
  | 'delete-remote'
  | 'conflict-resolved'

export interface IncrementalSyncPlanItem {
  filePath: string
  action: IncrementalSyncPlanAction
  /** 工作区名、`__root__`（注册表等根级文件）或 `__unknown__` */
  vaultScope: string
}

export interface IncrementalSyncVaultSummary {
  vaultName: string
  upload: number
  download: number
  deleteLocal: number
  deleteRemote: number
  conflict: number
  samplePaths: string[]
}

export interface IncrementalSyncBoundaryIssues {
  unknownVaultPaths: string[]
  diskVaultsNotInRegistry: string[]
  registryVaultsMissingOnDisk: string[]
}

export interface IncrementalSyncPlanPreview {
  activeVaultName: string | null
  registeredVaults: string[]
  vaultSummaries: IncrementalSyncVaultSummary[]
  items: IncrementalSyncPlanItem[]
  warnings: string[]
  changeCount: number
  skippedCount: number
  boundaryIssues: IncrementalSyncBoundaryIssues
  requiresHighDivergenceConfirm: boolean
  divergencePercent?: number
  maxDivergencePercent?: number
  deletePropagationBlocked: boolean
  deletePropagationReason?: 'mass_delete' | 'local_data_loss' | 'remote_data_loss'
  /** 本次预览前自动补登记的工作区 */
  autoRegisteredVaults?: string[]
}

export type IncrementalSyncPlanDecision = Pick<MergeDecision, 'filePath' | 'type' | 'direction'>
