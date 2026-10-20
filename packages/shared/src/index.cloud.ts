// 公共 API 分组：云同步客户端、WebDAV、S3 与局域网发现相关

export { signS3Request, s3FetchHeaders } from './utils/aws-v4-sign'
export { createRandomVaultId, deriveLegacyVaultId, isVaultId } from './utils/vault-id.util'
export {
  resolveVaultIdFromRecord,
  resolveVaultIdentity,
  type VaultIdentity
} from './utils/vault-record-id.util'
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
  INCREMENTAL_SYNC_ROOT_AGENTS_SKILLS_PREFIX,
  VAULT_IDENTITY_META_SYNC_FILENAME,
  isSqliteRuntimeSyncPath,
  isJsonlShardsManifestSyncPath,
  isIncrementalSyncChatBackgroundPath,
  isIncrementalSyncConflictBackupPath,
  isVaultIdentityMetaRelPath,
  isRootAgentsSkillsTree,
  isLegacyVaultSettingsSyncPath,
  isIncrementalSyncProtectedRemotePath,
  shouldIncludeIncrementalSyncFile,
  shouldScanIncrementalSyncDirectory
} from './utils/incremental-sync-scan.util'
export {
  VAULT_EXTERNAL_PATHS_SYNC_FILENAME,
  buildVaultArchivesSyncPrefix,
  buildVaultJournalsSyncPrefix,
  externalAbsPathToSyncRelPath,
  isAbsPathUnderExternalSyncMount,
  isInternalDefaultJournalsOrArchivesRelPath,
  isUsingExternalVaultDirectory,
  normalizeIncrementalSyncAbsPathForCompare,
  shouldExcludeIncrementalSyncRootScanEntry,
  isVaultExternalPathsConfigRelPath,
  normalizeIncrementalSyncAbsPath,
  normalizeIncrementalSyncRelPath,
  resolveIncrementalSyncRelPath,
  shouldIncludeIncrementalSyncFileWithExternalConfig,
  shouldScanIncrementalSyncDirectoryWithExternalMounts,
  type VaultExternalSyncKind,
  type VaultExternalSyncMount
} from './utils/incremental-sync-external-paths.util'
export {
  WEBDAV_SHALLOW_LIST_CONCURRENCY,
  WEBDAV_PROPFIND_BODY,
  normalizeWebDavBaseUrl,
  inferWebDavDefaultScheme,
  buildWebDavFileUrl,
  resolveWebDavListingUrl,
  ensureWebDavCollectionUrl,
  normalizeWebDavListingUrl,
  isStrictWebDavChildUrl,
  suggestWebDavHttpFallbackUrl,
  rewriteWebDavUrlOrigin,
  describeWebDavTarget,
  parseWebDavPropfindEntries,
  toRelativeWebDavPath,
  isManagedIncrementalZipPath,
  formatWebDavRequestError,
  isTransientWebDavHttpStatus,
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
  isVirtualLanInterfaceName,
  lanDeviceIpCandidates,
  lanDevicesEquivalent,
  normalizeLanDeviceType,
  parseLanTxtIpv4,
  pickBestLanIpv4,
  removeDiscoveredLanDevice,
  resolveDiscoveredLanIpv4,
  resolveDiscoveredLanIpv4Candidates,
  upsertDiscoveredLanDevice,
  type LanDeviceType,
  type LanDiscoveredDeviceLike
} from './utils/lan-discovery.util'
export { resolveInstallInstanceId } from './utils/install-instance-id.util'
export type { InstallInstanceIdStorage } from './utils/install-instance-id.util'
export {
  SYNC_STORAGE_ID_FILENAME,
  getIncrementalSyncStorageId,
  resolveIncrementalSyncStorageHistory,
  type IncrementalSyncStorageHistory
} from './utils/incremental-sync-storage.util'
