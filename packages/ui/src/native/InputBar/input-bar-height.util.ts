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
/** 与输入框样式里的 lineHeight 一致 */
export const COMPOSER_LINE_HEIGHT = 20
/** 中文在 15px 字号下的近似字宽，用来估算换行 */
export const COMPOSER_TEXT_CHAR_WIDTH = 15

/**
 * 输入框可用宽度：外层左右 14、卡片左右 10、文字左右 4，再减去展开按钮。
 */
export function composerContentWidth(windowWidth: number): number {
  const inset = 14 * 2 + 10 * 2 + 4 * 2 + 30
  return Math.max(COMPOSER_TEXT_CHAR_WIDTH, windowWidth - inset)
}

/**
 * 按换行和可用宽度估算正文高度。
 * 程序写入 Skill 正文时，系统常常不回报内容高度，输入框会停在一行。
 */
export function estimateComposerContentHeight(
  text: string,
  contentWidth: number,
  verticalPadding = 12
): number {
  const charsPerLine = Math.max(
    1,
    Math.floor(Math.max(contentWidth, COMPOSER_TEXT_CHAR_WIDTH) / COMPOSER_TEXT_CHAR_WIDTH)
  )
  const paragraphs = text.length === 0 ? [''] : text.split('\n')
  let lines = 0
  for (const paragraph of paragraphs) {
    const length = Array.from(paragraph).length
    lines += Math.max(1, Math.ceil(length / charsPerLine))
  }
  return lines * COMPOSER_LINE_HEIGHT + verticalPadding
}

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
