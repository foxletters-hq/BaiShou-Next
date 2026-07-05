type DiaryBridgeDebugDetail = Record<string, unknown>

declare global {
  interface Window {
    __diaryBridgeDebug?: boolean
  }
  // eslint-disable-next-line no-var
  var __DEV__: boolean | undefined
}

function isDebugEnabled(): boolean {
  if (typeof window !== 'undefined' && window.__diaryBridgeDebug === false) return false
  if (typeof window !== 'undefined' && window.__diaryBridgeDebug === true) return true
  if (typeof __DEV__ !== 'undefined' && __DEV__) return true
  return false
}

/** WebView → RN 调试日志（Metro 可见 [DiaryEditor Bridge] scope: tag） */
export function logDiaryBridge(scope: string, tag: string, detail?: DiaryBridgeDebugDetail): void {
  if (!isDebugEnabled()) return

  const payload = detail ?? {}
  const line = `[${scope}] ${tag}${Object.keys(payload).length ? ` ${JSON.stringify(payload)}` : ''}`
  if (typeof console !== 'undefined') {
    console.log(line)
  }

  try {
    window.ReactNativeWebView?.postMessage(
      JSON.stringify({
        type: 'debug',
        payload: { scope, tag, detail: payload }
      })
    )
  } catch {
    // ignore
  }
}
