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

/** 深蓝 / 灰阶实验色 → 原品牌蓝 #5BA8F5 */
const LEGACY_THEME_COLOR_MAP: Record<string, string> = {
  '#2563EB': '#5BA8F5',
  '#3B82F6': '#5BA8F5',
  '#1D4ED8': '#5BA8F5',
  '#1A1C23': '#5BA8F5',
  '#374151': '#5BA8F5',
  '#4B5563': '#5BA8F5',
  '#6B7280': '#5BA8F5',
  '#9CA3AF': '#5BA8F5',
  '#D1D5DB': '#5BA8F5',
  '#111827': '#5BA8F5',
  '#0F1115': '#5BA8F5',
  '#E5E7EB': '#5BA8F5'
}

/** 归一化并迁移历史实验色；对合法 #RRGGBB 返回大写规范值，保证幂等 */
export function resolveThemeColor(color: string | null | undefined): string {
  const raw = (color || '#5BA8F5').trim()
  const key = (raw.startsWith('#') ? raw : `#${raw}`).toUpperCase()
  const mapped = LEGACY_THEME_COLOR_MAP[key]
  if (mapped) return mapped
  if (/^#[0-9A-F]{6}$/.test(key) || /^#[0-9A-F]{3}$/.test(key)) return key
  return raw
}
