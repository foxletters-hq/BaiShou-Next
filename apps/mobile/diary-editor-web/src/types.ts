import type {
  DiaryCmFromWebViewMessage,
  DiaryCmInitPayload,
  DiaryCmToWebViewMessage
} from '@baishou/ui/shared/diary-codemirror/types'

/** RN → WebView 消息（见方案 §7.1） */
export type RnToWebViewMessage = DiaryCmToWebViewMessage

/** WebView → RN 消息（见方案 §7.2） */
export type WebViewToRnMessage = DiaryCmFromWebViewMessage

export type InitPayload = DiaryCmInitPayload

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void
    }
  }
}

export {}
