import { logger } from '@baishou/shared'

/**
 * 解析 Bing 搜索结果中的 ck/a 跳转链接，还原目标 URL。
 * Bing 在 `u` 查询参数里存放 Base64 编码的目标地址（前两字符为版本前缀）。
 */
export function resolveBingClickThroughUrl(href: string): string {
  try {
    const link = new URL(href)
    const encodedTarget = link.searchParams.get('u')
    if (!encodedTarget || encodedTarget.length <= 2) {
      return href
    }

    const decoded = decodeBase64Utf8(encodedTarget.slice(2))
    if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
      return decoded
    }
    return href
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error)
    logger.warn('[BingSearchUrl] failed to resolve redirect:', detail)
    return href
  }
}

function decodeBase64Utf8(input: string): string {
  if (typeof atob === 'function') {
    return atob(input)
  }
  return Buffer.from(input, 'base64').toString('utf8')
}
