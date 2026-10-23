import { HELP_DOCS_QUICK_START_URL } from '@baishou/shared'

function helpDocsInAppHosts(): Set<string> {
  const host = new URL(HELP_DOCS_QUICK_START_URL).hostname
  const hosts = new Set([host])
  if (host.startsWith('www.')) {
    hosts.add(host.slice(4))
  } else {
    hosts.add(`www.${host}`)
  }
  return hosts
}

const HELP_DOCS_IN_APP_HOSTS = helpDocsInAppHosts()

export function isHelpDocsInAppUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
    return HELP_DOCS_IN_APP_HOSTS.has(parsed.hostname)
  } catch {
    return false
  }
}

export function isSafeExternalHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

export type HelpDocsWindowOpenDecision = { action: 'deny'; openExternalUrl?: string }

export function decideHelpDocsWindowOpen(url: string): HelpDocsWindowOpenDecision {
  if (isSafeExternalHttpUrl(url)) {
    return { action: 'deny', openExternalUrl: url }
  }
  return { action: 'deny' }
}

export type HelpDocsNavigationDecision = 'allow' | 'block' | { openExternalUrl: string }

export function decideHelpDocsNavigation(url: string): HelpDocsNavigationDecision {
  if (url === 'about:blank' || isHelpDocsInAppUrl(url)) return 'allow'
  if (isSafeExternalHttpUrl(url)) return { openExternalUrl: url }
  return 'block'
}

/** webview 导航拦截只读 preventDefault；不绑宿主 Event 的其余字段。 */
type HelpDocsNavigationEvent = {
  preventDefault: () => void
}

/** 与 will-navigate / will-redirect 实际回调一致：后两个位置参数已弃用但仍会传入。 */
type HelpDocsNavigationListener = (
  event: HelpDocsNavigationEvent,
  url: string,
  _isInPlace?: unknown,
  isMainFrame?: boolean
) => void

/**
 * 只声明本函数用到的方法与两个事件名。
 * on 必须写成方法：写成属性函数时事件联合会扩成 string，监听器参数变成 unknown，因逆变无法赋值。
 */
interface HelpDocsGuestContents {
  getType(): string
  setWindowOpenHandler(handler: (details: { url: string }) => { action: 'allow' | 'deny' }): void
  on(event: 'will-navigate' | 'will-redirect', listener: HelpDocsNavigationListener): void
}

export function installHelpDocsWebviewNavigation(
  contents: HelpDocsGuestContents,
  openExternal: (url: string) => void
): boolean {
  if (contents.getType() !== 'webview') return false

  contents.setWindowOpenHandler((details) => {
    const decision = decideHelpDocsWindowOpen(details.url)
    if (decision.openExternalUrl) openExternal(decision.openExternalUrl)
    return { action: 'deny' }
  })

  const leaveForBrowser = (
    event: { preventDefault: () => void },
    url: string,
    _third?: unknown,
    isMainFrame?: boolean
  ) => {
    if (isMainFrame === false) return
    const decision = decideHelpDocsNavigation(url)
    if (decision === 'allow') return
    event.preventDefault()
    if (typeof decision === 'object') openExternal(decision.openExternalUrl)
  }

  contents.on('will-navigate', leaveForBrowser)
  contents.on('will-redirect', leaveForBrowser)
  return true
}
