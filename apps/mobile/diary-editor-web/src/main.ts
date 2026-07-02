import { Compartment, EditorState } from '@codemirror/state'
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
import type { DiaryCmTheme } from '@baishou/ui/shared/diary-codemirror/types'

import type { InitPayload, RnToWebViewMessage, WebViewToRnMessage } from './types'

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

/** 用户手动滚动后，暂停自动拽回光标的时长 */
const USER_SCROLL_LOCK_MS = 3000

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

function isTableCellInputFocused(): boolean {
  const active = document.activeElement
  return active instanceof HTMLTextAreaElement && active.classList.contains('cm-table-cell-input')
}

function isCaretNearPostTableZone(): boolean {
  if (!view) return false
  const head = view.state.selection.main.head
  const doc = view.state.doc

  for (const block of view.dom.querySelectorAll('.cm-table-block')) {
    const tableTo = Number((block as HTMLElement).dataset.tableTo)
    if (Number.isNaN(tableTo) || head <= tableTo) continue
    try {
      const closingLine = doc.lineAt(tableTo)
      const headLine = doc.lineAt(head)
      if (headLine.number <= closingLine.number + 4) return true
    } catch {
      /* ignore */
    }
  }

  return false
}

/** 表后区域 coordsAtPos 常落在表格 widget 顶部，改用正文行的 DOM 矩形 */
function resolveCaretViewportRect(editorView: EditorView, pos: number): DOMRect | null {
  if (isCaretNearPostTableZone()) {
    try {
      const line = editorView.state.doc.lineAt(pos)
      const domAt = editorView.domAtPos(line.from)
      let node: Node | null = domAt.node
      if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
      const lineEl = (node instanceof Element ? node : node?.parentElement)?.closest('.cm-line')
      if (lineEl) return lineEl.getBoundingClientRect()
    } catch {
      /* fall through */
    }
  }

  const coords = editorView.coordsAtPos(pos)
  if (!coords) return null
  return new DOMRect(coords.left, coords.top, coords.right - coords.left, coords.bottom - coords.top)
}

function clearUserScrollLockForContentEdit(target: EventTarget | null): void {
  if (!(target instanceof Element)) return
  if (
    target.closest(
      '.cm-table-block, .cm-table-context-menu, .cm-table-context-menu-layer, .cm-table-sheet-layer'
    )
  ) {
    return
  }
  userScrollLockUntil = 0
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

  editorView.scrollDOM.addEventListener(
    'touchstart',
    () => {
      lockUserScroll()
    },
    { passive: true }
  )
}

function shouldAutoScrollCaret(): boolean {
  if (!view || activeScrollMode !== 'viewport') return false
  if (isUserScrollLocked()) return false
  if (isTableCellInputFocused()) return false
  return true
}

function computeCaretScrollTarget(): number | null {
  if (!shouldAutoScrollCaret()) return null

  const pos = view!.state.selection.main.head
  const caretRect = resolveCaretViewportRect(view!, pos)
  if (!caretRect) return null

  const { scrollDOM } = view!
  const scrollRect = scrollDOM.getBoundingClientRect()
  const chromeBottom = bottomScrollInsetPx + CARET_SCROLL_BOTTOM_BUFFER_PX
  const safeTop = scrollRect.top + CARET_SCROLL_TOP_BUFFER_PX
  const safeBottom = scrollRect.top + scrollDOM.clientHeight - chromeBottom

  let targetScrollTop: number | null = null
  if (caretRect.bottom > safeBottom) {
    targetScrollTop = scrollDOM.scrollTop + (caretRect.bottom - safeBottom)
  } else if (caretRect.top < safeTop) {
    targetScrollTop = scrollDOM.scrollTop + (caretRect.top - safeTop)
  }

  if (targetScrollTop === null) return null

  const maxTop = Math.max(0, scrollDOM.scrollHeight - scrollDOM.clientHeight)
  return Math.max(0, Math.min(targetScrollTop, maxTop))
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
  applyBottomScrollInset(bottom)
}

function reportContentMetrics(): void {
  if (!view) return

  const contentRect = view.contentDOM.getBoundingClientRect()
  const contentTop = contentRect.top

  if (isTableCellInputFocused()) {
    const input = document.activeElement as HTMLTextAreaElement
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
  const caretRect = resolveCaretViewportRect(view, pos)

  let caretTop = contentRect.height
  let caretBottom = contentRect.height
  if (caretRect) {
    caretTop = caretRect.top - contentTop
    caretBottom = caretRect.bottom - contentTop
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
    window.__tableChromeDebug = typeof __DEV__ !== 'undefined' && __DEV__
    window.__diaryCmPlaceCursorAfterTable = (editorView) => {
      scheduleEnsureCaretVisible(() => editorView.focus())
    }
  }
  applyBottomScrollInset(init.scrollInsets?.bottom ?? 0)

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
              if (!tr.selection) return tr
              return tr.startState.update({
                changes: tr.changes,
                selection: tr.selection,
                effects: tr.effects,
                annotations: tr.annotations,
                scrollIntoView: false
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
              if (scrollMode === 'viewport') scheduleEnsureCaretVisible()
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
                scheduleEnsureCaretVisible()
              }
            }
          })
        }
      }),
      EditorView.domEventHandlers({
        touchstart: (event) => {
          cancelCaretScrollAnimation()
          const target = event.target
          if (
            target instanceof Element &&
            target.closest(
              '.cm-table-handle, .cm-table-corner-menu, .cm-table-add-btn, .cm-table-context-menu-layer, .cm-table-sheet-layer'
            )
          ) {
            return false
          }
          if (init.interactionMode === 'touch' && scrollMode === 'viewport') {
            clearUserScrollLockForContentEdit(target)
          }
          return false
        },
        touchend: (event) => {
          if (init.interactionMode === 'touch' && scrollMode === 'viewport') {
            clearUserScrollLockForContentEdit(event.target)
            scheduleEnsureCaretVisible()
          }
          return false
        },
        click: (event) => {
          if (init.interactionMode === 'touch' && scrollMode === 'viewport') {
            clearUserScrollLockForContentEdit(event.target)
            scheduleEnsureCaretVisible()
          }
          return false
        },
        focus: () => {
          postToNative({ type: 'focus' })
          if (init.interactionMode === 'touch' && scrollMode === 'viewport') {
            scheduleEnsureCaretVisible()
          }
          return false
        },
        focusin: (event) => {
          if ((event.target as Element).closest('.cm-table-cell-input')) {
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
      scheduleEnsureCaretVisible()
      break
    case 'focus':
      view?.focus()
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

  const sendReady = () => postToNative({ type: 'ready' })

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
