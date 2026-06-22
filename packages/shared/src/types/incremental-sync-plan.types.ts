import type { MergeDecision } from '../sync/three-way-merge'
import type { IncrementalSyncPlanReuseBaseline } from '../sync/incremental-sync-plan-reuse.util'

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
  /** 与 deletePropagationBlocked 同义，需在确认弹窗中选择处理方式 */
  requiresDeletePropagationChoice?: boolean
  /** 被保护拦截、待用户确认的删除条数 */
  blockedDeleteCount?: number
  /** 被拦截的删除方向 */
  blockedDeleteDirection?: 'local' | 'remote'
  /** 本次预览前自动补登记的工作区 */
  autoRegisteredVaults?: string[]
  /** 上次中断的同步进度（仅在有 resume 警告时填充） */
  interruptedSyncResume?: { completed: number; total: number }
  /** 本次规划前从注册表移除的跨端幽灵工作区 */
  prunedRegistryVaults?: string[]
  /** 规划完成时的本地/远端指纹，供确认前漂移检测 */
  planReuseBaseline?: IncrementalSyncPlanReuseBaseline
}

export type IncrementalSyncPlanDecision = Pick<MergeDecision, 'filePath' | 'type' | 'direction'>
