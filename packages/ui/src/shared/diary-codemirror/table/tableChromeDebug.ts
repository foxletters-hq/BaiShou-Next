type TableChromeDebugDetail = Record<string, unknown>

declare global {
  interface Window {
    __tableChromeDebug?: boolean
  }
}

function isDebugEnabled(): boolean {
  if (typeof window !== 'undefined' && window.__tableChromeDebug === true) return true
  if (typeof __DEV__ !== 'undefined' && __DEV__) return true
  return false
}

/** 表格把手 / 菜单调试：console + 转发到 RN Bridge（Metro 可见 [DiaryEditor Bridge] tableChrome: ...） */
export function logTableChrome(tag: string, detail?: TableChromeDebugDetail): void {
  if (!isDebugEnabled()) return

  const payload = detail ?? {}
  const line = `[table-chrome] ${tag}${Object.keys(payload).length ? ` ${JSON.stringify(payload)}` : ''}`
  if (typeof console !== 'undefined') {
    console.log(line)
  }

  try {
    window.ReactNativeWebView?.postMessage(
      JSON.stringify({
        type: 'debug',
        payload: { scope: 'tableChrome', tag, detail: payload }
      })
    )
  } catch {
    // ignore
  }
}
