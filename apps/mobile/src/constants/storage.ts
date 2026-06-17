export const ONBOARDING_STORAGE_KEY = '@baishou/mobile_has_onboarded'
export const ONBOARDING_UI_LANGUAGE_KEY = '@baishou/onboarding_ui_language'
/** 迁移完成后待用户确认删除的旧版根目录 */
export const FLUTTER_LEGACY_MIGRATED_SOURCE_KEY =
  '@baishou/flutter_legacy_migrated_source'
/** 本机已完成旧版 Flutter → 新版目录迁移（与 installInstanceId 绑定） */
export const FLUTTER_LEGACY_MIGRATION_COMPLETED_KEY =
  '@baishou/flutter_legacy_migration_completed'
/** 全量恢复替换数据库后，待下次启动写入的 cloud_sync_config */
export const PENDING_RESTORE_CLOUD_SYNC_CONFIG_KEY =
  '@baishou/pending_restore_cloud_sync_config'
