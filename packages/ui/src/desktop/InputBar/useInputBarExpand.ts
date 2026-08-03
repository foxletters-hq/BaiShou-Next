import { useEffect } from 'react'

/** 与 InputBar.module.css 中 .textarea 的 line-height / padding 保持一致 */
const TEXTAREA_LINE_HEIGHT = 22
const TEXTAREA_VERTICAL_PADDING = 14
const TEXTAREA_MAX_LINES = 8
export const INPUT_BAR_TEXTAREA_MAX_HEIGHT =
  TEXTAREA_LINE_HEIGHT * TEXTAREA_MAX_LINES + TEXTAREA_VERTICAL_PADDING

export function getInputBarTextareaMinHeight(minRows = 1): number {
  const rows = Math.max(1, Math.min(minRows, TEXTAREA_MAX_LINES))
  return TEXTAREA_LINE_HEIGHT * rows + TEXTAREA_VERTICAL_PADDING
}

/**
 * 输入时自动增高 textarea，最多显示 8 行，超出后内部滚动。
 */
export function useInputBarExpand(
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  text: string,
  minRows = 1
) {
  const minHeight = getInputBarTextareaMinHeight(minRows)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(minHeight, Math.min(el.scrollHeight, INPUT_BAR_TEXTAREA_MAX_HEIGHT))}px`
  }, [text, textareaRef, minHeight])
}
