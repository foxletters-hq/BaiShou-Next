/** 设置枢纽条目 id → 与桌面 SettingsShell / sidebar-nav-catalog 一致的 Lucide 图标语义 */
export const SETTINGS_NAV_ICON_IDS = [
  'ai-services',
  'ai-models',
  'assistants',
  'rag',
  'web-search',
  'mcp',
  'agent-tools',
  'tts',
  'diary-template',
  'summary-settings',
  'incremental-sync',
  'data-sync',
  'attachments',
  'lan-transfer',
  'storage',
  'version-migration',
  'general'
] as const

export type SettingsNavIconId = (typeof SETTINGS_NAV_ICON_IDS)[number]
