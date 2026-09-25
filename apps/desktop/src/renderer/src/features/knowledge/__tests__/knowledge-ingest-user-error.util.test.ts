import { describe, expect, it, vi } from 'vitest'
import { knowledgeIngestUserMessage } from '../knowledge-ingest-user-error.util'

describe('knowledgeIngestUserMessage', () => {
  it('should translate known ingest error codes and keep unknown text', () => {
    const t = vi.fn((key: string, fallback: string) => key)

    expect(knowledgeIngestUserMessage('source-not-embedded', t as never)).toBe(
      'knowledge.source_not_embedded'
    )
    expect(
      knowledgeIngestUserMessage(
        new Error(
          "Error invoking remote method 'knowledge:reprocess-source': Error: source-not-embedded"
        ),
        t as never
      )
    ).toBe('knowledge.source_not_embedded')
    expect(knowledgeIngestUserMessage('graph-extract-not-configured', t as never)).toBe(
      'knowledge.graph_extract_not_configured'
    )
    expect(knowledgeIngestUserMessage('extracted text missing', t as never)).toBe(
      'knowledge.extracted_text_missing'
    )
    expect(knowledgeIngestUserMessage('embedding-not-configured', t as never)).toBe(
      'knowledge.embedding_not_configured'
    )
    expect(knowledgeIngestUserMessage('graph-extract-window-timeout', t as never)).toBe(
      'knowledge.graph_extract_window_timeout'
    )
    expect(knowledgeIngestUserMessage('rate limited by provider', t as never)).toBe(
      'agent.error.rate_limit'
    )
  })

  it('should localize a graph node-embed payment error', () => {
    const t = vi.fn((key: string, fallback: string) => key)
    expect(
      knowledgeIngestUserMessage('graph-step:node-embed:Payment Required', t as never)
    ).toBe('agent.error.quota')
  })
})
