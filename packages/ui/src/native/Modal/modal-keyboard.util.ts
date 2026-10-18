/** 等本次点击结束后再允许点遮罩关闭，避免弹窗刚出现就被同一指关掉。 */
export const MODAL_BACKDROP_ARM_MS = 80

/** 键盘关闭时不垫底；打开时在键盘上方再留一截间距。 */
export function modalKeyboardPadding(keyboardHeight: number, extraSpacing: number): number {
  if (keyboardHeight <= 0) return 0
  return keyboardHeight + extraSpacing
}

/**
 * 居中弹窗的卡片高度上限：默认屏高 72%，键盘弹出后改成落在剩余可视区内。
 */
export function modalCardMaxHeight(
  screenHeight: number,
  keyboardPadding: number,
  contentMaxHeight?: number
): number {
  const fallback = Math.round(screenHeight * 0.72)
  const resolved = contentMaxHeight ?? fallback
  const available = Math.max(0, screenHeight - keyboardPadding)
  return Math.min(resolved, available)
}
