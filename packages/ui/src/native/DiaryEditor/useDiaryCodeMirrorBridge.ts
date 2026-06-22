import { useCallback, useEffect, useRef, type RefObject } from 'react'
import type { WebView } from 'react-native-webview'
import {
  DIARY_CM_RESOLVE_URL_TIMEOUT_MS,
  parseDiaryCmFromWebViewMessage,
  serializeDiaryCmToWebViewMessage,
  type DiaryCmFromWebViewMessage,
  type DiaryCmImageActionPayload,
  type DiaryCmInitPayload,
  type DiaryCmTheme,
  type DiaryCmToWebViewMessage,
  type DiaryTagColorRegistry
} from '../../shared/diary-codemirror/types'
import { DiaryCmAttachmentUrlCache } from './diary-cm-attachment-url-cache'
import { isLikelyEditorBundleLeak } from './diary-cm-content.util'

interface PendingUrlRequest {
  timeoutId: ReturnType<typeof setTimeout>
}

export interface UseDiaryCodeMirrorBridgeOptions {
  content: string
  placeholder?: string
  theme: DiaryCmTheme
  /** 默认 true；false 时 WebView 内 CM 为只读预览 */
  editable?: boolean
  onChange?: (content: string) => void
  onSelectionChange?: (start: number, end: number) => void
  onFocus?: () => void
  onBlur?: () => void
  onContentHeight?: (height: number) => void
  /** 光标在编辑器内的纵向位置，供 RN 外层滚动 */
  onCaretViewport?: (top: number, bottom: number) => void
  /** WebView 内滑动手势转发给 RN 外层 ScrollView */
  onPanScroll?: (deltaY: number) => void
  tagColorRegistry?: DiaryTagColorRegistry
  onImageAction?: (payload: DiaryCmImageActionPayload) => void
  onImagePreview?: (srcRaw: string, resolvedUrl: string) => void
  /** attachment/xxx → data: 或 file: URI */
  resolveAttachmentUrl?: (srcRaw: string) => Promise<string | null>
  /** WebView 内滚动时需预留的底部遮挡高度（如 RN 浮动工具栏） */
  bottomScrollInset?: number
}

export interface DiaryCodeMirrorBridgeApi {
  webViewRef: RefObject<WebView | null>
  onWebViewMessage: (event: { nativeEvent: { data: string } }) => void
  onWebViewLoadStart: () => void
  onWebViewLoadEnd: () => void
  focusAtOffset: (offset: number) => void
  blur: () => void
  insertAtCursor: (text: string) => void
  insertAtRange: (start: number, end: number, text: string) => void
  isReady: () => boolean
  setScrollInsets: (bottom: number) => void
  scrollCaretIntoView: () => void
}

function buildInitPayload(
  content: string,
  placeholder: string | undefined,
  theme: DiaryCmTheme,
  editable: boolean,
  tagColorRegistry: DiaryTagColorRegistry | undefined,
  bottomScrollInset: number
): DiaryCmInitPayload {
  return {
    content,
    placeholder,
    theme,
    interactionMode: 'touch',
    editable,
    scrollMode: 'viewport',
    tagLineMode: true,
    tagColorRegistry,
    scrollInsets: { bottom: Math.max(0, bottomScrollInset) }
  }
}

