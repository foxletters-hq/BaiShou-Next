import { describe, expect, it } from 'vitest'
import {
  formatKnowledgeBytesMb,
  knowledgeIngestUserMessage,
  knowledgeSourceCanReembedGraph,
  knowledgeSourceCanRetry,
  knowledgeSourceStatusLabel
} from '../knowledge-screen.util'

describe('knowledge-screen.util', () => {
  it('should format bytes as megabytes', () => {
    expect(formatKnowledgeBytesMb(0)).toBe('0')
    expect(formatKnowledgeBytesMb(2 * 1024 * 1024)).toBe('2.00')
  })

  it('should localize ready status', () => {
    expect(knowledgeSourceStatusLabel('ready', (_key, fallback) => fallback)).toBe('就绪')
  })

  it('should localize stored status as pending organize', () => {
    expect(knowledgeSourceStatusLabel('stored', (_key, fallback) => fallback)).toBe('待整理')
  })

  it('should allow retry only for failed or ocr-needed sources', () => {
    expect(knowledgeSourceCanRetry('failed')).toBe(true)
    expect(knowledgeSourceCanRetry('needs_ocr')).toBe(true)
    expect(knowledgeSourceCanRetry('ready')).toBe(false)
    expect(knowledgeSourceCanRetry('stored')).toBe(false)
  })

  it('should allow graph-only reprocess for ready or partial sources', () => {
    expect(knowledgeSourceCanReembedGraph('ready')).toBe(true)
    expect(knowledgeSourceCanReembedGraph('partial')).toBe(true)
    expect(knowledgeSourceCanReembedGraph('failed')).toBe(false)
    expect(knowledgeSourceCanReembedGraph('stored')).toBe(false)
  })

  it('should translate source-not-embedded and keep other errors', () => {
    const t = (_key: string, fallback: string) => fallback
    expect(knowledgeIngestUserMessage(new Error('source-not-embedded'), t)).toBe(
      '这份资料还没有完成向量。请先完成向量，再抽取图关系。'
    )
    expect(knowledgeIngestUserMessage(new Error('notebookId required'), t)).toBe(
      'notebookId required'
    )
  })
})
