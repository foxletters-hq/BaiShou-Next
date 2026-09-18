import type {
  DiaryCmFromWebViewMessage,
  DiaryCmToWebViewMessage
} from '../../shared/diary-codemirror/types'
import { isLikelyEditorBundleLeak } from './diary-cm-content.util'
import type { UseDiaryCodeMirrorBridgeOptions } from './diary-cm-bridge.types'

export function handleDiaryCmInboundMessage(params: {
  message: DiaryCmFromWebViewMessage
  options: UseDiaryCodeMirrorBridgeOptions
  logBridge: (message: string) => void
  enqueueOrSend: (message: DiaryCmToWebViewMessage) => void
  flushPendingOutbound: () => void
  sendInit: () => void
  handleResolveUrlRequest: (requestId: string, srcRaw: string) => void
  refs: {
    isReadyRef: { current: boolean }
    editorMountedRef: { current: boolean }
    initSentForLoadRef: { current: boolean }
    lastWebViewContentRef: { current: string | null }
    webViewOwnsContentRef: { current: boolean }
    echoSuppressContentRef: { current: string | null }
  }
}): void {
  const {
    message,
    options,
    logBridge,
    enqueueOrSend,
    flushPendingOutbound,
    sendInit,
    handleResolveUrlRequest,
    refs
  } = params

  switch (message.type) {
    case 'ready':
      logBridge('received ready')
      refs.isReadyRef.current = true
      if (!refs.initSentForLoadRef.current && refs.editorMountedRef.current) {
        logBridge('skip init — editor already mounted')
        flushPendingOutbound()
        return
      }
      if (!refs.initSentForLoadRef.current) {
        refs.initSentForLoadRef.current = true
        logBridge('send init')
        sendInit()
      }
      flushPendingOutbound()
      return
    case 'change': {
      if (!refs.editorMountedRef.current) return
      const next = message.payload.content
      if (isLikelyEditorBundleLeak(next)) return
      refs.lastWebViewContentRef.current = next
      refs.webViewOwnsContentRef.current = true
      if (
        refs.echoSuppressContentRef.current !== null &&
        next === refs.echoSuppressContentRef.current
      ) {
        refs.echoSuppressContentRef.current = null
        return
      }
      refs.echoSuppressContentRef.current = null
      options.onChange?.(next)
      return
    }
    case 'selectionChange':
      if (!refs.editorMountedRef.current) return
      options.onSelectionChange?.(message.payload.start, message.payload.end)
      return
    case 'resolveUrlRequest':
      handleResolveUrlRequest(message.payload.requestId, message.payload.srcRaw)
      return
    case 'imageAction':
      options.onImageAction?.(message.payload)
      return
    case 'imagePreview':
      options.onImagePreview?.(message.payload.srcRaw, message.payload.resolvedUrl)
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
      options.onContentHeight?.(height)
      return
    }
    case 'caretViewport':
      options.onCaretViewport?.(message.payload.top, message.payload.bottom)
      return
    case 'panScroll':
      options.onPanScroll?.(message.payload.deltaY)
      return
    case 'debug': {
      const { scope, tag, detail } = message.payload
      const extra = detail ? ` ${JSON.stringify(detail)}` : ''
      logBridge(`${scope ?? 'webview'}: ${tag}${extra}`)
      return
    }
    case 'dismissKeyboard':
      options.onDismissKeyboard?.()
      return
    case 'confirmRequest': {
      const { requestId } = message.payload
      const respond = (confirmed: boolean) => {
        enqueueOrSend({
          type: 'confirmResponse',
          payload: { requestId, confirmed }
        })
      }
      const handler = options.onConfirmRequest
      if (handler) {
        handler(message.payload, respond)
      } else {
        respond(false)
      }
      return
    }
    case 'tableSheetRequest': {
      const handler = options.onTableSheetRequest
      if (handler) {
        handler(message.payload, (response) => {
          if (typeof __DEV__ !== 'undefined' && __DEV__) {
            logBridge(
              `tableSheetResponse ${response.action}${response.itemId ? ` item=${response.itemId}` : ''}`
            )
          }
          enqueueOrSend({ type: 'tableSheetResponse', payload: response })
        })
      } else {
        enqueueOrSend({
          type: 'tableSheetResponse',
          payload: { requestId: message.payload.requestId, action: 'dismiss' }
        })
      }
      return
    }
    case 'focus':
      options.onFocus?.()
      return
    case 'blur':
      options.onBlur?.()
      return
    default:
      return
  }
}
