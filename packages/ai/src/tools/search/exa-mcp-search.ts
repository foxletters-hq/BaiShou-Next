import { logger } from '@baishou/shared'
import { truncateSearchSnippet } from './web-content.util'

/**
 * Exa 免费 MCP Server 搜索（无需 API Key）
 * @see https://docs.exa.ai/docs/reference/exa-mcp
 * @see https://github.com/exa-labs/exa-mcp-server
 */

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

/** web_search_exa 工具返回的纯文本字段标签 */
const LABELED_FIELD = /^(Title|URL|Published Date|Text):\s*(.*)$/u

const EXA_MCP_ENDPOINT = 'https://mcp.exa.ai/mcp'
const EXA_MCP_TOOL = 'web_search_exa'
const REQUEST_TIMEOUT_MS = 25_000

interface ExaLabeledHit {
  title: string
  url: string
  body: string
}

interface McpTextContent {
  type?: string
  text?: string
}

interface JsonRpcToolResult {
  result?: {
    content?: McpTextContent[]
  }
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

/** 将 web_search_exa 的一段纯文本块解析为结构化命中 */
export function parseExaLabeledResultBlocks(raw: string): ExaLabeledHit[] {
  const segments = raw
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter(Boolean)

  const hits: ExaLabeledHit[] = []

  for (const segment of segments) {
    const hit = parseOneLabeledSegment(segment)
    if (hit.title || hit.url || hit.body) {
      hits.push(hit)
    }
  }

  return hits
}

function parseOneLabeledSegment(segment: string): ExaLabeledHit {
  const hit: ExaLabeledHit = { title: '', url: '', body: '' }
  const lines = segment.split('\n')
  const bodyLines: string[] = []
  let inBody = false

  for (const line of lines) {
    const match = line.match(LABELED_FIELD)
    if (!match) {
      if (inBody) bodyLines.push(line)
      continue
    }

    const label = match[1]!
    const value = (match[2] ?? '').trim()
    inBody = false

    switch (label) {
      case 'Title':
        hit.title = value
        break
      case 'URL':
        hit.url = value
        break
      case 'Text':
        inBody = true
        if (value) bodyLines.push(value)
        break
      default:
        break
    }
  }

  hit.body = bodyLines.join('\n').trim()
  return hit
}

function collectTextFromJsonRpcPayload(payload: string): string[] {
  let parsed: JsonRpcToolResult
  try {
    parsed = JSON.parse(payload) as JsonRpcToolResult
  } catch {
    return []
  }

  const chunks = parsed.result?.content ?? []
  const texts: string[] = []
  for (const chunk of chunks) {
    if (chunk?.type === 'text' && typeof chunk.text === 'string') {
      const trimmed = chunk.text.trim()
      if (trimmed) texts.push(trimmed)
    }
  }
  return texts
}

function* iterateSsePayloads(transportBody: string): Generator<string> {
  for (const line of transportBody.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue
    const payload = line.slice(5).trim()
    if (!payload || payload === '[DONE]') continue
    yield payload
  }
}

/**
 * 解析 Exa MCP Streamable HTTP 响应（SSE 或直出 JSON-RPC）
 * @see https://modelcontextprotocol.io/specification/2025-03-26/basic/transports
 */
export function decodeExaMcpTransport(transportBody: string): ExaLabeledHit[] {
  const toolTexts: string[] = []

  for (const payload of iterateSsePayloads(transportBody)) {
    toolTexts.push(...collectTextFromJsonRpcPayload(payload))
  }

  if (toolTexts.length === 0) {
    toolTexts.push(...collectTextFromJsonRpcPayload(transportBody))
  }

  if (toolTexts.length === 0 && transportBody.includes('Title:')) {
    toolTexts.push(transportBody)
  }

  if (toolTexts.length === 0 && transportBody.trim().length > 0) {
    throw new Error('Exa MCP: no tool result text in response')
  }

  return parseExaLabeledResultBlocks(toolTexts.join('\n\n')).filter(
    (hit) => hit.title || hit.url || hit.body
  )
}

/** @deprecated 保留测试兼容别名 */
export const parseExaMcpTextChunk = parseExaLabeledResultBlocks

/** @deprecated 保留测试兼容别名 */
export function parseExaMcpResponse(responseText: string): Array<{
  title?: string
  url?: string
  text?: string
}> {
  return decodeExaMcpTransport(responseText).map((hit) => ({
    title: hit.title,
    url: hit.url,
    text: hit.body
  }))
}

function toSearchResults(
  hits: ExaLabeledHit[],
  maxResults: number,
  maxSnippetLength?: number
): ExaMcpSearchResult[] {
  const results: ExaMcpSearchResult[] = []

  for (const hit of hits) {
    if (results.length >= maxResults) break

    const url = hit.url.trim()
    const title = hit.title.trim()
    let snippet = hit.body.trim()

    if (maxSnippetLength && maxSnippetLength > 0) {
      snippet = truncateSearchSnippet(snippet, maxSnippetLength)
    }

    if (url && (title || snippet)) {
      results.push({ title: title || url, url, snippet: snippet || title })
    }
  }

  return results
}

function buildMcpSearchRequest(query: string, maxResults: number): object {
  return {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: EXA_MCP_TOOL,
      arguments: {
        query,
        type: 'auto',
        numResults: maxResults,
        livecrawl: 'fallback'
      }
    }
  }
}

export async function searchExaMcp(
  query: string,
  maxResults: number,
  onDiagnostics?: (diag: ExaMcpDiagnostics) => void,
  maxSnippetLength?: number
): Promise<ExaMcpSearchResult[]> {
  const emit = (partial: Omit<ExaMcpDiagnostics, 'engine' | 'query'>) => {
    const diag: ExaMcpDiagnostics = { engine: 'exa-mcp', query, ...partial }
    onDiagnostics?.(diag)
    logger.info('[ExaMcpSearch] diagnostics:', JSON.stringify(diag))
  }

  const response = await fetch(EXA_MCP_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(buildMcpSearchRequest(query, maxResults)),
    signal: createFetchSignal(REQUEST_TIMEOUT_MS)
  })

  if (!response.ok) {
    const text = await response.text()
    emit({ httpStatus: response.status, error: text.slice(0, 200) })
    throw new Error(`Exa MCP search failed: ${response.status} ${text}`)
  }

  const transportBody = await response.text()
  const hits = decodeExaMcpTransport(transportBody)
  const results = toSearchResults(hits, maxResults, maxSnippetLength)

  emit({
    httpStatus: response.status,
    htmlBytes: transportBody.length,
    parsedCount: results.length,
    detail: `decoded ${results.length} hit(s) from MCP transport`
  })

  return results
}
