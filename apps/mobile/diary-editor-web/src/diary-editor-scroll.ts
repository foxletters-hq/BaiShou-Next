import { EditorView } from '@codemirror/view'
import { isTableCellEditorFocused } from '@baishou/ui/shared/diary-codemirror/table/tableDom'
import type { DiaryCmSetScrollInsetsPayload } from '@baishou/ui/shared/diary-codemirror/types'

import { logEditor, postToNative } from './diary-editor-platform'
import {
  diaryEditorState,
  CARET_BOTTOM_BUFFER_PX,
  CARET_SCROLL_BOTTOM_BUFFER_PX,
  CARET_SCROLL_KEYBOARD_EXTRA_PX,
  CARET_SCROLL_TOP_BUFFER_PX,
  TOUCH_PAN_THRESHOLD_PX,
  USER_SCROLL_LOCK_MS
} from './diary-editor-state'

export function isCaretAtMountDefault(): boolean {
  if (!diaryEditorState.view) return true
  const docLen = diaryEditorState.view.state.doc.length
  if (docLen <= 1) return true
  return diaryEditorState.view.state.selection.main.head >= docLen - 1
}

/** 初次挂载且光标仍在文末默认位置时，才保持「钉在底部」 */
export function shouldPinScrollToBottomDuringMount(): boolean {
  return Date.now() < diaryEditorState.suppressCaretScrollUntil && isCaretAtMountDefault()
}

/** 用户主动把光标移到非文末时，结束初次挂载的底部钉住阶段 */
export function noteUserCaretPlacement(head: number, docLen: number): void {
  if (Date.now() >= diaryEditorState.suppressCaretScrollUntil) return
  if (docLen > 1 && head < docLen - 1) {
    diaryEditorState.suppressCaretScrollUntil = 0
    diaryEditorState.suppressCaretScrollOnce = false
  }
}

export function cancelCaretScrollAnimation(): void {
  if (diaryEditorState.caretScrollFrameId === null) return
  cancelAnimationFrame(diaryEditorState.caretScrollFrameId)
  diaryEditorState.caretScrollFrameId = null
}

export function resolveLineBlockMetrics(
  editorView: EditorView,
  pos: number
): { top: number; bottom: number } | null {
  try {
    const lineBlock = editorView.lineBlockAtPos(pos)
    return {
      top: lineBlock.top,
      bottom: lineBlock.top + lineBlock.height
    }
  } catch {
    const coords = editorView.coordsAtPos(pos, 1)
    if (coords) {
      const scrollTop = editorView.scrollDOM.scrollTop
      const scrollRect = editorView.scrollDOM.getBoundingClientRect()
      const top = coords.top - scrollRect.top + scrollTop
      const height = Math.max(coords.bottom - coords.top, 18)
      return { top, bottom: top + height }
    }

    const dom = editorView.domAtPos(pos)
    let node: Node | null = dom.node
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
    const line = node instanceof Element ? (node.closest('.cm-line') as HTMLElement | null) : null
    if (line) {
      const scrollTop = editorView.scrollDOM.scrollTop
      const scrollRect = editorView.scrollDOM.getBoundingClientRect()
      const rect = line.getBoundingClientRect()
      const top = rect.top - scrollRect.top + scrollTop
      return { top, bottom: top + Math.max(rect.height, 18) }
    }
    return null
  }
}

export function resolveCaretContentMetrics(
  editorView: EditorView,
  pos: number
): { top: number; bottom: number } | null {
  if (isTableCellEditorFocused()) {
    const input = document.activeElement as HTMLElement
    const contentTop = editorView.contentDOM.getBoundingClientRect().top
    const inputRect = input.getBoundingClientRect()
    return {
      top: Math.max(0, inputRect.top - contentTop),
      bottom: Math.max(0, inputRect.bottom - contentTop)
    }
  }

  return resolveLineBlockMetrics(editorView, pos)
}

