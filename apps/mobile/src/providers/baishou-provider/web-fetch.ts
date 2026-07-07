import { htmlToPlainText } from '@baishou/ai'

const MOBILE_BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9'
}

const WEB_FETCH_TIMEOUT_MS = 15_000

function createWebFetchSignal(timeoutMs: number): AbortSignal {
  if (
    typeof AbortSignal !== 'undefined' &&
    'timeout' in AbortSignal &&
    typeof AbortSignal.timeout === 'function'
  ) {
    return AbortSignal.timeout(timeoutMs)
  }
  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

/** 获取搜索页原始 HTML（供 local-bing / local-google 解析，对齐桌面端 fetchSearchPage 契约） */
export async function fetchSearchPageHtml(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: MOBILE_BROWSER_HEADERS,
      signal: createWebFetchSignal(WEB_FETCH_TIMEOUT_MS)
    })
    if (!response.ok) {
      return ''
    }
    return await response.text()
  } catch {
    // 单个 URL 失败不影响搜索主流程，静默跳过
    return ''
  }
}

/** 使用 native fetch 获取网页内容并转换为正文（长度限制由工具层按设置处理） */
export async function webFetchContent(url: string): Promise<string> {
  const html = await fetchSearchPageHtml(url)
  if (!html) {
    return 'The webpage is empty or cannot be parsed textually.'
  }
  try {
    const plainText = htmlToPlainText(html)
    return plainText || 'The webpage is empty or cannot be parsed textually.'
  } catch {
    return 'The webpage is empty or cannot be parsed textually.'
  }
}
