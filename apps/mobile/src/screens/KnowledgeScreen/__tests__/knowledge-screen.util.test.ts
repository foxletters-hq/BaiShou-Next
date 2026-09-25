import { describe, expect, it } from 'vitest'
import {
  formatKnowledgeBytesMb,
  knowledgeIngestUserMessage,
  knowledgeSourceCanCancelExtract,
  knowledgeSourceCanEmbed,
  knowledgeSourceCanReembedGraph,
  knowledgeSourceCanRetry,
  knowledgeSourceNeedsOcr,
  knowledgeSourceStatusLabel,
  moveNotebookByOffset,
  resolveNotebookRename,
  sortNotebooksForMobileList
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

  it('should allow stored sources to embed and extracting sources to cancel', () => {
    expect(knowledgeSourceCanEmbed('stored')).toBe(true)
    expect(knowledgeSourceCanEmbed('ready')).toBe(false)
    expect(knowledgeSourceCanCancelExtract({ status: 'extracting', extractEngine: 'ocr' })).toBe(
      true
    )
    expect(knowledgeSourceNeedsOcr('needs_ocr')).toBe(true)
  })

  it('should translate knowledge-model-mismatch', () => {
    const t = (_key: string, fallback: string) => fallback
    expect(knowledgeIngestUserMessage(new Error('knowledge-model-mismatch'), t)).toContain(
      '提问已硬拦截'
    )
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
    expect(knowledgeIngestUserMessage(new Error('graph-step:node-embed:Payment Required'), t)).toBe(
      '模型服务商提示账号额度不足。'
    )
  })

  it('should sort notebooks by sortOrder then newer createdAt', () => {
    const rows = sortNotebooksForMobileList([
      { id: 'b', name: 'B', sortOrder: 2, createdAt: 1 },
      { id: 'a', name: 'A', sortOrder: 1, createdAt: 2 }
    ])
    expect(rows.map((row) => row.id)).toEqual(['a', 'b'])
  })

  it('should resolve rename only when the name actually changes', () => {
    expect(resolveNotebookRename('旧名', ' 新名 ')).toBe('新名')
    expect(resolveNotebookRename('旧名', '旧名')).toBeNull()
    expect(resolveNotebookRename('旧名', '   ')).toBeNull()
  })

  it('should move a notebook by offset and stop at the edges', () => {
    const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    expect(moveNotebookByOffset(list, 1, -1)?.map((row) => row.id)).toEqual(['b', 'a', 'c'])
    expect(moveNotebookByOffset(list, 0, -1)).toBeNull()
    expect(moveNotebookByOffset(list, 2, 1)).toBeNull()
  })
})