function clearUserScrollLockForContentEdit(target: EventTarget | null): void {
  if (!(target instanceof Element)) return
  if (
    target.closest(
      '.cm-table-handle, .cm-table-add-btn, .cm-table-corner-menu, .cm-table-context-menu, .cm-table-context-menu-layer, .cm-table-sheet-layer'
    )
  ) {
    return
  }
  diaryEditorState.userScrollLockUntil = 0
}

export function resetTouchInteractionState(): void {
  diaryEditorState.touchInteractionDidPan = false
  diaryEditorState.touchInteractionStartX = null
  diaryEditorState.touchInteractionStartY = null
  diaryEditorState.touchInteractionStartAt = null
}

export function noteTouchInteractionStart(event: TouchEvent): void {
  const touch = event.touches[0]
  if (!touch) return
  diaryEditorState.touchInteractionDidPan = false
  diaryEditorState.touchInteractionStartX = touch.clientX
  diaryEditorState.touchInteractionStartY = touch.clientY
  diaryEditorState.touchInteractionStartAt = Date.now()
}

export function noteTouchInteractionMove(event: TouchEvent): void {
  if (diaryEditorState.touchInteractionDidPan) return
  if (
    diaryEditorState.touchInteractionStartX === null ||
    diaryEditorState.touchInteractionStartY === null
  )
    return
  const touch = event.touches[0]
  if (!touch) return
  const dx = touch.clientX - diaryEditorState.touchInteractionStartX
  const dy = touch.clientY - diaryEditorState.touchInteractionStartY
  if (Math.hypot(dx, dy) >= TOUCH_PAN_THRESHOLD_PX) {
    diaryEditorState.touchInteractionDidPan = true
  }
}

function shouldScheduleCaretScrollAfterPointer(target: EventTarget | null): boolean {
  if (diaryEditorState.touchInteractionDidPan) return false
  if (Date.now() < diaryEditorState.suppressCaretScrollFromClickUntil) return false
  if (target instanceof Element) {
    if (
      target.closest(
        '.cm-table-handle, .cm-table-add-btn, .cm-table-corner-menu, .cm-table-context-menu, .cm-table-context-menu-layer, .cm-table-sheet-layer'
      )
    ) {
      return false
    }
  }
  return true
}

export function handleTouchPointerEnd(target: EventTarget | null): void {
  const didPan = diaryEditorState.touchInteractionDidPan
  if (didPan) {
    diaryEditorState.suppressCaretScrollFromClickUntil = Date.now() + 350
  }
  resetTouchInteractionState()
  if (didPan) return
  if (!shouldScheduleCaretScrollAfterPointer(target)) return
  clearUserScrollLockForContentEdit(target)
}

function isUserScrollLocked(): boolean {
  return Date.now() < diaryEditorState.userScrollLockUntil
}

function lockUserScroll(): void {
  diaryEditorState.userScrollLockUntil = Date.now() + USER_SCROLL_LOCK_MS
}

function applyProgrammaticScrollTop(targetScrollTop: number): void {
  if (!diaryEditorState.view) return
  diaryEditorState.programmaticScroll = true
  diaryEditorState.view.scrollDOM.scrollTop = targetScrollTop
  requestAnimationFrame(() => {
    diaryEditorState.programmaticScroll = false
  })
}

function smoothApplyProgrammaticScrollTop(targetScrollTop: number, onDone?: () => void): void {
  if (!diaryEditorState.view) {
    onDone?.()
    return
  }
  const scrollDOM = diaryEditorState.view.scrollDOM
  const start = scrollDOM.scrollTop
  const change = targetScrollTop - start
  if (Math.abs(change) < 2) {
    onDone?.()
    return
  }

  cancelCaretScrollAnimation()
  const duration = Math.min(520, Math.max(260, Math.abs(change) * 0.55))
  const startTime = performance.now()
  diaryEditorState.programmaticScroll = true

  const step = (now: number) => {
    const progress = Math.min((now - startTime) / duration, 1)
    const ease = 1 - Math.pow(1 - progress, 4)
    scrollDOM.scrollTop = start + change * ease
    if (progress < 1) {
      diaryEditorState.caretScrollFrameId = requestAnimationFrame(step)
    } else {
      diaryEditorState.caretScrollFrameId = null
      diaryEditorState.programmaticScroll = false
      onDone?.()
    }
  }
  diaryEditorState.caretScrollFrameId = requestAnimationFrame(step)
}

