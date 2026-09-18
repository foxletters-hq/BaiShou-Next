import { logger } from '@baishou/shared'
import { HtmlToMarkdownConverter } from './html-to-markdown'
import { createFetchSignal, getBrowserHeaders } from './web-search-http.util'
import type { SearchDiagnostics, SearchResult } from './web-search.types'

export function parseDuckDuckGoResults(html: string, maxResults: number): SearchResult[] {
  const results: SearchResult[] = []
  const blocks = html.split('class="result__title"')

  for (let i = 1; i < blocks.length; i++) {
    if (results.length >= maxResults) break
    const block = blocks[i] || ''

    const aTagStart = block.indexOf('<a')
    if (aTagStart === -1) continue
    const aTagEnd = block.indexOf('</a>', aTagStart)
    if (aTagEnd === -1) continue

    const aTag = block.substring(aTagStart, aTagEnd + 4)
    const urlMatch = /href="([^"]+)"/.exec(aTag)
    const rawUrl = urlMatch?.[1] || ''

    const titleMatch = />([\s\S]*?)<\/a>/.exec(aTag)
    const title = titleMatch ? titleMatch[1]!.replace(/<[^>]+>/g, '').trim() : ''

    const snippetStart = block.indexOf('class="result__snippet"')
    let snippetRaw = ''
    if (snippetStart !== -1) {
      const snippetEnd = block.indexOf('</a>', snippetStart)
      if (snippetEnd !== -1) {
        const snipTag = block.substring(snippetStart, snippetEnd + 4)
        const sMatch = />([\s\S]*?)<\/a>/.exec(snipTag)
        snippetRaw = sMatch ? sMatch[1]! : ''
      }
    }

    const snippetClean = snippetRaw
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    let actualUrl = rawUrl

    try {
      const uUrl = rawUrl.startsWith('//') ? 'https:' + rawUrl : rawUrl
      const parsed = new URL(uUrl)
      if (parsed.searchParams.has('uddg')) {
        const uddg = parsed.searchParams.get('uddg')
        if (uddg) actualUrl = decodeURIComponent(uddg)
      }
    } catch {
      // 解析失败时保留原始跳转地址，避免整条结果被丢掉
    }

    if (actualUrl && title) {
      const decodedSnippet = snippetClean.replace(/&#(\d+);|&[a-z]+;/g, (m) =>
        HtmlToMarkdownConverter.convert(m)
      )
      results.push({
        title: title.replace(/&#(\d+);|&[a-z]+;/g, (m) => HtmlToMarkdownConverter.convert(m)),
        url: actualUrl,
        snippet: decodedSnippet || title
      })
    }
  }

  return results
}

export async function searchDuckDuckGo(
  query: string,
  maxResults: number,
  onDiagnostics?: (diag: SearchDiagnostics) => void
): Promise<SearchResult[]> {
  const url = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query)
  const emit = (partial: Omit<SearchDiagnostics, 'engine' | 'query'>) => {
    const diag: SearchDiagnostics = { engine: 'duckduckgo', query, ...partial }
    onDiagnostics?.(diag)
    logger.info('[WebSearchService] DDG diagnostics:', JSON.stringify(diag))
  }

  const maxRetries = 2
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const resp = await fetch(url, {
        headers: getBrowserHeaders(),
        signal: createFetchSignal(10000)
      })
      if (resp.status !== 200) {
        emit({
          httpStatus: resp.status,
          error: `HTTP ${resp.status}`,
          detail: i < maxRetries ? `retry ${i + 1}/${maxRetries}` : 'max retries reached'
        })
        if (i === maxRetries) throw new Error('DuckDuckGo blocked request. Status: ' + resp.status)
        await new Promise((r) => setTimeout(r, 1000))
        continue
      }
      const html = await resp.text()
      const results = parseDuckDuckGoResults(html, maxResults)
      const titleBlocks = (html.match(/class="result__title"/g) || []).length
      emit({
        httpStatus: resp.status,
        htmlBytes: html.length,
        parsedCount: results.length,
        detail:
          results.length === 0
            ? `HTML has ${titleBlocks} result__title blocks but parser returned 0`
            : `parsed ${results.length} results`
      })
      return results
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      emit({ error: msg, detail: i < maxRetries ? `retry ${i + 1}/${maxRetries}` : 'failed' })
      if (i === maxRetries) throw e
    }
  }
  return []
}
