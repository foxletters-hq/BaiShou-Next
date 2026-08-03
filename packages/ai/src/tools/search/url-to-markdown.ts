import { HtmlToMarkdownConverter } from './html-to-markdown'
import { EMPTY_WEB_PAGE_MESSAGE } from './web-content.util'
import { assertSafePublicHttpUrl } from '@baishou/shared'

export interface FetchUrlAsMarkdownResult {
  markdown: string
  title: string
  finalUrl: string
  contentType: string | null
}

export interface FetchUrlAsMarkdownOptions {
  /** 可注入 fetch（测试 / 自定义 UA） */
  fetchImpl?: typeof fetch
  headers?: Record<string, string>
  /** 超时毫秒；默认 30s */
  timeoutMs?: number
  /** 跳过私网/SSRF 检查（仅测试） */
  skipSafeUrlCheck?: boolean
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!m?.[1]) return ''
  return m[1]
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 拉取 URL 并转为轻量 Markdown，供 url_read 工具与知识库 URL 导入共用。
 */
export async function fetchUrlAsMarkdown(
  url: string,
  options?: FetchUrlAsMarkdownOptions
): Promise<FetchUrlAsMarkdownResult> {
  const trimmed = url?.trim()
  if (!trimmed) {
    throw new Error('url is required')
  }

  if (!options?.skipSafeUrlCheck) {
    assertSafePublicHttpUrl(trimmed)
  }

  const fetchImpl = options?.fetchImpl ?? fetch
  const timeoutMs = options?.timeoutMs ?? 30_000
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer =
    controller && timeoutMs > 0
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null

  try {
    const response = await fetchImpl(trimmed, {
      signal: controller?.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
        'User-Agent': 'BaiShouKnowledge/1.0',
        ...options?.headers
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: HTTP ${response.status} ${response.statusText}`)
    }

    const contentType = response.headers?.get?.('content-type') ?? null
    const raw = await response.text()
    const finalUrl =
      typeof (response as { url?: string }).url === 'string'
        ? (response as { url: string }).url
        : trimmed

    // 重定向后再次校验，防止跳进私网
    if (!options?.skipSafeUrlCheck && finalUrl !== trimmed) {
      assertSafePublicHttpUrl(finalUrl)
    }

    let markdown: string
    let title = ''

    if (contentType?.includes('text/plain') || contentType?.includes('text/markdown')) {
      markdown = raw.trim()
    } else {
      title = extractTitle(raw)
      markdown = HtmlToMarkdownConverter.convert(raw).trim()
    }

    if (!markdown) {
      return {
        markdown: EMPTY_WEB_PAGE_MESSAGE,
        title: title || trimmed,
        finalUrl,
        contentType
      }
    }

    return {
      markdown,
      title: title || trimmed,
      finalUrl,
      contentType
    }
  } finally {
    if (timer) clearTimeout(timer)
  }
}
