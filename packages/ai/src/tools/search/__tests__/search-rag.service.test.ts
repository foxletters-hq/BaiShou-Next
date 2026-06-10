import { describe, it, expect, vi } from 'vitest'
import { SearchRagService } from '../search-rag.service'
import type { ToolEmbeddingService } from '../../agent.tool'

function mockEmbeddingService(impl: (text: string) => number[] | null): ToolEmbeddingService {
  return {
    isConfigured: true,
    embedQuery: vi.fn(async (text: string) => impl(text)),
    embedText: vi.fn()
  }
}

describe('SearchRagService.compress', () => {
  it('returns embeddingSucceeded=false when query embedding fails', async () => {
    const embeddingService = mockEmbeddingService(() => null)

    const output = await SearchRagService.compress({
      query: 'news today',
      results: [{ title: 'A', url: 'https://a.com', content: 'Long news body text here.' }],
      embeddingService
    })

    expect(output.embeddingSucceeded).toBe(false)
    expect(output.results).toEqual([])
  })

  it('returns best chunk content instead of full page text when embedding succeeds', async () => {
    const embeddingService = mockEmbeddingService((text) => {
      if (text.includes('relevant chunk')) return [1, 0, 0]
      if (text.includes('news today')) return [1, 0, 0]
      return [0, 1, 0]
    })

    const filler = 'Irrelevant intro line.\n'.repeat(40)
    const output = await SearchRagService.compress({
      query: 'news today',
      results: [
        {
          title: 'News',
          url: 'https://news.com',
          content: `${filler}\nThis is the relevant chunk for the query.\n\n${filler}`
        }
      ],
      embeddingService,
      maxSnippetLength: 500
    })

    expect(output.embeddingSucceeded).toBe(true)
    expect(output.results).toHaveLength(1)
    expect(output.results[0]!.content).toContain('relevant chunk')
  })

  it('returns embeddingSucceeded=false when all chunk embeddings fail', async () => {
    const embeddingService = mockEmbeddingService((text) =>
      text.includes('news today') ? [1, 0, 0] : null
    )

    const output = await SearchRagService.compress({
      query: 'news today',
      results: [
        { title: 'A', url: 'https://a.com', content: 'Some page content without matches.' }
      ],
      embeddingService
    })

    expect(output.embeddingSucceeded).toBe(false)
    expect(output.results).toEqual([])
  })

  it('truncates best chunk content to maxSnippetLength', async () => {
    const embeddingService = mockEmbeddingService((text) => {
      if (text.includes('target query')) return [1, 0, 0]
      return [0.9, 0.1, 0]
    })

    const longChunk = 'z'.repeat(700)
    const output = await SearchRagService.compress({
      query: 'target query',
      results: [{ title: 'A', url: 'https://a.com', content: longChunk }],
      embeddingService,
      maxSnippetLength: 200
    })

    expect(output.embeddingSucceeded).toBe(true)
    expect(output.results[0]!.content.length).toBeLessThanOrEqual(200 + 50)
    expect(output.results[0]!.content).toContain('truncated')
  })
})
