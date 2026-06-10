import { logger } from '@baishou/shared'
import { truncateSearchSnippet } from './web-content.util'

export interface ExaMcpSearchResult {
  title: string
  url: string
  snippet: string
}

export type ExaMcpDiagnostics = {
  engine: 'exa-mcp'
  query: string
  httpStatus?: number
  htmlBytes?: number
  parsedCount?: number
  error?: string
  detail?: string
}

const EXA_MCP_URL = 'https://mcp.exa.ai/mcp'
const REQUEST_TIMEOUT_MS = 25_000

interface ExaMcpRawResult {
  title?: string
  url?: string
  text?: string
}

function createFetchSignal(timeoutMs: number): AbortSignal {
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

/** 解析 Exa MCP 返回的 Title/URL/Text 文本块 */
export function parseExaMcpTextChunk(raw: string): ExaMcpRawResult[] {
  const items: ExaMcpRawResult[] = []

  for (const chunk of raw.split('\n\n')) {
    const lines = chunk.split('\n')
    let title = ''
    let url = ''
    let fullText = ''
    let textStartIndex = -1

    lines.forEach((line, index) => {
      if (line.startsWith('Title:')) {
        title = line.replace(/^Title:\s*/, '')
      } else if (line.startsWith('URL:')) {
        url = line.replace(/^URL:\s*/, '')
      } else if (line.startsWith('Text:') && textStartIndex === -1) {
        textStartIndex = index
        fullText = line.replace(/^Text:\s*/, '')
      }
    })

    if (textStartIndex !== -1) {
      const rest = lines.slice(textStartIndex + 1).join('\n')
      if (rest.trim().length > 0) {
        fullText = fullText ? `${fullText}\n${rest}` : rest
      }
    }

    if (title || url || fullText) {
      items.push({ title, url, text: fullText })
    }
  }

  return items
}

function extractMcpContentText(payload: string): string | null {
  try {
    const parsed = JSON.parse(payload) as {
      result?: { content?: Array<{ type?: string; text?: string }> }
    }
    const text = (parsed.result?.content || [])
      .map((item) => item.text?.trim() || '')
      .filter(Boolean)
      .join('\n\n')
    return text || null
  } catch {
    return null
  }
}

/** 解析 Exa MCP SSE 或直出 JSON 响应 */
export function parseExaMcpResponse(responseText: string): ExaMcpRawResult[] {
  const payloadTexts: string[] = []

  for (const line of responseText.split('\n')) {
    if (!line.startsWith('data: ')) continue
    const payload = line.slice(6).trim()
    if (!payload || payload === '[DONE]') continue
    const text = extractMcpContentText(payload)
    if (text) payloadTexts.push(text)
  }

  if (payloadTexts.length === 0) {
    const directText = extractMcpContentText(responseText)
    if (directText) payloadTexts.push(directText)
  }

  if (payloadTexts.length === 0 && responseText.includes('Title:')) {
    payloadTexts.push(responseText)
  }

  if (payloadTexts.length === 0 && responseText.trim().length > 0) {
    throw new Error('Exa MCP response parsing failed: no parseable content found')
  }

  return parseExaMcpTextChunk(payloadTexts.join('\n\n')).filter((item) =>
    Boolean(item.title || item.url || item.text)
  )
}

function toSearchResults(
  items: ExaMcpRawResult[],
  maxResults: number,
  maxSnippetLength?: number
): ExaMcpSearchResult[] {
  const results: ExaMcpSearchResult[] = []
  for (const item of items) {
    if (results.length >= maxResults) break
    const u = item.url?.trim() || ''
    const t = item.title?.trim() || ''
    let c = item.text?.trim() || ''
    if (maxSnippetLength && maxSnippetLength > 0) {
      c = truncateSearchSnippet(c, maxSnippetLength)
    }
    if (u && (t || c)) {
      results.push({ title: t || u, url: u, snippet: c || t })
    }
  }
  return results
}

/**
 * 通过 Exa 免费 MCP Server 搜索（无需 API Key）
 * Exa MCP 搜索提供方实现
 */
export async function searchExaMcp(
  query: string,
  maxResults: number,
  onDiagnostics?: (diag: ExaMcpDiagnostics) => void,
  maxSnippetLength?: number
): Promise<ExaMcpSearchResult[]> {
  const emit = (partial: Omit<ExaMcpDiagnostics, 'engine' | 'query'>) => {
    const diag: ExaMcpDiagnostics = { engine: 'exa-mcp', query, ...partial }
    onDiagnostics?.(diag)
    logger.info('[WebSearchService] Exa MCP diagnostics:', JSON.stringify(diag))
  }

  const requestBody = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'web_search_exa',
      arguments: {
        query,
        type: 'auto',
        numResults: maxResults,
        livecrawl: 'fallback'
      }
    }
  }

  const resp = await fetch(EXA_MCP_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody),
    signal: createFetchSignal(REQUEST_TIMEOUT_MS)
  })

  if (!resp.ok) {
    const text = await resp.text()
    emit({ httpStatus: resp.status, error: text.slice(0, 200) })
    throw new Error(`Exa MCP search failed: ${resp.status} ${text}`)
  }

  const responseText = await resp.text()
  const rawItems = parseExaMcpResponse(responseText)
  const results = toSearchResults(rawItems, maxResults, maxSnippetLength)

  emit({
    httpStatus: resp.status,
    htmlBytes: responseText.length,
    parsedCount: results.length,
    detail: `parsed ${results.length} results from MCP SSE`
  })

  return results
}
