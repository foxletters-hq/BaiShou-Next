import { useLayoutEffect, useState } from 'react'

/** 与 InputBar.module.css 中 .textarea 的 line-height / padding 保持一致 */
const TEXTAREA_LINE_HEIGHT = 22
const TEXTAREA_VERTICAL_PADDING = 10
const TEXTAREA_MAX_LINES = 8
/** 单行布局时左右按钮+间隙大约占用的宽度（仅 + / 发送） */
export const INPUT_BAR_SIDE_CONTROLS_RESERVE_PX = 88
/** 单行布局且带有 bottomTrailing（如模型切换）时预留更宽 */
export const INPUT_BAR_SIDE_CONTROLS_WITH_TRAILING_RESERVE_PX = 128

export const INPUT_BAR_TEXTAREA_MAX_HEIGHT =
  TEXTAREA_LINE_HEIGHT * TEXTAREA_MAX_LINES + TEXTAREA_VERTICAL_PADDING

export function getInputBarTextareaMinHeight(minRows = 1): number {
  const rows = Math.max(1, Math.min(minRows, TEXTAREA_MAX_LINES))
  return TEXTAREA_LINE_HEIGHT * rows + TEXTAREA_VERTICAL_PADDING
}

export type UseInputBarExpandOptions = {
  /** 单行布局下左右控件预估宽度，用于探针判断是否会软换行 */
  sideControlsReservePx?: number
}

/**
 * 判定是否进入多行布局（输入在上、按钮在下），与伙伴页一致：
 * - 含硬换行；或
 * - 按「单行可用宽度」测量时内容已软换行
 *
 * 实际增高由 InputBarSkillEditor 负责，此处只做布局切换判定。
 */
export function useInputBarExpand(
  editorRef: React.RefObject<HTMLElement | null>,
  text: string,
  minRows = 1,
  options?: UseInputBarExpandOptions
): boolean {
  const minHeight = getInputBarTextareaMinHeight(minRows)
  const sideReserve = options?.sideControlsReservePx ?? INPUT_BAR_SIDE_CONTROLS_RESERVE_PX
  const [isMultiline, setIsMultiline] = useState(false)

  useLayoutEffect(() => {
    const el = editorRef.current
    if (!el) return

    if (text.includes('\n')) {
      setIsMultiline(true)
      return
    }

    // 用「单行布局可用宽度」探针：stacked 后编辑器变宽，直接量当前高度会误判回单行
    const parentW = el.parentElement?.clientWidth || el.clientWidth
    const narrowW = Math.max(80, parentW - (isMultiline ? sideReserve : 0))
    const prevMaxWidth = el.style.maxWidth
    const prevHeight = el.style.height
    el.style.maxWidth = `${narrowW}px`
    el.style.height = 'auto'
    const narrowHeight = el.scrollHeight
    el.style.maxWidth = prevMaxWidth
    el.style.height = prevHeight

    setIsMultiline(narrowHeight > minHeight + 1)
  }, [text, editorRef, minHeight, isMultiline, sideReserve])

  return isMultiline
}
