export const TOOLBAR_ANIM_MS = 200
/** 展开/收起输入框高度动画，与工具栏开合节奏一致 */
export const EXPAND_ANIM_MS = 200
export const INPUT_MIN_HEIGHT = 36
/** 点击展开后立刻抬高到的高度（不必等内容或键盘） */
export const INPUT_EXPANDED_DEFAULT_HEIGHT = 120
/** 折叠态输入区最大高度（约 4–5 行） */
export const INPUT_MAX_HEIGHT_COLLAPSED = 112
/** 展开态相对屏幕高度的比例上限 */
export const INPUT_MAX_HEIGHT_EXPANDED_RATIO = 0.42
/** 展开态最大高度硬顶 */
export const INPUT_MAX_HEIGHT_EXPANDED_CAP = 320
/** 卡片内底栏（菜单 + 发送） */
export const INPUT_CARD_BOTTOM_ROW = 36

export function clampInputFrameHeight(contentHeight: number, maxHeight: number) {
  return Math.min(Math.max(Math.ceil(contentHeight), INPUT_MIN_HEIGHT), maxHeight)
}

export function resolveComposerHeight(
  contentHeight: number,
  expanded: boolean,
  maxHeight: number
): number {
  const contentBased = clampInputFrameHeight(contentHeight, maxHeight)
  if (!expanded) return contentBased
  return Math.min(Math.max(contentBased, INPUT_EXPANDED_DEFAULT_HEIGHT), maxHeight)
}

export function resolveExpandedInputMaxHeight(windowHeight: number): number {
  return Math.min(
    INPUT_MAX_HEIGHT_EXPANDED_CAP,
    Math.round(windowHeight * INPUT_MAX_HEIGHT_EXPANDED_RATIO)
  )
}
