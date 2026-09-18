import { useCallback, useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import type { WebView } from 'react-native-webview'
import {
  DIARY_CM_RESOLVE_URL_TIMEOUT_MS,
  parseDiaryCmFromWebViewMessage,
  serializeDiaryCmToWebViewMessage,
  type DiaryCmFromWebViewMessage,
  type DiaryCmToWebViewMessage
} from '../../shared/diary-codemirror/types'
import { DiaryCmAttachmentUrlCache } from './diary-cm-attachment-url-cache'
import {
  isLikelyEditorBundleLeak,
  isStaleControlledContentEcho,
  looksLikeExternalContentReplace
} from './diary-cm-content.util'
import { handleDiaryCmInboundMessage } from './diary-cm-bridge-inbound'
import { buildInitPayload, shouldInjectDiaryBridgeMessage } from './diary-cm-bridge-session'
import type {
  DiaryCodeMirrorBridgeApi,
  UseDiaryCodeMirrorBridgeOptions
} from './diary-cm-bridge.types'

export type {
  DiaryCodeMirrorBridgeApi,
  UseDiaryCodeMirrorBridgeOptions
} from './diary-cm-bridge.types'

interface PendingUrlRequest {
  timeoutId: ReturnType<typeof setTimeout>
}

export function useDiaryCodeMirrorBridge(
  options: UseDiaryCodeMirrorBridgeOptions
): DiaryCodeMirrorBridgeApi {
  const { content, editable = true, tagColorRegistry } = options

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
  const webViewOwnsContentRef = useRef(false)

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
    if (shouldInjectDiaryBridgeMessage(Platform.OS, message)) {
      const encoded = JSON.stringify(serialized)
      webViewRef.current?.injectJavaScript(
        `;(function(){try{var h=window.__diaryCmOnNativeMessage;if(h)h(${encoded});}catch(e){}})();true;`
      )
      return
    }
    // 常规消息仅 postMessage：与 injectJavaScript 双发会导致 WebView 执行两次（如工具栏插入重复）
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
    webViewOwnsContentRef.current = false
    // 抑制 mount 后 WebView 因 createDiaryCodeMirror 插入全文触发的 change 回传
    echoSuppressContentRef.current = opts.content
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
    webViewOwnsContentRef.current = false
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
      handleDiaryCmInboundMessage({
        message,
        options: optionsRef.current,
        logBridge,
        enqueueOrSend,
        flushPendingOutbound,
        sendInit,
        handleResolveUrlRequest,
        refs: {
          isReadyRef,
          editorMountedRef,
          initSentForLoadRef,
          lastWebViewContentRef,
          webViewOwnsContentRef,
          echoSuppressContentRef
        }
      })
    },
    [enqueueOrSend, flushPendingOutbound, handleResolveUrlRequest, logBridge, sendInit]
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
      webViewOwnsContentRef.current = false
      enqueueOrSend({ type: 'setContent', payload: { content: nextContent } })
      lastWebViewContentRef.current = nextContent
    },
    [enqueueOrSend]
  )

  useEffect(() => {
    if (!isReadyRef.current) return
    if (content === lastWebViewContentRef.current) return

    if (webViewOwnsContentRef.current) {
      const prev = lastWebViewContentRef.current ?? ''
      // 长按删除等：WebView 领先时，禁止把 RN 滞后正文回写（否则光标跑到文字前面）
      if (isStaleControlledContentEcho(prev, content)) return
      if (!looksLikeExternalContentReplace(prev, content)) return
    }

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
    const pendingUrlRequests = pendingUrlRequestsRef.current
    return () => {
      if (loadEndRetryTimerRef.current) {
        clearTimeout(loadEndRetryTimerRef.current)
      }
      for (const pending of pendingUrlRequests.values()) {
        clearTimeout(pending.timeoutId)
      }
      pendingUrlRequests.clear()
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
    (bottom: number, keyboardVisible?: boolean) => {
      enqueueOrSend({
        type: 'setScrollInsets',
        payload: {
          bottom: Math.max(0, bottom),
          ...(keyboardVisible !== undefined ? { keyboardVisible } : {})
        }
      })
    },
    [enqueueOrSend]
  )

  const scrollCaretIntoView = useCallback(() => {
    enqueueOrSend({ type: 'scrollCaretIntoView' })
  }, [enqueueOrSend])

  const deleteRange = useCallback(
    (from: number, to: number) => {
      enqueueOrSend({ type: 'deleteRange', payload: { from, to } })
    },
    [enqueueOrSend]
  )

  const undo = useCallback(() => {
    enqueueOrSend({ type: 'undo' })
  }, [enqueueOrSend])

  const redo = useCallback(() => {
    enqueueOrSend({ type: 'redo' })
  }, [enqueueOrSend])

  const toggleMarkdownMark = useCallback(
    (marker: import('../../shared/diary-codemirror/types').DiaryCmMarkdownMark) => {
      enqueueOrSend({ type: 'toggleMarkdownMark', payload: { marker } })
    },
    [enqueueOrSend]
  )

  return {
    webViewRef,
    onWebViewMessage,
    onWebViewLoadStart,
    onWebViewLoadEnd,
    focusAtOffset,
    blur,
    insertAtCursor,
    insertAtRange,
    undo,
    redo,
    toggleMarkdownMark,
    isReady: () => isReadyRef.current,
    setScrollInsets,
    scrollCaretIntoView,
    deleteRange
  }
}
