import { describe, expect, it } from 'vitest'
import {
  applyInlineKnowledgeCitations,
  collectKnowledgeCitationsFromInvocations,
  contentHasKnowledgeCitationMarkers,
  decorateKnowledgeCitedTexts,
  formatKnowledgeCitationHeading,
  formatKnowledgeCitationLocation,
  knowledgeCitationDomId,
  parseKnowledgeCitationHref,
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

  it('should parse citation hash hrefs used by inline marks', () => {
    const href = `#${knowledgeCitationDomId('msg-1', 3)}`
    expect(parseKnowledgeCitationHref(href)).toEqual({ anchorKey: 'msg-1', index: 3 })
    expect(parseKnowledgeCitationHref('https://example.com')).toBeNull()
  })

  it('should format the citation dialog heading with notebook and location', () => {
    expect(
      formatKnowledgeCitationHeading(
        { notebookName: '手册', title: '深度关系', page: 12 },
        3
      )
    ).toBe('「3」 手册 · 深度关系（第 12 页）')
  })

  it('should link bracket numbers in the answer when citations exist', () => {
    const linked = applyInlineKnowledgeCitations('结论见 [1]，代码里的 `[2]` 不动。', 2, 'msg-1')
    expect(linked).toContain(`[「1」](#${knowledgeCitationDomId('msg-1', 1)})`)
    expect(linked).toContain('`[2]`')
    expect(contentHasKnowledgeCitationMarkers('结论见 [1]', 2)).toBe(true)
    expect(contentHasKnowledgeCitationMarkers('没有编号', 2)).toBe(false)
  })

  it('should append citation markers when the answer omitted them', () => {
    const [text] = decorateKnowledgeCitedTexts(['正文没有编号。'], 2, 'msg-1', {
      appendWhenMissing: true
    })
    expect(text).toContain('正文没有编号。')
    expect(text).toContain(`[「1」](#${knowledgeCitationDomId('msg-1', 1)})`)
    expect(text).toContain(`[「2」](#${knowledgeCitationDomId('msg-1', 2)})`)
  })

  it('should keep the model markers when the answer already cites', () => {
    const [text] = decorateKnowledgeCitedTexts(['见 [1]。'], 2, 'msg-1', {
      appendWhenMissing: true
    })
    expect(text).toBe(`见 [「1」](#${knowledgeCitationDomId('msg-1', 1)})。`)
  })

  it('should ignore the model [1] when the excerpt belongs to another sentence', () => {
    const [text] = decorateKnowledgeCitedTexts(
      [
        '清崎有两个爸爸，一个博士学历却一辈子为账单发愁。[1] 另一句讲别的事情。'
      ],
      1,
      'msg-1',
      {
        appendWhenMissing: true,
        citations: [
          {
            excerpt: '蒙太奇通过镜头组接创造新的意义',
            notebookName: '手册',
            title: '视听语言'
          }
        ]
      }
    )
    expect(text).not.toMatch(/两个爸爸[^。]*「1」/)
    expect(text).toContain(`\n\n[「1」](#${knowledgeCitationDomId('msg-1', 1)} "手册 · 视听语言")`)
  })

  it('should put each excerpt on the sentence that actually uses it even if the model wrote [1] twice', () => {
    const [text] = decorateKnowledgeCitedTexts(
      ['穷爸爸习惯说我可付不起。[1] 蒙太奇通过镜头组接创造意义。[1]'],
      2,
      'msg-1',
      {
        appendWhenMissing: true,
        citations: [
          {
            excerpt: '蒙太奇通过镜头组接创造新的意义',
            title: '视听语言'
          },
          {
            excerpt: '穷爸爸习惯说我可付不起，那是陈述句',
            title: '穷爸爸富爸爸'
          }
        ]
      }
    )
    const mark1 = `[「1」](#${knowledgeCitationDomId('msg-1', 1)}`
    const mark2 = `[「2」](#${knowledgeCitationDomId('msg-1', 2)}`
    expect(text?.indexOf(mark2)).toBeGreaterThan(-1)
    expect(text?.indexOf(mark2)).toBeLessThan(text?.indexOf('蒙太奇') ?? -1)
    expect(text?.indexOf(mark1)).toBeGreaterThan(text?.indexOf('蒙太奇') ?? -1)
  })

  it('should keep [1] inside code fences when rematching excerpts', () => {
    const [text] = decorateKnowledgeCitedTexts(
      ['见示例。[1]\n```\nconst n = [1]\n```\n蒙太奇通过镜头组接创造意义。'],
      1,
      'msg-1',
      {
        appendWhenMissing: true,
        citations: [{ excerpt: '蒙太奇通过镜头组接创造新的意义', title: '视听语言' }]
      }
    )
    const code = text?.match(/```[\s\S]*```/)?.[0] ?? ''
    expect(code).toContain('[1]')
    expect(text).not.toMatch(/见示例[^`\n]*「1」/)
    expect(text?.indexOf(`[「1」](#${knowledgeCitationDomId('msg-1', 1)}`)).toBeGreaterThan(
      text?.indexOf('蒙太奇') ?? -1
    )
  })

  it('should place a citation after the sentence that uses the excerpt', () => {
    const [text] = decorateKnowledgeCitedTexts(
      ['蒙太奇通过镜头组接创造意义。另一句讲别的事情。'],
      1,
      'msg-1',
      {
        appendWhenMissing: true,
        citations: [
          {
            excerpt: '蒙太奇通过镜头组接创造新的意义',
            notebookName: '手册',
            title: '视听语言'
          }
        ]
      }
    )
    const mark = `[「1」](#${knowledgeCitationDomId('msg-1', 1)} "手册 · 视听语言")`
    expect(text?.indexOf(mark)).toBeGreaterThan(-1)
    expect(text?.indexOf(mark)).toBeLessThan(text?.indexOf('另一句') ?? -1)
  })

  it('should leave unmatched citations at the end of the answer', () => {
    const [text] = decorateKnowledgeCitedTexts(['完全无关的正文。'], 1, 'msg-1', {
      appendWhenMissing: true,
      citations: [{ excerpt: '视听语言是电影艺术的基础理论' }]
    })
    expect(text).toBe(`完全无关的正文。\n\n[「1」](#${knowledgeCitationDomId('msg-1', 1)})`)
  })

  it('should not insert citation marks inside code fences', () => {
    const [text] = decorateKnowledgeCitedTexts(
      ['说明在下面。\n```\nconst value = montage\n```\n正文结束。'],
      1,
      'msg-1',
      { appendWhenMissing: true, citations: [{ excerpt: 'const value = montage' }] }
    )
    const code = text?.match(/```[\s\S]*```/)?.[0] ?? ''
    expect(code).not.toContain('「1」')
  })
})
