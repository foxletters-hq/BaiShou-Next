import { Compartment, EditorState, type Annotation, type Transaction } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { redo, undo } from '@codemirror/commands'
import {
  createDiaryCodeMirror,
  forceImageRefresh,
  toggleMarkdownMark,
  type DiaryCmPlatform
} from '@baishou/ui/shared/diary-codemirror'
import {
  refreshDiaryTagColorRegistryEffect,
  setActiveDiaryTagColorRegistry
} from '@baishou/ui/shared/diary-codemirror/extensions/diaryTagLinePlugin'
import { resolveTableConfirmResponse } from '@baishou/ui/shared/diary-codemirror/table/tableConfirm'
import { resolveNativeTableSheetResponse } from '@baishou/ui/shared/diary-codemirror/table/tableNativeSheet'
import { dismissKeyboardForSheetInteraction, isTableSheetOpen } from '@baishou/ui/shared/diary-codemirror/table/tableSheetInteraction'
import { logDiaryBridge } from '@baishou/ui/shared/diary-codemirror/diaryBridgeDebug'
import type { DiaryCmTheme } from '@baishou/ui/shared/diary-codemirror/types'

import type { InitPayload, RnToWebViewMessage, WebViewToRnMessage } from './types'

declare const __DIARY_EDITOR_BUILD_ID__: string | undefined

/** 表格/滚动大改时递增，用于 Metro 日志核对 bundle 版本 */
const DIARY_CM_FEATURE_TAG = 'table-cell-source-v2'

let view: EditorView | null = null
let suppressChangeEcho = false
let contentHeightObserver: ResizeObserver | null = null
let activeScrollMode: 'viewport' | 'document' = 'document'
let bottomScrollInsetPx = 0
let caretScrollFrameId: number | null = null
let suppressCaretScrollOnce = false
/** 用户手动滚动后，暂停自动把视图拽回光标 */
let userScrollLockUntil = 0
let programmaticScroll = false
let scrollListenerInstalled = false
/** 当前触摸是否已识别为滑动手势 */
let touchInteractionDidPan = false
let touchInteractionStartX: number | null = null
let touchInteractionStartY: number | null = null
/** touchend 后短时间内抑制 click 触发的二次滚回 */
let suppressCaretScrollFromClickUntil = 0

/** 用户手动滚动后，暂停自动拽回光标的时长 */
const USER_SCROLL_LOCK_MS = 3000
/** 判定为滑动手势的最小位移（px） */
const TOUCH_PAN_THRESHOLD_PX = 10

/** 光标与底部遮挡区之间的额外留白 */
const CARET_SCROLL_BOTTOM_BUFFER_PX = 12
/** 光标与顶部可视区之间的留白，点击上方正文时平滑上滚 */
const CARET_SCROLL_TOP_BUFFER_PX = 48

const editableCompartment = new Compartment()

/** 底部留白，避免光标 / 最后一行被 WebView 裁切 */
const CARET_BOTTOM_BUFFER_PX = 96

const urlCache = new Map<string, string>()
const pendingUrlRequests = new Map<string, string>()

const DEFAULT_THEME: DiaryCmTheme = {
  isDark: false,
  textPrimary: '#111827',
  textSecondary: '#6b7280',
  bgEditor: '#ffffff',
  borderColor: '#e5e7eb',
  primary: '#5ba8f5',
  tagColors: ['#60A5FA', '#34D399', '#F59E0B', '#A78BFA']
}

function postToNative(message: WebViewToRnMessage): void {
  window.ReactNativeWebView?.postMessage(JSON.stringify(message))
}

function logEditor(tag: string, detail?: Record<string, unknown>): void {
  logDiaryBridge('diaryCm', tag, detail)
}

