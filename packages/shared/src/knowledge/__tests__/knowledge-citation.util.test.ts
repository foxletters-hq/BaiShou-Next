import { describe, expect, it } from 'vitest'
import {
  collectKnowledgeCitationsFromInvocations,
  formatKnowledgeCitationLocation,
  parseKnowledgeSearchToolResult
} from '../knowledge-citation.util'

describe('knowledge-citation.util', () => {
  it('parses knowledge_search JSON results', () => {
    const parsed = parseKnowledgeSearchToolResult(
      JSON.stringify({
        text: '## 知识库检索',
        citations: [
          {
            notebookId: 'nb1',
            notebookName: '手册',
            title: '视听语言',
            excerpt: '蒙太奇',
            offset: 12
          }
        ]
      })
    )
    expect(parsed?.text).toContain('知识库检索')
    expect(parsed?.citations).toEqual([
      {
        notebookId: 'nb1',
        notebookName: '手册',
        title: '视听语言',
        excerpt: '蒙太奇',
        page: undefined,
        offset: 12,
        chunkIndex: undefined,
        sourceId: undefined
      }
    ])
  })

  it('collects citations only from knowledge_search invocations', () => {
    const citations = collectKnowledgeCitationsFromInvocations([
      { toolName: 'web_search', result: { citations: [{ title: '网页' }] } },
      {
        toolName: 'knowledge_search',
        result: {
          text: 'ok',
          citations: [{ notebookName: '手册', title: '报告', page: 3 }]
        }
      }
    ])
    expect(citations).toEqual([
      {
        notebookId: undefined,
        notebookName: '手册',
        title: '报告',
        excerpt: undefined,
        page: 3,
        offset: undefined,
        chunkIndex: undefined,
        sourceId: undefined
      }
    ])
    expect(citations[0] && formatKnowledgeCitationLocation(citations[0])).toBe('第 3 页')
  })
})
