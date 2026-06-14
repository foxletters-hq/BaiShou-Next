/** 原生滑条触控区域高度（@react-native-community/slider） */
export const NATIVE_SLIDER_HEIGHT = 52

export interface NativeSliderThumbOptions {
  /** 拇指颜色 */
  thumbColor?: string
  /** 保留兼容；原生滑条仅使用 thumbColor */
  thumbKnobColor?: string
}

export function snapSliderValue(
  raw: number,
  min: number,
  max: number,
  step: number
): number {
  if (step <= 0) {
    return Math.min(max, Math.max(min, raw))
  }
  const steps = Math.round((raw - min) / step)
  const snapped = min + steps * step
  const clamped = Math.min(max, Math.max(min, snapped))
  const decimals = String(step).includes('.') ? String(step).split('.')[1]?.length ?? 0 : 0
  return Number(clamped.toFixed(decimals))
}
