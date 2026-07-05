const REANIMATED_COLOR_PATTERN =
  /^(#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|rgba?\(|hsla?\(|hwb\(|[a-zA-Z]+)$/

/** Reanimated 4.3+ 动画可用的颜色；无法识别时回退到默认值 */
export function toReanimatedColor(value: string | null | undefined, fallback: string): string {
  const candidate = value?.trim()
  if (!candidate || candidate === 'invalid') {
    return fallback
  }
  if (REANIMATED_COLOR_PATTERN.test(candidate)) {
    return candidate
  }
  return fallback
}
