export type ThemeMode = 'system' | 'light' | 'dark'
export type AppLanguage = 'system' | 'zh' | 'en' | 'ja' | 'zh-TW'

export interface AppearanceSettingsProps {
  themeMode: ThemeMode
  seedColor: string
  language: AppLanguage
  onThemeModeChange: (mode: ThemeMode) => void
  onSeedColorChange: (color: string) => void
  onLanguageChange: (lang: AppLanguage) => void
  /** 嵌入设置枢纽分组，使用紧凑列表行样式 */
  embedded?: boolean
  isLast?: boolean
}
