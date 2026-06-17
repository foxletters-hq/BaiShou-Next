/** 原生滑条触控区域高度（@react-native-community/slider） */
export const NATIVE_SLIDER_HEIGHT = 52

export interface NativeSliderThumbOptions {
  /** 拇指颜色 */
  thumbColor?: string
  /** 保留兼容；原生滑条仅使用 thumbColor */
  thumbKnobColor?: string
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
