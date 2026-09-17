import { describe, expect, it, vi } from 'vitest'
import { knowledgeIngestUserMessage } from '../knowledge-ingest-user-error.util'

describe('knowledgeIngestUserMessage', () => {
  it('should translate source-not-embedded and leave other errors unchanged', () => {
    const t = vi.fn((key: string, fallback: string) =>
      key === 'knowledge.source_not_embedded' ? 'translated-not-embedded' : fallback
    )

    expect(knowledgeIngestUserMessage('source-not-embedded', t as never)).toBe(
      'translated-not-embedded'
    )
    expect(
      knowledgeIngestUserMessage(
        new Error(
          "Error invoking remote method 'knowledge:reprocess-source': Error: source-not-embedded"
        ),
        t as never
      )
    ).toBe('translated-not-embedded')
    expect(knowledgeIngestUserMessage('extracted text missing', t as never)).toBe(
      'extracted text missing'
    )
    expect(knowledgeIngestUserMessage('embedding-not-configured', t as never)).toBe(
      'embedding-not-configured'
    )
  })
})
