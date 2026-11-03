export const ONBOARDING_STORAGE_KEY = '@baishou/mobile_has_onboarded'
export const ONBOARDING_UI_LANGUAGE_KEY = '@baishou/onboarding_ui_language'
export const ONBOARDING_NICKNAME_KEY = '@baishou/onboarding_nickname'
export const ONBOARDING_BIRTHDAY_KEY = '@baishou/onboarding_birthday'
export const ONBOARDING_GENDER_KEY = '@baishou/onboarding_gender'
export const ONBOARDING_CUSTOM_GENDER_KEY = '@baishou/onboarding_custom_gender'
/** 用户档案快照本地持久化键，与桌面端 snapshot 机制对齐，消除进入伙伴页时的昵称闪烁 */
export const AGENT_USER_PROFILE_SNAPSHOT_KEY = '@baishou/agent_user_profile_snapshot_v1'
/** 迁移完成后待用户确认删除的旧版根目录 */
export const FLUTTER_LEGACY_MIGRATED_SOURCE_KEY = '@baishou/flutter_legacy_migrated_source'
/** 本机已完成旧版 Flutter → 新版目录迁移（与 installInstanceId 绑定） */
export const FLUTTER_LEGACY_MIGRATION_COMPLETED_KEY = '@baishou/flutter_legacy_migration_completed'
/** 用户选择「稍后再说」后不再自动弹出旧版迁移引导 */
export const LEGACY_MIGRATION_PROMPT_DISMISSED_KEY = '@baishou/legacy_migration_prompt_dismissed'
/** 全量恢复替换数据库后，待下次启动写入的 cloud_sync_config */
export const PENDING_RESTORE_CLOUD_SYNC_CONFIG_KEY = '@baishou/pending_restore_cloud_sync_config'
