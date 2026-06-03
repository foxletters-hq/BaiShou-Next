/** 与桌面 AppearanceSettingsCard 一致的种子色预设 */
export const PRESET_THEME_COLORS = [
  '#5BA8F5',
  '#FF6B6B',
  '#FFD93D',
  '#6BCB77',
  '#4D96FF',
  '#C77DFF'
] as const

export function isPresetThemeColor(color: string): boolean {
  const normalized = color.trim().toUpperCase()
  return PRESET_THEME_COLORS.some((c) => c.toUpperCase() === normalized)
}