export function scrollEditorToBottomInstant(): void {
  if (!diaryEditorState.view) return
  const scrollDOM = diaryEditorState.view.scrollDOM
  const maxTop = Math.max(0, scrollDOM.scrollHeight - scrollDOM.clientHeight)
  diaryEditorState.programmaticScroll = true
  scrollDOM.scrollTop = maxTop
  requestAnimationFrame(() => {
    diaryEditorState.programmaticScroll = false
  })
}

export function finalizeInitialEditorScroll(): void {
  scrollEditorToBottomInstant()
  requestAnimationFrame(() => {
    scrollEditorToBottomInstant()
  })
}

export function installUserScrollListener(editorView: EditorView): void {
  if (diaryEditorState.scrollListenerInstalled) return
  diaryEditorState.scrollListenerInstalled = true

  editorView.scrollDOM.addEventListener(
    'scroll',
    () => {
      if (diaryEditorState.programmaticScroll) return
      lockUserScroll()
    },
    { passive: true }
  )
}

function caretScrollSkipReason(force = false): string | null {
  if (!diaryEditorState.view) return 'no-view'
  if (diaryEditorState.activeScrollMode !== 'viewport')
    return `scrollMode=${diaryEditorState.activeScrollMode}`
  if (!force && Date.now() < diaryEditorState.suppressCaretScrollUntil) return 'initial-mount'
  if (!force && diaryEditorState.keyboardVisible) return 'keyboard-visible'
  if (isUserScrollLocked() && !force) return 'user-scroll-locked'
  if (isTableCellEditorFocused()) return 'table-cell-focused'
  return null
}

function computeCaretScrollTarget(force = false): number | null {
  const skip = caretScrollSkipReason(force)
  if (skip) {
    logEditor('caretScroll:skip', { reason: skip })
    return null
  }

  const editorView = diaryEditorState.view!
  const pos = editorView.state.selection.main.head
  const scrollDOM = editorView.scrollDOM

  const metrics = resolveLineBlockMetrics(editorView, pos)
  if (!metrics) {
    logEditor('caretScroll:skip', { reason: 'lineBlockAtPos-failed', pos })
    return null
  }
  const caretTop = metrics.top
  const caretBottom = metrics.bottom

  const chromeBottom =
    diaryEditorState.bottomScrollInsetPx +
    CARET_SCROLL_BOTTOM_BUFFER_PX +
    (diaryEditorState.keyboardVisible ? CARET_SCROLL_KEYBOARD_EXTRA_PX : 0)
  const visibleTop = scrollDOM.scrollTop + CARET_SCROLL_TOP_BUFFER_PX
  const visibleBottom = scrollDOM.scrollTop + scrollDOM.clientHeight - chromeBottom

  let targetScrollTop: number | null = null
  if (caretBottom > visibleBottom) {
    targetScrollTop = caretBottom - (scrollDOM.clientHeight - chromeBottom)
  } else if (caretTop < visibleTop) {
    // 光标仍在文档开头 (pos≈0) 时不要强行滚回顶部，避免点击表后时页面上跳
    if (pos <= 1 && scrollDOM.scrollTop > CARET_SCROLL_TOP_BUFFER_PX * 2) {
      logEditor('caretScroll:skip', { reason: 'avoid-scroll-to-top-at-doc-start', pos })
      return null
    }
    targetScrollTop = caretTop - CARET_SCROLL_TOP_BUFFER_PX
  }

  if (targetScrollTop === null) {
    return null
  }

  const maxTop = Math.max(0, scrollDOM.scrollHeight - scrollDOM.clientHeight)
  const clamped = Math.max(0, Math.min(targetScrollTop, maxTop))
  logEditor('caretScroll:target', {
    pos,
    from: scrollDOM.scrollTop,
    to: clamped,
    caretTop,
    caretBottom,
    chromeBottom
  })
  return clamped
}

