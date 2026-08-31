export type FetchedWebPageIssue = 'login' | 'empty-shell'

export interface FetchedWebPageAssessment {
  usable: boolean
  issue: FetchedWebPageIssue | null
}

const LOGIN_PATH =
  /\/(login|signin|sign-in|signup|sign-up|auth|sso|account\/login)(\/|$)/i

const SHELL_HINT =
  /加载中|请先登录|请登录|登录后|sign in to continue|log in to continue|javascript is required/i

function pathAndSearch(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return url
  }
}

export function isFetchedLoginUrl(url: string): boolean {
  const target = pathAndSearch(url)
  return LOGIN_PATH.test(target) || /[?&](callbackUrl|redirect|returnUrl|next)=/i.test(target)
}

export function stripMarkdownChrome(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/^#+\s+/gm, '')
    .replace(/[`*_>#|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function assessFetchedWebPage(input: {
  requestedUrl?: string
  finalUrl?: string
  markdown: string
}): FetchedWebPageAssessment {
  const urls = [input.requestedUrl, input.finalUrl].filter(Boolean) as string[]
  if (urls.some((url) => isFetchedLoginUrl(url))) {
    return { usable: false, issue: 'login' }
  }
  const body = stripMarkdownChrome(input.markdown)
  if (!body) return { usable: false, issue: 'empty-shell' }
  if (SHELL_HINT.test(body) && body.length < 400) {
    return { usable: false, issue: 'empty-shell' }
  }
  return { usable: true, issue: null }
}

export function fetchedWebPageIssueMessage(issue: FetchedWebPageIssue | null): string {
  if (issue === 'login') {
    return '目标网页需要登录，无法直接抓取'
  }
  if (issue === 'empty-shell') {
    return '这个页面主要靠浏览器渲染，只抓到导航或加载中的外壳，没有可用正文。'
  }
  return ''
}