function requestAttachmentUrl(srcRaw: string): string {
  const cached = urlCache.get(srcRaw)
  if (cached) return cached

  const existingRequestId = [...pendingUrlRequests.entries()].find(([, src]) => src === srcRaw)?.[0]
  if (!existingRequestId) {
    const requestId = `url-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    pendingUrlRequests.set(requestId, srcRaw)
    postToNative({ type: 'resolveUrlRequest', payload: { requestId, srcRaw } })
  }

  return srcRaw
}

function buildPlatform(init: InitPayload): DiaryCmPlatform {
  return {
    resolveAttachmentUrl(srcRaw: string) {
      if (!srcRaw.startsWith('attachment/')) return srcRaw
      return requestAttachmentUrl(srcRaw)
    },
    onImageAction(action, payload) {
      postToNative({
        type: 'imageAction',
        payload: {
          action,
          from: payload.from,
          to: payload.to,
          srcRaw: payload.srcRaw
        }
      })
    },
    onExternalImagePreview(resolvedSrc) {
      postToNative({
        type: 'imagePreview',
        payload: { srcRaw: resolvedSrc, resolvedUrl: resolvedSrc }
      })
    },
    onImageTap({ to }) {
      if (!view) return
      let pos = to
      const doc = view.state.doc
      if (pos < doc.length && doc.sliceString(pos, pos + 1) === '\n') pos += 1
      view.dispatch({ selection: { anchor: pos, head: pos } })
      view.focus()
      window.requestAnimationFrame(() => reportContentMetrics())
    },
    interactionMode: init.interactionMode,
    tagLineMode: init.tagLineMode,
    scrollMode: init.scrollMode ?? 'document'
  }
}

function applyTheme(theme: DiaryCmTheme): void {
  const root = document.documentElement
  root.dataset.theme = theme.isDark ? 'dark' : 'light'
  root.style.setProperty('--text-primary', theme.textPrimary)
  root.style.setProperty('--text-secondary', theme.textSecondary)
  root.style.setProperty('--text-tertiary', theme.textSecondary)
  root.style.setProperty('--bg-editor', theme.bgEditor)
  root.style.setProperty('--bg-surface', theme.bgEditor)
  root.style.setProperty('--bg-surface-normal', theme.bgEditor)
  root.style.setProperty('--border-subtle', theme.borderColor)
  root.style.setProperty('--color-danger', theme.isDark ? '#f87171' : '#e5484d')
  root.style.setProperty('--color-primary', theme.primary)
  root.style.setProperty(
    '--color-primary-light',
    `color-mix(in srgb, ${theme.primary} 35%, transparent)`
  )
  theme.tagColors.forEach((fg, index) => {
    root.style.setProperty(`--tag-${index}-fg`, fg)
  })
  document.body.style.backgroundColor = theme.bgEditor
  document.body.style.color = theme.textPrimary
}

function cancelCaretScrollAnimation(): void {
  if (caretScrollFrameId === null) return
  cancelAnimationFrame(caretScrollFrameId)
  caretScrollFrameId = null
}

import { isTableCellEditorFocused } from '@baishou/ui/shared/diary-codemirror/table/tableDom'

function resolveLineBlockMetrics(
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
    const line =
      node instanceof Element ? (node.closest('.cm-line') as HTMLElement | null) : null
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

function resolveCaretContentMetrics(
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
  userScrollLockUntil = 0
}

function resetTouchInteractionState(): void {
  touchInteractionDidPan = false
  touchInteractionStartX = null
  touchInteractionStartY = null
}

function noteTouchInteractionStart(event: TouchEvent): void {
  const touch = event.touches[0]
  if (!touch) return
  touchInteractionDidPan = false
  touchInteractionStartX = touch.clientX
  touchInteractionStartY = touch.clientY
}

function noteTouchInteractionMove(event: TouchEvent): void {
  if (touchInteractionDidPan) return
  if (touchInteractionStartX === null || touchInteractionStartY === null) return
  const touch = event.touches[0]
  if (!touch) return
  const dx = touch.clientX - touchInteractionStartX
  const dy = touch.clientY - touchInteractionStartY
  if (Math.hypot(dx, dy) >= TOUCH_PAN_THRESHOLD_PX) {
    touchInteractionDidPan = true
  }
}

function shouldScheduleCaretScrollAfterPointer(target: EventTarget | null): boolean {
  if (touchInteractionDidPan) return false
  if (Date.now() < suppressCaretScrollFromClickUntil) return false
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

function handleTouchPointerEnd(target: EventTarget | null): void {
  const didPan = touchInteractionDidPan
  if (didPan) {
    suppressCaretScrollFromClickUntil = Date.now() + 350
  }
  resetTouchInteractionState()
  if (didPan) return
  if (!shouldScheduleCaretScrollAfterPointer(target)) return
  clearUserScrollLockForContentEdit(target)
}

function isUserScrollLocked(): boolean {
  return Date.now() < userScrollLockUntil
}

function lockUserScroll(): void {
  userScrollLockUntil = Date.now() + USER_SCROLL_LOCK_MS
}

function applyProgrammaticScrollTop(targetScrollTop: number): void {
  if (!view) return
  programmaticScroll = true
  view.scrollDOM.scrollTop = targetScrollTop
  requestAnimationFrame(() => {
    programmaticScroll = false
  })
}

function smoothApplyProgrammaticScrollTop(targetScrollTop: number, onDone?: () => void): void {
  if (!view) {
    onDone?.()
    return
  }
  const scrollDOM = view.scrollDOM
  const start = scrollDOM.scrollTop
  const change = targetScrollTop - start
  if (Math.abs(change) < 2) {
    onDone?.()
    return
  }

  cancelCaretScrollAnimation()
  const duration = Math.min(520, Math.max(260, Math.abs(change) * 0.55))
  const startTime = performance.now()
  programmaticScroll = true

  const step = (now: number) => {
    const progress = Math.min((now - startTime) / duration, 1)
    const ease = 1 - Math.pow(1 - progress, 4)
    scrollDOM.scrollTop = start + change * ease
    if (progress < 1) {
      caretScrollFrameId = requestAnimationFrame(step)
    } else {
      caretScrollFrameId = null
      programmaticScroll = false
      onDone?.()
    }
  }
  caretScrollFrameId = requestAnimationFrame(step)
}

function installUserScrollListener(editorView: EditorView): void {
  if (scrollListenerInstalled) return
  scrollListenerInstalled = true

  editorView.scrollDOM.addEventListener(
    'scroll',
    () => {
      if (programmaticScroll) return
      lockUserScroll()
    },
    { passive: true }
  )
}

function shouldAutoScrollCaret(): boolean {
  if (!view || activeScrollMode !== 'viewport') return false
  if (isUserScrollLocked()) return false
  if (isTableCellEditorFocused()) return false
  return true
}

function caretScrollSkipReason(): string | null {
  if (!view) return 'no-view'
  if (activeScrollMode !== 'viewport') return `scrollMode=${activeScrollMode}`
  if (isUserScrollLocked()) return 'user-scroll-locked'
  if (isTableCellEditorFocused()) return 'table-cell-focused'
  return null
}

function computeCaretScrollTarget(): number | null {
  const skip = caretScrollSkipReason()
  if (skip) {
    logEditor('caretScroll:skip', { reason: skip })
    return null
  }

  const editorView = view!
  const pos = editorView.state.selection.main.head
  const scrollDOM = editorView.scrollDOM

  const metrics = resolveLineBlockMetrics(editorView, pos)
  if (!metrics) {
    logEditor('caretScroll:skip', { reason: 'lineBlockAtPos-failed', pos })
    return null
  }
  const caretTop = metrics.top
  const caretBottom = metrics.bottom

  const chromeBottom = bottomScrollInsetPx + CARET_SCROLL_BOTTOM_BUFFER_PX
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

function ensureCaretVisible(onDone?: () => void): void {
  const targetScrollTop = computeCaretScrollTarget()
  if (targetScrollTop === null) {
    onDone?.()
    return
  }
  smoothApplyProgrammaticScrollTop(targetScrollTop, onDone)
}

function scheduleEnsureCaretVisible(onDone?: () => void): void {
  scheduleSmoothCaretScroll(onDone)
}

function applyBottomScrollInset(bottom: number): void {
  bottomScrollInsetPx = Math.max(0, bottom)
  if (!view) return
  view.scrollDOM.style.setProperty('--diary-bottom-scroll-inset', `${bottomScrollInsetPx}px`)
}

function setScrollInsets(bottom: number): void {
  logEditor('setScrollInsets', { bottom, prev: bottomScrollInsetPx })
  applyBottomScrollInset(bottom)
}

function reportContentMetrics(): void {
  if (!view) return

  const contentRect = view.contentDOM.getBoundingClientRect()
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

  const pos = view.state.selection.main.head
  const caretMetrics = resolveCaretContentMetrics(view, pos)

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

function applyTouchViewportLayout(editorView: EditorView): void {
  document.documentElement.style.height = '100%'
  document.documentElement.style.overflow = 'hidden'
  document.body.style.height = '100%'
  document.body.style.overflow = 'hidden'
  const root = document.getElementById('root')
  if (root) {
    root.style.height = '100%'
    root.style.minHeight = '100%'
  }
  editorView.dom.style.height = '100%'
}

function applyTouchNoInternalScroll(editorView: EditorView): void {
  const { scrollDOM, dom } = editorView
  scrollDOM.style.overflow = 'visible'
  scrollDOM.style.height = 'auto'
  scrollDOM.style.maxHeight = 'none'
  dom.style.height = 'auto'
  document.documentElement.style.overflow = 'hidden'
  document.body.style.overflow = 'hidden'
  document.body.style.height = 'auto'
}

let touchPanLastY: number | null = null
let touchPanRelayInstalled = false
let touchPanDisabled = false

function shouldDisableTouchPanRelay(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return !!target.closest(
    '.cm-table-handle, .cm-table-add-btn, .cm-table-corner-menu, .cm-table-context-menu, .cm-table-context-menu-layer, .cm-table-sheet-layer'
  )
}

function installTouchParentScrollRelay(): void {
  if (touchPanRelayInstalled) return
  touchPanRelayInstalled = true

  document.addEventListener(
    'touchstart',
    (e) => {
      touchPanDisabled = shouldDisableTouchPanRelay(e.target)
      if (touchPanDisabled || e.touches.length !== 1) {
        touchPanLastY = null
        return
      }
      touchPanLastY = e.touches[0]?.clientY ?? null
    },
    { passive: true, capture: true }
  )

  document.addEventListener(
    'touchmove',
    (e) => {
      if (touchPanDisabled || touchPanLastY === null || e.touches.length !== 1) return
      const y = e.touches[0]?.clientY ?? touchPanLastY
      const deltaY = touchPanLastY - y
      touchPanLastY = y
      if (Math.abs(deltaY) < 1) return
      e.preventDefault()
      postToNative({ type: 'panScroll', payload: { deltaY } })
    },
    { passive: false, capture: true }
  )

  const endTouchPan = () => {
    touchPanLastY = null
    touchPanDisabled = false
  }
  document.addEventListener('touchend', endTouchPan, { passive: true, capture: true })
  document.addEventListener('touchcancel', endTouchPan, { passive: true, capture: true })
}

function setupContentHeightObserver(editorView: EditorView): void {
  contentHeightObserver?.disconnect()
  contentHeightObserver = new ResizeObserver(() => {
    reportContentMetrics()
  })
  contentHeightObserver.observe(editorView.contentDOM)
}

function mountEditor(init: InitPayload): void {
  const container = document.getElementById('root')
  if (!container) return

  const theme = init.theme ?? DEFAULT_THEME
  applyTheme(theme)
  view?.destroy()
  delete window.__diaryCmPlaceCursorAfterTable
  scrollListenerInstalled = false
  contentHeightObserver?.disconnect()

  const editable = init.editable ?? true
  const isTouch = init.interactionMode === 'touch'
  const scrollMode = init.scrollMode ?? 'document'
  activeScrollMode = scrollMode
  if (isTouch) {
    window.__tableChromeDebug = true
    window.__diaryBridgeDebug = true
    window.__diaryCmPlaceCursorAfterTable = () => {
      scheduleEnsureCaretVisible()
    }
  }
  applyBottomScrollInset(init.scrollInsets?.bottom ?? 0)

  const buildStamp =
    document.documentElement.innerHTML.match(/diary-editor-build:([^\s-]+)/)?.[1] ?? '(none)'
  logEditor('mountEditor', {
    featureTag: DIARY_CM_FEATURE_TAG,
    buildId: typeof __DIARY_EDITOR_BUILD_ID__ !== 'undefined' ? __DIARY_EDITOR_BUILD_ID__ : '(none)',
    buildStamp,
    interactionMode: init.interactionMode,
    scrollMode,
    bottomScrollInset: bottomScrollInsetPx,
    contentLength: init.content.length
  })

  view = createDiaryCodeMirror(container, {
    content: init.content,
    placeholder: init.placeholder,
    platform: buildPlatform(init),
    onChange: (content) => {
      if (!suppressChangeEcho) {
        postToNative({ type: 'change', payload: { content } })
      }
    },
    extraExtensions: [
      editableCompartment.of(EditorView.editable.of(editable)),
      ...(isTouch && scrollMode === 'viewport'
        ? [
            EditorState.transactionFilter.of((tr) => {
              if (!tr.selection || !tr.scrollIntoView) return tr
              // 合并 spec 的 scrollIntoView 是 OR 语义，附加 spec 关不掉；
              // 须重建事务，并用 filter:false 防止再次进入本 filter（否则栈溢出）。
              // Transaction.annotations 为运行时字段（类型未导出），需保留
              // allowTableStructureEdit 等注解供 tableEditorPlugin 判断
              const annotations = (
                tr as Transaction & { annotations?: readonly Annotation<unknown>[] }
              ).annotations
              return tr.startState.update({
                changes: tr.changes,
                selection: tr.selection,
                effects: tr.effects,
                annotations,
                scrollIntoView: false,
                filter: false
              })
            })
          ]
        : []),
      EditorView.updateListener.of((update) => {
        if (update.selectionSet) {
          const { from, to } = update.state.selection.main
          postToNative({ type: 'selectionChange', payload: { start: from, end: to } })
          if (init.interactionMode === 'touch') {
            window.requestAnimationFrame(() => {
              reportContentMetrics()
              if (scrollMode === 'viewport') {
                if (Date.now() >= suppressCaretScrollFromClickUntil) {
                  userScrollLockUntil = 0
                  scheduleEnsureCaretVisible()
                }
              }
            })
          }
        }
        if (update.docChanged && init.interactionMode === 'touch') {
          window.requestAnimationFrame(() => {
            reportContentMetrics()
            if (scrollMode === 'viewport') {
              if (suppressCaretScrollOnce) {
                suppressCaretScrollOnce = false
              } else {
                userScrollLockUntil = 0
                scheduleEnsureCaretVisible()
              }
            }
          })
        }
      }),
      EditorView.domEventHandlers({
        touchstart: (event) => {
          cancelCaretScrollAnimation()
          noteTouchInteractionStart(event)
          const target = event.target
          if (
            target instanceof Element &&
            target.closest(
              '.cm-table-handle, .cm-table-corner-menu, .cm-table-add-btn, .cm-table-context-menu-layer, .cm-table-sheet-layer'
            )
          ) {
            return false
          }
          return false
        },
        touchmove: (event) => {
          noteTouchInteractionMove(event)
          return false
        },
        touchend: (event) => {
          if (isTableSheetOpen()) {
            dismissKeyboardForSheetInteraction()
            resetTouchInteractionState()
            return false
          }
          if (init.interactionMode === 'touch' && scrollMode === 'viewport') {
            handleTouchPointerEnd(event.target)
          } else {
            resetTouchInteractionState()
          }
          return false
        },
        touchcancel: () => {
          resetTouchInteractionState()
          return false
        },
        click: (event) => {
          if (isTableSheetOpen()) {
            dismissKeyboardForSheetInteraction()
            return false
          }
          return false
        },
        focus: () => {
          if (isTableSheetOpen()) {
            dismissKeyboardForSheetInteraction()
            return false
          }
          postToNative({ type: 'focus' })
          if (init.interactionMode === 'touch' && scrollMode === 'viewport') {
            userScrollLockUntil = 0
            window.requestAnimationFrame(() => {
              if (!view) return
              const head = view.state.selection.main.head
              if (head <= 1 && view.state.doc.length > 1) {
                logEditor('caretScroll:skip', { reason: 'stale-head-on-focus', head })
                return
              }
              scheduleEnsureCaretVisible()
            })
          }
          return false
        },
        focusin: (event) => {
          if (isTableSheetOpen()) {
            dismissKeyboardForSheetInteraction()
            return false
          }
          if ((event.target as Element).closest('.cm-table-cell-source')) {
            window.requestAnimationFrame(() => reportContentMetrics())
          }
          return false
        },
        blur: () => {
          postToNative({ type: 'blur' })
          return false
        }
      })
    ]
  })

  applyBottomScrollInset(bottomScrollInsetPx)
  setupContentHeightObserver(view)
  if (isTouch) {
    if (scrollMode === 'viewport') {
      applyTouchViewportLayout(view)
      installUserScrollListener(view)
    } else {
      applyTouchNoInternalScroll(view)
      installTouchParentScrollRelay()
    }
  }

  const docLength = view.state.doc.length
  view.dispatch({ selection: { anchor: docLength, head: docLength } })

  applyTagColorRegistry(init.tagColorRegistry)
  reportContentMetrics()

  requestAnimationFrame(() => {
    const cellSources = view?.dom.querySelectorAll('.cm-table-cell-source').length ?? 0
    const tableBlocks = view?.dom.querySelectorAll('.cm-table-block').length ?? 0
    logEditor('mountEditor:dom', {
      tableBlocks,
      cellSources,
      scrollerClientHeight: view?.scrollDOM.clientHeight ?? 0,
      scrollerScrollHeight: view?.scrollDOM.scrollHeight ?? 0
    })
  })
}

function setEditable(editable: boolean): void {
  if (!view) return
  view.dispatch({
    effects: editableCompartment.reconfigure(EditorView.editable.of(editable))
  })
}

function setContent(content: string): void {
  if (!view) return
  const current = view.state.doc.toString()
  if (content === current) return

  const { anchor, head } = view.state.selection.main
  const scrollTop = view.scrollDOM.scrollTop
  const mapPos = (pos: number) => Math.max(0, Math.min(pos, content.length))

  suppressChangeEcho = true
  suppressCaretScrollOnce = true
  view.dispatch({
    changes: { from: 0, to: current.length, insert: content },
    selection: { anchor: mapPos(anchor), head: mapPos(head) },
    scrollIntoView: false
  })
  view.scrollDOM.scrollTop = scrollTop
  suppressChangeEcho = false
}

function deleteRange(from: number, to: number): void {
  if (!view) return
  const doc = view.state.doc
  const safeFrom = Math.max(0, Math.min(from, doc.length))
  const safeTo = Math.max(safeFrom, Math.min(to, doc.length))
  if (safeFrom === safeTo) return

  const savedScrollTop = view.scrollDOM.scrollTop
  suppressCaretScrollOnce = true
  view.dispatch({
    changes: { from: safeFrom, to: safeTo, insert: '' },
    selection: { anchor: safeFrom, head: safeFrom },
    scrollIntoView: false
  })
  view.scrollDOM.scrollTop = savedScrollTop
}

function insertAtCursor(text: string): void {
  if (!view) return
  const { from, to } = view.state.selection.main
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length }
  })
  view.focus()
}

function setSelection(start: number, end: number): void {
  if (!view) return
  view.dispatch({ selection: { anchor: start, head: end } })
  scheduleEnsureCaretVisible()
}

function handleResolveUrlResponse(requestId: string, url: string | null): void {
  const srcRaw = pendingUrlRequests.get(requestId)
  if (!srcRaw) return

  pendingUrlRequests.delete(requestId)
  if (url) {
    urlCache.set(srcRaw, url)
  }

  if (view) {
    view.dispatch({ effects: forceImageRefresh.of(null) })
  }
}

function applyTagColorRegistry(registry: Record<string, number> | undefined): void {
  const next = registry ?? {}
  setActiveDiaryTagColorRegistry(next)
  if (view) {
    view.dispatch({ effects: refreshDiaryTagColorRegistryEffect.of(next) })
  }
}

function handleRnMessage(raw: unknown): void {
  let message: RnToWebViewMessage
  try {
    message = typeof raw === 'string' ? JSON.parse(raw) : (raw as RnToWebViewMessage)
  } catch {
    return
  }

  switch (message.type) {
    case 'init':
      mountEditor(message.payload)
      break
    case 'setContent':
      setContent(message.payload.content)
      break
    case 'deleteRange':
      deleteRange(message.payload.from, message.payload.to)
      break
    case 'setTagColorRegistry':
      applyTagColorRegistry(message.payload.registry)
      break
    case 'insertAtCursor':
      insertAtCursor(message.payload.text)
      break
    case 'toggleMarkdownMark':
      if (view) toggleMarkdownMark(view, message.payload.marker)
      break
    case 'undo':
      if (view) undo(view)
      break
    case 'redo':
      if (view) redo(view)
      break
    case 'setSelection':
      setSelection(message.payload.start, message.payload.end)
      break
    case 'setEditable':
      setEditable(message.payload.editable)
      break
    case 'setScrollInsets':
      setScrollInsets(message.payload.bottom)
      break
    case 'scrollCaretIntoView':
      userScrollLockUntil = 0
      scheduleEnsureCaretVisible()
      break
    case 'focus':
      view?.focus()
      userScrollLockUntil = 0
      scheduleEnsureCaretVisible()
      break
    case 'blur':
      view?.dom.blur()
      break
    case 'resolveUrlResponse':
      handleResolveUrlResponse(message.payload.requestId, message.payload.url)
      break
    case 'confirmResponse':
      resolveTableConfirmResponse(message.payload.requestId, message.payload.confirmed)
      break
    case 'tableSheetResponse':
      resolveNativeTableSheetResponse(message.payload)
      break
    case 'requestReady':
      postToNative({ type: 'ready' })
      break
  }
}

function listenForNativeMessages(): void {
  const handler = (event: Event) => {
    const data = (event as MessageEvent).data
    if (typeof data === 'string' || (typeof data === 'object' && data !== null)) {
      handleRnMessage(data)
    }
  }

  document.addEventListener('message', handler as EventListener)
  window.addEventListener('message', handler)
}

function exposeNativeMessageBridge(): void {
  ;(
    window as unknown as { __diaryCmOnNativeMessage?: (raw: unknown) => void }
  ).__diaryCmOnNativeMessage = handleRnMessage
}

function bootstrap(): void {
  listenForNativeMessages()
  exposeNativeMessageBridge()

  // 浏览器本地调试：无 RN 宿主时直接挂载
  if (!window.ReactNativeWebView) {
    mountEditor({
      content: '# Hello\n\nWebView bundle 已加载（shared diary-codemirror）。',
      placeholder: '记录下这一刻...',
      theme: DEFAULT_THEME,
      interactionMode: 'touch',
      editable: true
    })
    return
  }

  const sendReady = () => {
    logEditor('ready', {
      featureTag: DIARY_CM_FEATURE_TAG,
      buildId: typeof __DIARY_EDITOR_BUILD_ID__ !== 'undefined' ? __DIARY_EDITOR_BUILD_ID__ : '(none)'
    })
    postToNative({ type: 'ready' })
  }

  // 协议：WebView 就绪后通知 RN，RN 再发 init
  sendReady()
  // 部分 Android 设备 onMessage 挂载晚于首帧，补发 ready
  window.setTimeout(sendReady, 120)
  window.setTimeout(sendReady, 500)
}

try {
  bootstrap()
} catch (error) {
  console.error('[diary-cm] bootstrap failed:', error)
}