function scheduleSmoothCaretScroll(onDone?: () => void): void {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => ensureCaretVisible(onDone))
  })
}

function ensureCaretVisible(onDone?: () => void, force = false): void {
  const targetScrollTop = computeCaretScrollTarget(force)
  if (targetScrollTop === null) {
    onDone?.()
    return
  }
  if (!diaryEditorState.view) {
    onDone?.()
    return
  }
  if (Date.now() < diaryEditorState.suppressCaretScrollUntil) {
    applyProgrammaticScrollTop(targetScrollTop)
    onDone?.()
    return
  }
  smoothApplyProgrammaticScrollTop(targetScrollTop, onDone)
}

export function scheduleForcedCaretScroll(): void {
  if (Date.now() < diaryEditorState.suppressCaretScrollUntil) {
    diaryEditorState.userScrollLockUntil = 0
    ensureCaretVisible(undefined, true)
    return
  }
  diaryEditorState.userScrollLockUntil = 0
  ensureCaretVisible(undefined, true)
  window.setTimeout(() => ensureCaretVisible(undefined, true), 100)
  window.setTimeout(() => ensureCaretVisible(undefined, true), 280)
}

export function scheduleEnsureCaretVisible(onDone?: () => void): void {
  if (shouldPinScrollToBottomDuringMount()) {
    scrollEditorToBottomInstant()
    onDone?.()
    return
  }
  scheduleSmoothCaretScroll(onDone)
}

export function applyBottomScrollInset(bottom: number): void {
  diaryEditorState.bottomScrollInsetPx = Math.max(0, bottom)
  if (!diaryEditorState.view) return
  diaryEditorState.view.scrollDOM.style.setProperty(
    '--diary-bottom-scroll-inset',
    `${diaryEditorState.bottomScrollInsetPx}px`
  )
}

export function setScrollInsets(payload: DiaryCmSetScrollInsetsPayload): void {
  logEditor('setScrollInsets', {
    bottom: payload.bottom,
    keyboardVisible: payload.keyboardVisible,
    prev: diaryEditorState.bottomScrollInsetPx
  })
  if (payload.keyboardVisible !== undefined) {
    diaryEditorState.keyboardVisible = payload.keyboardVisible
  }
  applyBottomScrollInset(payload.bottom)
}

export function reportContentMetrics(): void {
  if (!diaryEditorState.view) return
  if (diaryEditorState.touchInteractionStartAt != null) return

  const contentRect = diaryEditorState.view.contentDOM.getBoundingClientRect()
  const contentTop = contentRect.top

  if (isTableCellEditorFocused()) {
    const input = document.activeElement as HTMLElement
    const inputRect = input.getBoundingClientRect()
    const caretTop = Math.max(0, inputRect.top - contentTop)
    const caretBottom = Math.max(0, inputRect.bottom - contentTop)
    postToNative({
      type: 'caretViewport',
      payload: { top: caretTop, bottom: caretBottom }
    })
    const neededHeight = Math.ceil(
      Math.max(contentRect.height, caretBottom + CARET_BOTTOM_BUFFER_PX, 120)
    )
    postToNative({ type: 'contentHeight', payload: { height: neededHeight } })
    return
  }

  const pos = diaryEditorState.view.state.selection.main.head
  const caretMetrics = resolveCaretContentMetrics(diaryEditorState.view, pos)

  let caretTop = contentRect.height
  let caretBottom = contentRect.height
  if (caretMetrics) {
    caretTop = caretMetrics.top
    caretBottom = caretMetrics.bottom
    postToNative({
      type: 'caretViewport',
      payload: { top: Math.max(0, caretTop), bottom: Math.max(0, caretBottom) }
    })
  }

  const neededHeight = Math.ceil(
    Math.max(contentRect.height, caretBottom + CARET_BOTTOM_BUFFER_PX, 120)
  )
  postToNative({ type: 'contentHeight', payload: { height: neededHeight } })
}

export function forceCaretVisible(): void {
  diaryEditorState.userScrollLockUntil = 0
  ensureCaretVisible(undefined, true)
}
