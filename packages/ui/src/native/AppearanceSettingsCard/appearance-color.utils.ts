export function hslToHex(h: number, s: number, l: number) {
  l /= 100
  const a = (s * Math.min(l, 1 - l)) / 100
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/** 色相条分段色（与 ColorPicker 一致） */
export const HUE_BAR_COLORS = [
  '#FF0000',
  '#FF9900',
  '#FFFF00',
  '#99FF00',
  '#00FF00',
  '#00FF99',
  '#00FFFF',
  '#0099FF',
  '#0000FF',
  '#9900FF',
  '#FF00FF',
  '#FF0099'
] as const

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const normalized = hex.replace('#', '').trim()
  if (normalized.length !== 6) {
    return { h: 190, s: 60, l: 75 }
  }
  const r = parseInt(normalized.slice(0, 2), 16) / 255
  const g = parseInt(normalized.slice(2, 4), 16) / 255
  const b = parseInt(normalized.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = ((max + min) / 2) * 100
  if (max === min) {
    return { h: 0, s: 0, l: Math.round(l) }
  }
  const d = max - min
  const s = l > 50 ? (d / (2 - max - min)) * 100 : (d / (max + min)) * 100
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60
  else if (max === g) h = ((b - r) / d + 2) * 60
  else h = ((r - g) / d + 4) * 60
  return {
    h: Math.round(h),
    s: Math.round(s),
    l: Math.round(Math.min(90, Math.max(20, l)))
  }
}
