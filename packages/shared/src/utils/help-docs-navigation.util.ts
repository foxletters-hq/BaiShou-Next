import { HELP_DOCS_QUICK_START_URL } from '../constants/github.constants'

function helpDocsInAppHosts(): Set<string> {
  const host = new URL(HELP_DOCS_QUICK_START_URL).hostname
  const hosts = new Set([host])
  if (host.startsWith('www.')) hosts.add(host.slice(4))
  else hosts.add(`www.${host}`)
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

export type HelpDocsNavigationDecision = 'allow' | 'block' | { openExternalUrl: string }

export function decideHelpDocsNavigation(url: string): HelpDocsNavigationDecision {
  if (url === 'about:blank' || isHelpDocsInAppUrl(url)) return 'allow'
  if (isSafeExternalHttpUrl(url)) return { openExternalUrl: url }
  return 'block'
}

export function isHelpDocsSuccessfulDocumentUrl(url: string | undefined | null): boolean {
  if (!url) return false
  return url.startsWith('https://') || url.startsWith('http://')
}
