import { Compartment } from '@codemirror/state'
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
import type { DiaryCmTheme } from '@baishou/ui/shared/diary-codemirror/types'

import type { InitPayload, RnToWebViewMessage, WebViewToRnMessage } from './types'

let view: EditorView | null = null
let suppressChangeEcho = false
let contentHeightObserver: ResizeObserver | null = null
let activeScrollMode: 'viewport' | 'document' = 'document'
let bottomScrollInsetPx = 0
let caretScrollFrameId: number | null = null

/** 光标与底部遮挡区之间的额外留白 */
const CARET_SCROLL_BOTTOM_BUFFER_PX = 12
const CARET_SCROLL_TOP_BUFFER_PX = 16
const CARET_SCROLL_DURATION_MS = 320

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
  root.style.setProperty('--bg-surface-normal', theme.bgEditor)
  root.style.setProperty('--border-subtle', theme.borderColor)
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

function smoothScrollElementTo(
  element: HTMLElement,
  targetTop: number,
  duration = CARET_SCROLL_DURATION_MS
): void {
  if (caretScrollFrameId !== null) {
    cancelAnimationFrame(caretScrollFrameId)
    caretScrollFrameId = null
  }

  const maxTop = Math.max(0, element.scrollHeight - element.clientHeight)
  const clampedTarget = Math.max(0, Math.min(targetTop, maxTop))
  const start = element.scrollTop
  const change = clampedTarget - start
  if (Math.abs(change) < 1) return

  const startTime = performance.now()
  const tick = (now: number) => {
    const progress = Math.min((now - startTime) / duration, 1)
    const ease = 1 - Math.pow(1 - progress, 4)
    element.scrollTop = start + change * ease
    if (progress < 1) {
      caretScrollFrameId = requestAnimationFrame(tick)
    } else {
      caretScrollFrameId = null
    }
  }
  caretScrollFrameId = requestAnimationFrame(tick)
}

function computeCaretScrollTarget(): number | null {
  if (!view || activeScrollMode !== 'viewport') return null

  const pos = view.state.selection.main.head
  const coords = view.coordsAtPos(pos)
  if (!coords) return null

  const { scrollDOM } = view
  const scrollRect = scrollDOM.getBoundingClientRect()
  const chromeBottom = bottomScrollInsetPx + CARET_SCROLL_BOTTOM_BUFFER_PX
  const safeBottom = scrollRect.top + scrollDOM.clientHeight - chromeBottom
  const safeTop = scrollRect.top + CARET_SCROLL_TOP_BUFFER_PX
  let targetScrollTop = scrollDOM.scrollTop

  if (coords.bottom > safeBottom) {
    targetScrollTop += coords.bottom - safeBottom
  } else if (coords.top < safeTop) {
    targetScrollTop -= safeTop - coords.top
  } else {
    return null
  }

  const maxTop = Math.max(0, scrollDOM.scrollHeight - scrollDOM.clientHeight)
  return Math.max(0, Math.min(targetScrollTop, maxTop))
}

function ensureCaretVisible(): void {
  if (!view || activeScrollMode !== 'viewport') return
  const targetScrollTop = computeCaretScrollTarget()
  if (targetScrollTop === null) return
  smoothScrollElementTo(view.scrollDOM, targetScrollTop)
}

function scheduleEnsureCaretVisible(): void {
  window.requestAnimationFrame(() => ensureCaretVisible())
}

function applyBottomScrollInset(bottom: number): void {
  bottomScrollInsetPx = Math.max(0, bottom)
  if (!view) return
  view.scrollDOM.style.setProperty('--diary-bottom-scroll-inset', `${bottomScrollInsetPx}px`)
}

function setScrollInsets(bottom: number): void {
  applyBottomScrollInset(bottom)
  scheduleEnsureCaretVisible()
}

function reportContentMetrics(): void {
  if (!view) return

  const contentRect = view.contentDOM.getBoundingClientRect()
  const pos = view.state.selection.main.head
  const coords = view.coordsAtPos(pos)
  const contentTop = contentRect.top

  let caretTop = contentRect.height
  let caretBottom = contentRect.height
  if (coords) {
    caretTop = coords.top - contentTop
    caretBottom = coords.bottom - contentTop
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
    '.cm-table-handle, .cm-table-add-btn, .cm-table-context-menu, .cm-table-context-menu-layer'
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
  contentHeightObserver?.disconnect()

  const editable = init.editable ?? true
  const isTouch = init.interactionMode === 'touch'
  const scrollMode = init.scrollMode ?? 'document'
  activeScrollMode = scrollMode
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
            if (scrollMode === 'viewport') scheduleEnsureCaretVisible()
          })
        }
      }),
      EditorView.domEventHandlers({
        click: () => {
          if (init.interactionMode === 'touch' && scrollMode === 'viewport') {
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
  if (content === view.state.doc.toString()) return

  suppressChangeEcho = true
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: content }
  })
  suppressChangeEcho = false
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