export function useDiaryCodeMirrorBridge(
  options: UseDiaryCodeMirrorBridgeOptions
): DiaryCodeMirrorBridgeApi {
  const {
    content,
    placeholder,
    theme,
    editable = true,
    onChange,
    onSelectionChange,
    onFocus,
    onBlur,
    onContentHeight,
    onImageAction,
    onImagePreview,
    resolveAttachmentUrl,
    tagColorRegistry
  } = options

  const webViewRef = useRef<WebView | null>(null)
  const isReadyRef = useRef(false)
  const editorMountedRef = useRef(false)
  const pendingOutboundRef = useRef<DiaryCmToWebViewMessage[]>([])
  const pendingUrlRequestsRef = useRef<Map<string, PendingUrlRequest>>(new Map())
  const echoSuppressContentRef = useRef<string | null>(null)
  const lastWebViewContentRef = useRef<string | null>(null)
  const lastTagColorRegistryRef = useRef<string | null>(null)
  const lastEditableRef = useRef<boolean | null>(null)
  const loadEndRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initSentForLoadRef = useRef(false)

  const optionsRef = useRef(options)
  optionsRef.current = options

  const attachmentUrlCacheRef = useRef<DiaryCmAttachmentUrlCache | null>(null)
  if (!attachmentUrlCacheRef.current) {
    attachmentUrlCacheRef.current = new DiaryCmAttachmentUrlCache()
  }
  const attachmentUrlCache = attachmentUrlCacheRef.current

  const logBridge = useCallback((message: string) => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log(`[DiaryEditor Bridge] ${message}`)
    }
  }, [])

  const probeWebViewBoot = useCallback(() => {
    webViewRef.current?.injectJavaScript(
      `;(function(){try{var ok=!!window.__diaryCmOnNativeMessage;window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:"contentHeight",payload:{height:ok?1:-1}}))}catch(e){}})();true;`
    )
  }, [])

  const postToWebView = useCallback((message: DiaryCmToWebViewMessage) => {
    const serialized = serializeDiaryCmToWebViewMessage(message)
    // 仅 postMessage：与 injectJavaScript 双发会导致 WebView 执行两次（如工具栏插入重复）
    webViewRef.current?.postMessage(serialized)
  }, [])

  const enqueueOrSend = useCallback(
    (message: DiaryCmToWebViewMessage) => {
      if (!isReadyRef.current) {
        pendingOutboundRef.current.push(message)
        return
      }
      postToWebView(message)
    },
    [postToWebView]
  )

  const flushPendingOutbound = useCallback(() => {
    const queue = pendingOutboundRef.current
    pendingOutboundRef.current = []
    for (const message of queue) {
      postToWebView(message)
    }
  }, [postToWebView])

  const sendInit = useCallback(() => {
    const opts = optionsRef.current
    const payload = buildInitPayload(
      opts.content,
      opts.placeholder,
      opts.theme,
      opts.editable ?? true,
      opts.tagColorRegistry,
      opts.bottomScrollInset ?? 0
    )
    lastEditableRef.current = opts.editable ?? true
    postToWebView({ type: 'init', payload })
    lastWebViewContentRef.current = opts.content
    editorMountedRef.current = true
  }, [postToWebView])

  const resetSession = useCallback(() => {
    if (loadEndRetryTimerRef.current) {
      clearTimeout(loadEndRetryTimerRef.current)
      loadEndRetryTimerRef.current = null
    }
    isReadyRef.current = false
    editorMountedRef.current = false
    initSentForLoadRef.current = false
    pendingOutboundRef.current = []
    lastWebViewContentRef.current = null
    lastEditableRef.current = null
  }, [])

  const respondResolveUrl = useCallback(
    (requestId: string, url: string | null) => {
      const pending = pendingUrlRequestsRef.current.get(requestId)
      if (!pending) return
      clearTimeout(pending.timeoutId)
      pendingUrlRequestsRef.current.delete(requestId)
      enqueueOrSend({
        type: 'resolveUrlResponse',
        payload: { requestId, url }
      })
    },
    [enqueueOrSend]
  )

  const handleResolveUrlRequest = useCallback(
    (requestId: string, srcRaw: string) => {
      if (pendingUrlRequestsRef.current.has(requestId)) return

      const timeoutId = setTimeout(() => {
        respondResolveUrl(requestId, null)
      }, DIARY_CM_RESOLVE_URL_TIMEOUT_MS)

      pendingUrlRequestsRef.current.set(requestId, { timeoutId })

      void attachmentUrlCache
        .resolve(srcRaw, async (raw) => {
          try {
            return (await optionsRef.current.resolveAttachmentUrl?.(raw)) ?? null
          } catch {
            return null
          }
        })
        .then((url) => respondResolveUrl(requestId, url))
        .catch(() => respondResolveUrl(requestId, null))
    },
    [attachmentUrlCache, respondResolveUrl]
  )

  const handleFromWebView = useCallback(
    (message: DiaryCmFromWebViewMessage) => {
      switch (message.type) {
        case 'ready':
          logBridge('received ready')
          isReadyRef.current = true
          if (!initSentForLoadRef.current) {
            initSentForLoadRef.current = true
            logBridge('send init')
            sendInit()
          }
          flushPendingOutbound()
          return
        case 'change': {
          if (!editorMountedRef.current) return
          const next = message.payload.content
          if (isLikelyEditorBundleLeak(next)) return
          lastWebViewContentRef.current = next
          if (echoSuppressContentRef.current !== null && next === echoSuppressContentRef.current) {
            echoSuppressContentRef.current = null
            return
          }
          echoSuppressContentRef.current = null
          optionsRef.current.onChange?.(next)
          return
        }
        case 'selectionChange':
          if (!editorMountedRef.current) return
          optionsRef.current.onSelectionChange?.(message.payload.start, message.payload.end)
          return
        case 'resolveUrlRequest':
          handleResolveUrlRequest(message.payload.requestId, message.payload.srcRaw)
          return
        case 'imageAction':
          optionsRef.current.onImageAction?.(message.payload)
          return
        case 'imagePreview':
          optionsRef.current.onImagePreview?.(
            message.payload.srcRaw,
            message.payload.resolvedUrl
          )
          return
        case 'contentHeight': {
          const height = message.payload.height
          if (height === -1) {
            logBridge('boot probe: bundle script not loaded')
            return
          }
          if (height === 1) {
            logBridge('boot probe: bridge OK')
            return
          }
          logBridge(`contentHeight ${height}`)
          optionsRef.current.onContentHeight?.(height)
          return
        }
        case 'caretViewport':
          optionsRef.current.onCaretViewport?.(
            message.payload.top,
            message.payload.bottom
          )
          return
        case 'panScroll':
          optionsRef.current.onPanScroll?.(message.payload.deltaY)
          return
        case 'focus':
          optionsRef.current.onFocus?.()
          return
        case 'blur':
          optionsRef.current.onBlur?.()
          return
        default:
          return
      }
    },
    [flushPendingOutbound, handleResolveUrlRequest, logBridge, sendInit]
  )

  const onWebViewMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      const message = parseDiaryCmFromWebViewMessage(event.nativeEvent.data)
      if (message) handleFromWebView(message)
    },
    [handleFromWebView]
  )

  const onWebViewLoadStart = useCallback(() => {
    resetSession()
  }, [resetSession])

  const onWebViewLoadEnd = useCallback(() => {
    if (loadEndRetryTimerRef.current) {
      clearTimeout(loadEndRetryTimerRef.current)
    }

    const tryHandshake = (forceInit: boolean) => {
      if (!isReadyRef.current) {
        logBridge(forceInit ? 'requestReady (force)' : 'requestReady')
        postToWebView({ type: 'requestReady' })
      }
      if (forceInit && !initSentForLoadRef.current) {
        logBridge('force init (no ready received)')
        isReadyRef.current = true
        initSentForLoadRef.current = true
        sendInit()
        flushPendingOutbound()
      }
    }

    probeWebViewBoot()
    tryHandshake(false)
    loadEndRetryTimerRef.current = setTimeout(() => {
      tryHandshake(false)
      loadEndRetryTimerRef.current = setTimeout(() => {
        loadEndRetryTimerRef.current = null
        tryHandshake(true)
      }, 250)
    }, 80)
  }, [flushPendingOutbound, logBridge, postToWebView, probeWebViewBoot, sendInit])

  const pushSetContent = useCallback(
    (nextContent: string) => {
      if (isLikelyEditorBundleLeak(nextContent)) return
      echoSuppressContentRef.current = nextContent
      enqueueOrSend({ type: 'setContent', payload: { content: nextContent } })
      lastWebViewContentRef.current = nextContent
    },
    [enqueueOrSend]
  )

  useEffect(() => {
    if (!isReadyRef.current) return
    if (content === lastWebViewContentRef.current) return
    pushSetContent(content)
  }, [content, pushSetContent])

  useEffect(() => {
    if (!isReadyRef.current) return
    const serialized = JSON.stringify(tagColorRegistry ?? {})
    if (serialized === lastTagColorRegistryRef.current) return
    lastTagColorRegistryRef.current = serialized
    enqueueOrSend({
      type: 'setTagColorRegistry',
      payload: { registry: tagColorRegistry ?? {} }
    })
  }, [enqueueOrSend, tagColorRegistry])

  useEffect(() => {
    if (!isReadyRef.current) return
    if (lastEditableRef.current === editable) return
    lastEditableRef.current = editable
    enqueueOrSend({ type: 'setEditable', payload: { editable } })
  }, [editable, enqueueOrSend])

  useEffect(() => {
    return () => {
      if (loadEndRetryTimerRef.current) {
        clearTimeout(loadEndRetryTimerRef.current)
      }
      for (const pending of pendingUrlRequestsRef.current.values()) {
        clearTimeout(pending.timeoutId)
      }
      pendingUrlRequestsRef.current.clear()
      attachmentUrlCache.clear()
      resetSession()
    }
  }, [attachmentUrlCache, resetSession])

  const focusAtOffset = useCallback(
    (offset: number) => {
      const safeOffset = Math.max(0, offset)
      enqueueOrSend({
        type: 'setSelection',
        payload: { start: safeOffset, end: safeOffset }
      })
      enqueueOrSend({ type: 'focus' })
    },
    [enqueueOrSend]
  )

  const blur = useCallback(() => {
    enqueueOrSend({ type: 'blur' })
  }, [enqueueOrSend])

  const insertAtCursor = useCallback(
    (text: string) => {
      enqueueOrSend({ type: 'insertAtCursor', payload: { text } })
    },
    [enqueueOrSend]
  )

  const insertAtRange = useCallback(
    (start: number, end: number, text: string) => {
      enqueueOrSend({
        type: 'setSelection',
        payload: { start, end }
      })
      enqueueOrSend({ type: 'insertAtCursor', payload: { text } })
    },
    [enqueueOrSend]
  )

  const setScrollInsets = useCallback(
    (bottom: number) => {
      enqueueOrSend({
        type: 'setScrollInsets',
        payload: { bottom: Math.max(0, bottom) }
      })
    },
    [enqueueOrSend]
  )

  const scrollCaretIntoView = useCallback(() => {
    enqueueOrSend({ type: 'scrollCaretIntoView' })
  }, [enqueueOrSend])

  return {
    webViewRef,
    onWebViewMessage,
    onWebViewLoadStart,
    onWebViewLoadEnd,
    focusAtOffset,
    blur,
    insertAtCursor,
    insertAtRange,
    isReady: () => isReadyRef.current,
    setScrollInsets,
    scrollCaretIntoView
  }
}
