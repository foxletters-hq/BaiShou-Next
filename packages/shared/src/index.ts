export * from './types/diary.types'
export * from './types/summary.types'
export * from './types/agent.types'
export * from './types/settings.types'
export {
  ProviderType,
  WebSearchMode,
  getDefaultWebSearchMode,
  createAiProvider
} from './types/ai-provider.types'
export type { AiProviderModel } from './types/ai-provider.types'
export * from './types/user-profile.types'
export * from './types/prompt-shortcut.types'
export * from './types/sync.ipc'
export * from './types/version-control.types'
export * from './types/rag.types'
export * from './types/embedding-migration-state.types'
export * from './types/legacy-migration.types'
export * from './types/legacy-version-migration.types'

export { default as i18n } from './i18n/i18n'
export * from './i18n/i18n.types'

export * from './utils/pricing.util'
export * from './utils/date.utils'
export * from './message-metadata'
export { logger } from './utils/logger'
export { traceCall, SHORTCUT_TRACE_CHAIN } from './utils/call-trace'
export * from './utils/prompt-shortcut.util'
export * from './utils/model-capabilities'

// Mock 数据与类型（供开发阶段跨包使用）
export * from './mock/agent.mock'

export * from './utils/embedding.utils'
export * from './utils/vector-bytes.util'
export * from './utils/ai-provider-filter.util'
export * from './utils/storage-path.util'
export * from './utils/ai-api-error.util'
export * from './utils/concurrency.util'
export * from './utils/rag-diary.util'
export * from './utils/rag-embed-failure.util'
export * from './utils/rag-embedding-sort.util'
export * from './utils/web-search-config.util'
export * from './utils/mcp-auth.util'
export { signS3Request, s3FetchHeaders } from './utils/aws-v4-sign'
export * from './utils/s3-list.util'
export * from './utils/s3-url'
export * from './utils/cloud-sync-config.util'
export {
  isIncrementalSyncReady,
  getRootIncrementalSyncConfigPath,
  migrateLegacyIncrementalSyncConfig,
  resetIncrementalSyncMetaAfterFullRestore,
  FULL_BACKUP_EXCLUDED_ROOT_NAMES,
  INCREMENTAL_SYNC_META_RESET_FILENAMES,
  type IncrementalSyncFileStorage
} from './utils/incremental-sync-config.util'
export {
  INCREMENTAL_SYNC_BAISHOU_ALLOWLIST,
  INCREMENTAL_SYNC_BAISHOU_SETTINGS_PREFIX,
  isSqliteRuntimeSyncPath,
  shouldIncludeIncrementalSyncFile,
  shouldScanIncrementalSyncDirectory
} from './utils/incremental-sync-scan.util'
export {
  WEBDAV_SHALLOW_LIST_CONCURRENCY,
  parseWebDavPropfindEntries,
  toRelativeWebDavPath,
  isManagedIncrementalZipPath,
  type WebDavListEntry
} from './utils/incremental-sync-webdav.util'
export { resolveSyncDeviceId } from './utils/sync-device-id.util'
export {
  LAN_DEVICE_STALE_MS,
  LAN_DISCOVERY_RESCAN_MS,
  LAN_DISCOVERY_REQUERY_MS,
  buildLanServiceName,
  formatLanBackupSizeMb,
  formatLanReceivedBackupContent,
  getLanDeviceDedupKey,
  getLanDeviceHostKey,
  isExcludedLanIpv4,
  isPrivateLanIpv4,
  lanDevicesEquivalent,
  parseLanTxtIpv4,
  pickBestLanIpv4,
  removeDiscoveredLanDevice,
  resolveDiscoveredLanIpv4,
  upsertDiscoveredLanDevice,
  type LanDiscoveredDeviceLike
} from './utils/lan-discovery.util'
export { resolveInstallInstanceId } from './utils/install-instance-id.util'
export type { InstallInstanceIdStorage } from './utils/install-instance-id.util'
export {
  INCREMENTAL_SYNC_CHUNK_SIZE,
  INCREMENTAL_SYNC_SCOPE_I18N_KEYS,
  FULL_BACKUP_SCOPE_I18N_KEYS,
  SYNC_DIVERGENCE_THRESHOLD_OPTIONS,
  SYNC_MANIFEST_FILENAME,
  SYNC_REMOTE_SNAPSHOT_FILENAME,
  SYNC_MANIFEST_VERSION,
  SYNC_CONFIG_FILENAME,
  DEFAULT_INCREMENTAL_SYNC_CLOUD_PATH,
  SYNC_DEVICE_ID_FILENAME
} from './constants/incremental-sync.constants'
export {
  SYNC_STORAGE_ID_FILENAME,
  getIncrementalSyncStorageId,
  resolveIncrementalSyncStorageHistory,
  type IncrementalSyncStorageHistory
} from './utils/incremental-sync-storage.util'
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
  assertBidirectionalDeletePropagationAllowed,
  SYNC_DELETE_GUARD_MIN_REMOTE_FILES,
  SYNC_DELETE_GUARD_MAX_REMOTE_DELETE_RATIO,
  SYNC_LOCAL_DATA_LOSS_RATIO,
  SYNC_LOCAL_VS_ANCESTOR_MIN_RATIO
} from './sync/sync-delete-guard'
export { sessionBelongsToActiveVault } from './utils/session-vault.util'

export * from './tts'
export type { TtsSettings } from './types/settings.types'
export * from './types/tts.types'
export * from './constants/provider-base-urls'
export * from './constants/app-locale.constants'
export * from './constants/user-profile.constants'
export * from './constants/summary-templates'
export * from './constants/summary-templates/index'
export * from './constants/diary-templates'
export * from './utils/diary-template.util'
export * from './types/summary-prompt.types'
export * from './utils/summary-template.util'
export * from './constants/weather.constants'
export * from './constants/github.constants'
export * from './constants/rag-migration.constants'
export * from './constants/legacy-migration.constants'
export * from './constants/compression-prompt.defaults'
export * from './constants/compression-errors'
export * from './constants/compression-previous-summary'
export * from './utils/rag-migration-i18n.util'
export * from './utils/rag-migration-result.util'
export * from './utils/main-i18n.util'
export * from './utils/migration-backup.util'
export * from './utils/version.utils'
export * from './utils/diary-preview.util'
export * from './utils/diary-tags.util'
export * from './utils/compression-text-normalizer'
export * from './utils/summary-config.util'
export * from './utils/user-avatar.util'
export * from './utils/user-card.util'
export * from './utils/user-profile-settings.util'
export * from './utils/agent-dialogue-model.util'
export * from './utils/session-title.util'
export * from './constants/builtin-assistant-avatars.constants'
export * from './constants/avatar-import.constants'
export * from './constants/latte-default-assistant.constants'
export * from './constants/assistant-kind.constants'
export * from './constants/latte-assistant-prompt.defaults'
export * from './types/agent-navigation.types'
export * from './constants/agent-navigation.constants'
export * from './utils/agent-navigation.util'
export * from './utils/assistant-avatar.util'
export * from './utils/app-ui-locale.util'
export * from './utils/message-attachment.util'
export * from './utils/attachment-reference.util'
export * from './utils/version-control-path.util'

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
  resolveIncrementalSyncVaultScope
} from './sync/incremental-sync-plan.util'
