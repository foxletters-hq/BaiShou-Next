/** 滑条触控区域高度，保留 44 以保证可点，视觉比旧的 52 更扁 */
export const NATIVE_SLIDER_HEIGHT = 44
/** 圆拇指直径，比旧的 20 略小，仍大于桌面 14px */
export const NATIVE_SLIDER_THUMB_SIZE = 16
/** 轨道高度，比旧的 6 略细，仍比桌面 3px 更易看见 */
export const NATIVE_SLIDER_TRACK_HEIGHT = 4
/** 轨道左右内边距，须与拇指半径对齐，避免两端点按不到极值 */
export const SLIDER_TRACK_HORIZONTAL_PADDING = NATIVE_SLIDER_THUMB_SIZE / 2

export interface NativeSliderThumbOptions {
  /** 拇指颜色 */
  thumbColor?: string
  /** 保留兼容；原生滑条仅使用 thumbColor */
  thumbKnobColor?: string
}

/**
 * 用屏幕 pageX 换算滑条值。拖动时手指竖直离开轨道后 locationX 会变成 0，
 * 不能用它算进度，否则会弹到最小值。
 */
export function nativeValueFromPageX(input: {
  pageX: number
  trackPageX: number
  trackWidth: number
  minimumValue: number
  maximumValue: number
  step: number
  horizontalPadding?: number
}): number {
  const padding = input.horizontalPadding ?? SLIDER_TRACK_HORIZONTAL_PADDING
  const usableWidth = Math.max(1, input.trackWidth - padding * 2)
  const x = input.pageX - input.trackPageX - padding
  const ratio = Math.min(1, Math.max(0, x / usableWidth))
  const raw = input.minimumValue + (input.maximumValue - input.minimumValue) * ratio
  return snapSliderValue(raw, input.minimumValue, input.maximumValue, input.step)
}

export function snapSliderValue(raw: number, min: number, max: number, step: number): number {
  if (step <= 0) {
    return Math.min(max, Math.max(min, raw))
  }
  const steps = Math.round((raw - min) / step)
  const snapped = min + steps * step
  const clamped = Math.min(max, Math.max(min, snapped))
  const decimals = String(step).includes('.') ? (String(step).split('.')[1]?.length ?? 0) : 0
  return Number(clamped.toFixed(decimals))
}

/**
 * Android 上 @react-native-community/slider 使用小数 step（如 0.01）时，
 * 部分机型（如 vivo）会在首次挂载时原生 StackOverflow 崩溃。
 * 将逻辑区间按步长倒数放大为整数步进，再传给原生滑条。
 */
export function getAndroidSliderIntegerScale(step: number): number {
  if (step >= 1 || step <= 0) return 1
  const inverse = 1 / step
  if (Number.isInteger(inverse)) return inverse
  const decimals = String(step).split('.')[1]?.length ?? 0
  return Math.pow(10, decimals)
}

export function toNativeSliderProps(
  value: number,
  minValue: number,
  maxValue: number,
  step: number,
  platformScale: number
): {
  value: number
  minimumValue: number
  maximumValue: number
  step: number
  logicalFromNative: (nativeValue: number) => number
} {
  const scale = platformScale > 1 ? platformScale : 1
  const safeLogical = snapSliderValue(value, minValue, maxValue, step)
  if (scale === 1) {
    return {
      value: safeLogical,
      minimumValue: minValue,
      maximumValue: maxValue,
      step,
      logicalFromNative: (nativeValue) => snapSliderValue(nativeValue, minValue, maxValue, step)
    }
  }
  return {
    value: safeLogical * scale,
    minimumValue: minValue * scale,
    maximumValue: maxValue * scale,
    step: 1,
    logicalFromNative: (nativeValue) =>
      snapSliderValue(nativeValue / scale, minValue, maxValue, step)
  }
}
