/** zustand persist 键：主题 / 字号档等 UI 偏好 */
export const UI_SETTINGS_STORAGE_KEY = 'baishou-ui-settings-storage'

/** UI 显示缩放档位（常规设置「字体大小」滑条 → 桌面整页 zoom） */

export const UI_FONT_SIZE_LEVEL_MIN = 0
export const UI_FONT_SIZE_LEVEL_MAX = 5
/** 默认档：第二格「默认」 */
export const UI_FONT_SIZE_LEVEL_DEFAULT = 1

/**
 * 桌面整页缩放系数（webFrame.setZoomFactor）。
 * 默认档 0.9，对齐历史 Ctrl+/- 默认密度。
 */
export const UI_PAGE_ZOOM_FACTORS = [0.75, 0.9, 1.0, 1.1, 1.2, 1.35] as const

/** 相对默认档的比例（移动端正文缩放 / 滑条标签预览） */
export const UI_FONT_SIZE_SCALES = UI_PAGE_ZOOM_FACTORS.map(
  (zoom) => zoom / UI_PAGE_ZOOM_FACTORS[UI_FONT_SIZE_LEVEL_DEFAULT]
) as unknown as readonly [number, number, number, number, number, number]

export type UiFontSizeLevel =
  | typeof UI_FONT_SIZE_LEVEL_MIN
  | 1
  | 2
  | 3
  | 4
  | typeof UI_FONT_SIZE_LEVEL_MAX

export function normalizeUiFontSizeLevel(value: unknown): UiFontSizeLevel {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return UI_FONT_SIZE_LEVEL_DEFAULT
  const rounded = Math.round(n)
  if (rounded < UI_FONT_SIZE_LEVEL_MIN) return UI_FONT_SIZE_LEVEL_MIN
  if (rounded > UI_FONT_SIZE_LEVEL_MAX) return UI_FONT_SIZE_LEVEL_MAX
  return rounded as UiFontSizeLevel
}

export function uiFontSizeScaleFromLevel(level: unknown): number {
  const normalized = normalizeUiFontSizeLevel(level)
  return UI_FONT_SIZE_SCALES[normalized] ?? 1
}

/** 桌面整页 zoom 系数 */
export function uiPageZoomFromLevel(level: unknown): number {
  const normalized = normalizeUiFontSizeLevel(level)
  return UI_PAGE_ZOOM_FACTORS[normalized] ?? UI_PAGE_ZOOM_FACTORS[UI_FONT_SIZE_LEVEL_DEFAULT]
}

/** 从 persist JSON 读出桌面整页 zoom；读不到返回 null */
export function uiPageZoomFromPersistedSettingsJson(raw: string | null | undefined): number | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { state?: { fontSizeLevel?: unknown } }
    if (parsed?.state?.fontSizeLevel === undefined) return null
    return uiPageZoomFromLevel(parsed.state.fontSizeLevel)
  } catch {
    return null
  }
}

export type PageZoomShortcut = 'in' | 'out' | 'reset'

/** 识别 Ctrl/Cmd + / - / 0，兼容 Minus、小键盘 */
export function resolvePageZoomShortcut(input: {
  key?: string
  code?: string
}): PageZoomShortcut | null {
  const key = input.key ?? ''
  const code = input.code ?? ''
  if (key === '0' || code === 'Digit0' || code === 'Numpad0') return 'reset'
  if (key === '=' || key === '+' || code === 'Equal' || code === 'NumpadAdd') return 'in'
  if (
    key === '-' ||
    key === '_' ||
    key === 'Minus' ||
    code === 'Minus' ||
    code === 'NumpadSubtract'
  ) {
    return 'out'
  }
  return null
}

export function nextUiFontSizeLevel(current: unknown, action: PageZoomShortcut): UiFontSizeLevel {
  if (action === 'reset') return UI_FONT_SIZE_LEVEL_DEFAULT
  const level = normalizeUiFontSizeLevel(current)
  if (action === 'in') return normalizeUiFontSizeLevel(level + 1)
  return normalizeUiFontSizeLevel(level - 1)
}

/** 将任意 zoom 系数映射到最近档位（迁移旧 localStorage 缩放） */
export function uiFontSizeLevelFromZoom(zoom: unknown): UiFontSizeLevel {
  const n = typeof zoom === 'number' ? zoom : Number(zoom)
  if (!Number.isFinite(n)) return UI_FONT_SIZE_LEVEL_DEFAULT
  let best: UiFontSizeLevel = UI_FONT_SIZE_LEVEL_DEFAULT
  let bestDist = Number.POSITIVE_INFINITY
  for (let i = UI_FONT_SIZE_LEVEL_MIN; i <= UI_FONT_SIZE_LEVEL_MAX; i++) {
    const dist = Math.abs(UI_PAGE_ZOOM_FACTORS[i]! - n)
    if (dist < bestDist) {
      bestDist = dist
      best = i as UiFontSizeLevel
    }
  }
  return best
}
