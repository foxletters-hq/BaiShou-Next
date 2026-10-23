import { logger } from '@baishou/shared'
import { cleanApiKey, createFetchSignal } from './web-search-http.util'
import type { SearchDiagnostics, SearchEngineType, SearchResult } from './web-search.types'

function emitDiagnostics(
  engine: SearchEngineType,
  query: string,
  label: string,
  onDiagnostics: ((diag: SearchDiagnostics) => void) | undefined,
  partial: Omit<SearchDiagnostics, 'engine' | 'query'>
): void {
  const diag: SearchDiagnostics = { engine, query, ...partial }
  onDiagnostics?.(diag)
  logger.info(`[WebSearchService] ${label} diagnostics:`, JSON.stringify(diag))
}

export async function searchExa(
  query: string,
  maxResults: number,
  apiKey?: string,
  onDiagnostics?: (diag: SearchDiagnostics) => void
): Promise<SearchResult[]> {
  const cleanKey = cleanApiKey(apiKey)
  const emit = (partial: Omit<SearchDiagnostics, 'engine' | 'query'>) =>
    emitDiagnostics('exa', query, 'Exa', onDiagnostics, partial)

  if (!cleanKey) {
    emit({ error: 'Exa API key is missing or invalid.' })
    throw new Error('Exa API key is missing or invalid.')
  }

  const resp = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': cleanKey
    },
    signal: createFetchSignal(15000),
    body: JSON.stringify({
      query,
      numResults: maxResults,
      contents: { text: true }
    })
  })

  if (!resp.ok) {
    const text = await resp.text()
    emit({ httpStatus: resp.status, error: text.slice(0, 200) })
    throw new Error('Exa search failed: ' + resp.status + ' ' + text)
  }

  const data = (await resp.json()) as {
    results?: Array<{ title?: string | null; url?: string; text?: string }>
  }
  const resultsRaw = Array.isArray(data.results) ? data.results : []
  const results: SearchResult[] = []

  for (const item of resultsRaw) {
    if (results.length >= maxResults) break
    const t = item.title?.trim() || ''
    const u = item.url?.trim() || ''
    const c = item.text?.trim() || ''
    if (u && (t || c)) {
      results.push({ title: t || u, url: u, snippet: c || t })
    }
  }

  emit({ httpStatus: resp.status, parsedCount: results.length })
  return results
}

export async function searchAnysearch(
  query: string,
  maxResults: number,
  apiKey?: string,
  onDiagnostics?: (diag: SearchDiagnostics) => void
): Promise<SearchResult[]> {
  const cleanKey = cleanApiKey(apiKey)
  const emit = (partial: Omit<SearchDiagnostics, 'engine' | 'query'>) =>
    emitDiagnostics('anysearch', query, 'AnySearch', onDiagnostics, partial)

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cleanKey) {
    headers.Authorization = 'Bearer ' + cleanKey
  }

  const resp = await fetch('https://api.anysearch.com/v1/search', {
    method: 'POST',
    headers,
    signal: createFetchSignal(15000),
    body: JSON.stringify({
      query,
      max_results: Math.min(Math.max(maxResults, 1), 100),
      zone: 'cn',
      language: 'zh-CN'
    })
  })

  if (!resp.ok) {
    const text = await resp.text()
    emit({ httpStatus: resp.status, error: text.slice(0, 200) })
    throw new Error('AnySearch failed: ' + resp.status + ' ' + text)
  }

  const data = (await resp.json()) as {
    code?: number
    message?: string
    data?: {
      results?: Array<{
        title?: string | null
        url?: string
        snippet?: string
        content?: string
      }>
    }
  }

  if (data.code !== undefined && data.code !== 0) {
    emit({ error: data.message || `code=${data.code}` })
    throw new Error('AnySearch API error: ' + (data.message || String(data.code)))
  }

  const resultsRaw = Array.isArray(data.data?.results) ? data.data.results : []
  const results: SearchResult[] = []

  for (const item of resultsRaw) {
    if (results.length >= maxResults) break
    const t = item.title?.trim() || ''
    const u = item.url?.trim() || ''
    const snippet = item.snippet?.trim() || ''
    const content = item.content?.trim() || ''
    const body = content || snippet
    if (u && (t || body)) {
      results.push({ title: t || u, url: u, snippet: body || t })
    }
  }

  emit({ httpStatus: resp.status, parsedCount: results.length })
  return results
}

export async function searchTavily(
  query: string,
  maxResults: number,
  apiKey?: string,
  onDiagnostics?: (diag: SearchDiagnostics) => void
): Promise<SearchResult[]> {
  const cleanKey = cleanApiKey(apiKey)
  const emit = (partial: Omit<SearchDiagnostics, 'engine' | 'query'>) =>
    emitDiagnostics('tavily', query, 'Tavily', onDiagnostics, partial)

  if (!cleanKey) {
    emit({ error: 'Tavily API key is missing or invalid.' })
    throw new Error('Tavily API key is missing or invalid.')
  }

  const resp = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + cleanKey
    },
    signal: createFetchSignal(15000),
    body: JSON.stringify({
      query,
      max_results: maxResults,
      search_depth: 'basic',
      include_answer: false
    })
  })

  if (!resp.ok) {
    const text = await resp.text()
    emit({ httpStatus: resp.status, error: text.slice(0, 200) })
    throw new Error('Tavily search failed: ' + resp.status + ' ' + text)
  }

  const data = (await resp.json()) as any
  const resultsRaw = Array.isArray(data.results) ? data.results : []
  const results: SearchResult[] = []

  for (const item of resultsRaw) {
    if (results.length >= maxResults) break
    const t = item.title?.trim() || ''
    const u = item.url?.trim() || ''
    const c = item.content?.trim() || ''
    if (t && u) {
      results.push({ title: t, url: u, snippet: c })
    }
  }

  emit({ httpStatus: resp.status, parsedCount: results.length })
  return results
}
