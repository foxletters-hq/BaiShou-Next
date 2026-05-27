export type ThemeMode = 'system' | 'light' | 'dark'
export type AppLanguage = 'system' | 'zh' | 'en' | 'ja' | 'zh-TW'

export interface AppearanceSettingsProps {
  themeMode: ThemeMode
  seedColor: string
  language: AppLanguage
  onThemeModeChange: (mode: ThemeMode) => void
  onSeedColorChange: (color: string) => void
  onLanguageChange: (lang: AppLanguage) => void
}
