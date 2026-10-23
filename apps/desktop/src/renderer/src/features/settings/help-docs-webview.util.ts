/** Chromium `net::ERR_ABORTED`：重定向或后一次导航取消了当前加载，页面仍可能打开成功。 */
export const CHROMIUM_ERR_ABORTED = -3

export type HelpDocsWebviewFailLoad = {
  isMainFrame?: boolean
  errorCode?: number | string
}

export function isHelpDocsMainFrameFailure(event: HelpDocsWebviewFailLoad): boolean {
  if (event.isMainFrame !== true) return false
  const errorCode = Number(event.errorCode)
  if (!Number.isFinite(errorCode) || errorCode >= 0) return false
  return errorCode !== CHROMIUM_ERR_ABORTED
}

export function isHelpDocsSuccessfulDocumentUrl(url: string | undefined | null): boolean {
  if (!url) return false
  return url.startsWith('https://') || url.startsWith('http://')
}

/** Electron webview 才有 getURL；DOM 里 createElement('webview') 只是 HTMLElement */
export interface HelpDocsWebviewHost {
  getURL?: () => string
}

export function isHelpDocsWebviewHost(value: unknown): value is HelpDocsWebviewHost {
  if (typeof value !== 'object' || value === null) return false
  if (!('getURL' in value)) return false
  return typeof value.getURL === 'function'
}

export function readHelpDocsWebviewUrl(webview: HelpDocsWebviewHost): string {
  return typeof webview.getURL === 'function' ? webview.getURL() : ''
}
