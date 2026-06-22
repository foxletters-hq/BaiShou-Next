/** 增量同步本地/远程清单文件名（位于存储根 `.baishou/` 下） */
export const SYNC_MANIFEST_FILENAME = 'manifest.json'

/** 三向合并共同祖先快照（位于存储根 `.baishou/` 下） */
export const SYNC_REMOTE_SNAPSHOT_FILENAME = 'last-remote-manifest.json'

/** `SyncManifest.version` 当前格式版本 */
export const SYNC_MANIFEST_VERSION = 1

/** 远端 manifest 中「已移除记录」最大条数（同一路径只占一条） */
export const SYNC_MANIFEST_REMOVED_MAX_ENTRIES = 20000

/** 增量同步云目标配置（位于存储根目录） */
export const SYNC_CONFIG_FILENAME = '.baishou-s3.json'

/** 增量同步单文件分块大小（与 S3 multipart / WebDAV 分块一致） */
export const INCREMENTAL_SYNC_CHUNK_SIZE = 5 * 1024 * 1024

/** 增量同步默认云端路径前缀（与全量云备份 `backup_sync` 分离） */
export const DEFAULT_INCREMENTAL_SYNC_CLOUD_PATH = 'memories_sync'

/** 稳定设备安装 ID，存于同步根 `.baishou/` */
export const SYNC_DEVICE_ID_FILENAME = 'sync-device-id.txt'

/** i18n 键：`data_sync.incremental_sync_scope_*` */
export const INCREMENTAL_SYNC_SCOPE_I18N_KEYS = [
  'incremental_sync_scope_all_vaults',
  'incremental_sync_scope_diary',
  'incremental_sync_scope_summary',
  'incremental_sync_scope_sessions',
  'incremental_sync_scope_partners',
  'incremental_sync_scope_attachments',
  'incremental_sync_scope_settings',
  'incremental_sync_scope_registry'
] as const

/** i18n 键：`data_sync.backup_scope_*`（全量 ZIP 备份范围，非增量同步） */
export const FULL_BACKUP_SCOPE_I18N_KEYS = [
  'backup_scope_intro',
  'backup_scope_root',
  'backup_scope_database',
  'backup_scope_database_detail',
  'backup_scope_device_prefs',
  'backup_scope_not_incremental',
  'backup_scope_excludes_heading',
  'backup_scope_excludes_shadow',
  'backup_scope_excludes_sync_meta',
  'backup_scope_import_note'
] as const

/** 双向同步允许的最大本地/远端差异比例（%）下拉选项 */
export const SYNC_DIVERGENCE_THRESHOLD_OPTIONS = [20, 30, 40, 50, 60, 70, 80, 90, 100] as const
