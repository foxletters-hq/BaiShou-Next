// 公共 API 分组：增量同步计划、清单与冲突保护相关

export * from './types/sync.ipc'
export * from './types/version-control.types'
export {
  INCREMENTAL_SYNC_CHUNK_SIZE,
  INCREMENTAL_SYNC_SCOPE_I18N_KEYS,
  FULL_BACKUP_SCOPE_I18N_KEYS,
  SYNC_DIVERGENCE_THRESHOLD_OPTIONS,
  SYNC_MANIFEST_FILENAME,
  SYNC_REMOTE_SNAPSHOT_FILENAME,
  SYNC_REMOTE_VAULTS_FILENAME,
  SYNC_MANIFEST_VERSION,
  SYNC_MANIFEST_CAPABILITIES,
  SYNC_CONFIG_FILENAME,
  DEFAULT_INCREMENTAL_SYNC_CLOUD_PATH,
  SYNC_DEVICE_ID_FILENAME
} from './constants/incremental-sync.constants'
export {
  SyncDivergenceExceededError,
  SyncDivergenceConfirmationRequiredError,
  isSyncDivergenceConfirmationRequiredError,
  assertBidirectionalSyncDivergenceAllowed,
  computeManifestDivergencePercent,
  getEffectiveMaxDivergencePercent,
  isSyncDivergenceAllowed,
  shouldSkipSyncDivergenceCheck,
  type AssertBidirectionalSyncDivergenceOptions
} from './sync/sync-divergence'
export { runIncrementalSyncWithDivergenceConfirmation } from './sync/sync-divergence-run.util'
export {
  SyncDeletePropagationBlockedError,
  SyncDeletePropagationChoiceRequiredError,
  assertBidirectionalDeletePropagationAllowed,
  inspectDeletePropagationBlock,
  omitBlockedDeletePropagationDecisions,
  resolveSyncMergeDecisions,
  SYNC_DELETE_GUARD_MIN_REMOTE_FILES,
  SYNC_DELETE_GUARD_MAX_REMOTE_DELETE_RATIO,
  SYNC_DELETE_GUARD_MAX_DELETE_RATIO,
  SYNC_LOCAL_DATA_LOSS_RATIO,
  SYNC_LOCAL_VS_ANCESTOR_MIN_RATIO,
  type SyncDeletePropagationDirection,
  type SyncDeletePropagationBlockReason,
  type SyncDeletePropagationGuardOptions
} from './sync/sync-delete-guard'
export {
  requiresExplicitDeletePropagationChoice,
  getDeletePropagationChoiceTitleKey,
  getDeletePropagationChoiceDescKey,
  type SyncDeletePropagationChoice
} from './sync/sync-delete-propagation-choice.util'
export {
  SYNC_CONFIRM_DELAY_MS,
  SYNC_CONFIRM_DELAY_SECONDS,
  SyncConfirmNotReadyError,
  computeSyncConfirmSecondsLeft,
  computeSyncConfirmSecondsLeftUntil,
  isSyncConfirmEligible,
  isSyncConfirmReady,
  getSyncConfirmEligibleAt,
  assertSyncConfirmReady,
  assertSyncConfirmAllowed,
  canExecuteIncrementalSyncPlan,
  resolvePlanConfirmEligibleAt
} from './sync/sync-confirm-countdown.util'
export {
  hasIncrementalSyncPlanMaterialChange,
  hasIncrementalSyncPlanReconfirmWorthyChange
} from './sync/incremental-sync-plan-compare.util'
export {
  INCREMENTAL_SYNC_PLAN_REUSE_TTL_MS,
  buildIncrementalSyncPlanReuseBaseline,
  buildSyncManifestRemovedFingerprint,
  buildSyncTreeFingerprint,
  evaluateIncrementalSyncPlanDrift,
  hasLocalSyncTreeDrift,
  hasRemoteManifestDrift,
  readVaultRegistryFingerprint,
  shouldReplanIncrementalSyncOnConfirm,
  summarizeScannedSyncFiles,
  summarizeSyncManifestFiles,
  type IncrementalSyncPlanReuseBaseline,
  type IncrementalSyncPlanReuseOptions,
  type LocalSyncTreeSummary,
  type SyncTreeEntrySummary
} from './sync/incremental-sync-plan-reuse.util'
export { buildIncrementalSyncPlanMergeResult } from './sync/incremental-sync-plan-decisions.util'
export {
  resolveIncrementalSyncConfirmReplan,
  shouldRequireIncrementalSyncReconfirmAfterReplan,
  type IncrementalSyncConfirmReplanInput,
  type IncrementalSyncConfirmReplanResult
} from './sync/incremental-sync-confirm-replan.util'
export { isIncrementalSyncRemoteFileNotFoundError } from './sync/sync-download-errors.util'
export { SYNC_MANIFEST_REMOVED_MAX_ENTRIES } from './constants/incremental-sync.constants'
export {
  applySyncDecisionRemovedSideEffects,
  clearSyncManifestRemoved,
  createEmptySyncManifest,
  finalizeIncrementalSyncManifest,
  getSyncManifestRemovedEntry,
  getSyncManifestRemovedMap,
  isRemoteRemovalRecorded,
  normalizeSyncManifest,
  pruneSyncManifestRemoved,
  reconcileSyncManifestRemovedWithRemoteFiles,
  recordSyncManifestRemoved,
  SYNC_TOMBSTONE_CLOCK_SKEW_MS
} from './sync/sync-manifest-removed.util'
export {
  countUnverifiedAncestorEntries,
  reconcileAncestorWithRemoteTruth
} from './sync/reconcile-ancestor-with-remote.util'
export { upsertManifestPathEntries } from './sync/sync-manifest-path-entries.util'
export {
  INCREMENTAL_SYNC_CHECKPOINT_COMMIT_STEPS,
  type IncrementalSyncCheckpointCommitStep
} from './sync/incremental-sync-checkpoint-commit.util'
export { classifyIncrementalSyncPaths } from './sync/incremental-sync-path-classify.util'
export type { RemovedManifestEntry } from './types/version-control.types'
export {
  sessionBelongsToActiveVault,
  sessionBelongsToActiveVaultId,
  resolveSessionFlushTargetVault
} from './utils/session-vault.util'
export * from './utils/version-control-path.util'
export * from './utils/git-commit-message.util'
export { threeWayMerge, type MergeDecision } from './sync/three-way-merge'
export type {
  IncrementalSyncPlanPreview,
  IncrementalSyncPlanItem,
  IncrementalSyncVaultSummary,
  IncrementalSyncBoundaryIssues,
  IncrementalSyncPlanAction
} from './types/incremental-sync-plan.types'
export {
  buildIncrementalSyncPlanPreview,
  buildIncrementalSyncBoundaryIssues,
  buildIncrementalSyncBoundaryHints,
  resolveIncrementalSyncVaultScope,
  resolveIncrementalSyncTransferBytes,
  formatIncrementalSyncPlanBytes,
  collectManifestVaultScopes,
  isRegistryVaultOnDisk,
  isLegacyRemoteManifest,
  INCREMENTAL_SYNC_GLOBAL_SCOPE
} from './sync/incremental-sync-plan.util'
export {
  DEFAULT_SYNC_TRAFFIC_PROMPT_ENABLED,
  DEFAULT_SYNC_TRAFFIC_THRESHOLD_MB,
  DEFAULT_SYNC_TRAFFIC_THRESHOLD_BYTES,
  shouldWarnCellularSyncTraffic,
  syncTrafficThresholdMbToBytes
} from './sync/sync-traffic-guard.util'
export type {
  IncrementalSyncBoundaryHint,
  IncrementalSyncBoundaryHintKey
} from './sync/incremental-sync-plan.util'
export {
  migrateSyncManifestVaultPrefix,
  rewriteSyncManifestVaultPath,
  isSyncManifestPathUnderVault,
  sumVaultFileBytes,
  countVaultRemovedEntries
} from './sync/migrate-sync-manifest-vault-prefix.util'
export type { MigrateSyncManifestVaultPrefixResult } from './sync/migrate-sync-manifest-vault-prefix.util'
export {
  detectVaultRenameCandidates,
  collectVaultRenameProtectedPaths,
  applyVaultRenamePassManifests,
  simulateVaultRenamePass,
  executeVaultRenamePass,
  rollbackCompletedVaultRenames,
  parseVaultIdToNameMap,
  parseLastRemoteVaultsSnapshot,
  serializeLastRemoteVaultsSnapshot,
  createEmptyLastRemoteVaultsSnapshot,
  listSyncManifestVaultFilePaths
} from './sync/sync-vault-rename-pass.util'
export type {
  LastRemoteVaultsSnapshot,
  VaultRenameCandidate,
  VaultRenamePassResult,
  VaultRenamePassSuccess,
  VaultRenamePassFailure,
  VaultRenameCloudClient,
  CompletedVaultRename
} from './sync/sync-vault-rename-pass.util'
export { assertSafeSyncRelPath, UnsafeSyncRelPathError } from './sync/sync-rel-path.util'
export {
  prepareVaultRenamePassForPlan,
  prepareVaultRenamePassForSync
} from './sync/prepare-vault-rename-pass.util'
export type { PreparedVaultRenamePass } from './sync/prepare-vault-rename-pass.util'
