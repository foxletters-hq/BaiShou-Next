import { describe, expect, it } from 'vitest'
import {
  formatKnowledgeBytesMb,
  knowledgeIngestProgressLabel,
  knowledgeIngestUserMessage,
  knowledgeSourceCanCancelExtract,
  knowledgeSourceCanEmbed,
  knowledgeSourceCanReembedGraph,
  knowledgeSourceCanReembedVector,
  knowledgeSourceCanRetry,
  knowledgeSourceVisibleRetryKind,
  knowledgeSourceDisplayStatus,
  knowledgeSourceNeedsOcr,
  knowledgeSourceStatusLabel,
  moveNotebookByOffset,
  resolveNotebookRename,
  sortNotebooksForMobileList,
  extractEngineShortLabel,
  knowledgeExtractSettingsVisibility,
  pairStatusRows
} from '../knowledge-screen.util'

describe('knowledge-screen.util', () => {
  it('should format bytes as megabytes', () => {
    expect(formatKnowledgeBytesMb(0)).toBe('0')
    expect(formatKnowledgeBytesMb(2 * 1024 * 1024)).toBe('2.00')
  })

  it('should overlay graph job status on ready sources', () => {
    expect(knowledgeSourceDisplayStatus('ready', 'running')).toBe('graph_organizing')
    expect(knowledgeSourceDisplayStatus('ready', 'pending')).toBe('graph_queued')
    expect(knowledgeSourceDisplayStatus('embedding', 'running')).toBe('embedding')
    expect(knowledgeSourceStatusLabel('graph_organizing', (_key, fallback) => fallback)).toBe(
      '正在整理图谱'
    )
  })

  it('should show extracting when organize just started on a queued source', () => {
    expect(knowledgeSourceDisplayStatus('pending', undefined, true)).toBe('extracting')
    expect(knowledgeSourceDisplayStatus('stored', undefined, true)).toBe('extracting')
    expect(knowledgeSourceDisplayStatus('pending')).toBe('pending')
  })

  it('should label ingest phases with page progress', () => {
    const t = (key: string, fallback: string) => fallback
    expect(knowledgeIngestProgressLabel(t, { page: 2, total: 40, phase: 'render' })).toBe(
      '正在渲染页面 {{page}}/{{total}}'
    )
    expect(knowledgeIngestProgressLabel(t, { page: 12, total: 80, phase: 'embed' })).toBe(
      '正在建立索引 {{page}}/{{total}}'
    )
    expect(knowledgeIngestProgressLabel(t, { page: 3, total: 10, phase: 'ocr' })).toBe(
      '正在识图 {{page}}/{{total}}'
    )
    expect(knowledgeIngestProgressLabel(t, { page: 3, total: 10 })).toBe(
      '正在提取文本 {{page}}/{{total}}'
    )
  })

  it('should localize stored status as pending organize', () => {
    const t = (_key: string, fallback: string) => fallback
    expect(knowledgeSourceStatusLabel('stored', t)).toBe('待整理')
    expect(knowledgeSourceStatusLabel('needs_ocr', t)).toBe('需识图')
    expect(extractEngineShortLabel('ocr', t)).toBe('视觉模型')
  })

  it('should allow retry only for failed or ocr-needed sources', () => {
    expect(knowledgeSourceCanRetry('failed')).toBe(true)
    expect(knowledgeSourceCanRetry('needs_ocr')).toBe(true)
    expect(knowledgeSourceCanRetry('ready')).toBe(false)
    expect(knowledgeSourceCanRetry('stored')).toBe(false)
  })

  it('should expose a visible retry on extract failure or graph failure', () => {
    expect(knowledgeSourceVisibleRetryKind({ status: 'failed' })).toBe('extract')
    expect(knowledgeSourceVisibleRetryKind({ status: 'needs_ocr' })).toBe('extract')
    expect(knowledgeSourceVisibleRetryKind({ status: 'ready', graphJobStatus: 'failed' })).toBe(
      'graph'
    )
    expect(knowledgeSourceVisibleRetryKind({ status: 'partial', graphJobStatus: 'failed' })).toBe(
      'graph'
    )
    expect(knowledgeSourceVisibleRetryKind({ status: 'ready' })).toBeNull()
    expect(
      knowledgeSourceVisibleRetryKind({
        status: 'failed',
        ocrRunning: true
      })
    ).toBeNull()
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

  it('should allow vector reprocess for ready or partial sources', () => {
    expect(knowledgeSourceCanReembedVector('ready')).toBe(true)
    expect(knowledgeSourceCanReembedVector('stored')).toBe(false)
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
    expect(
      knowledgeIngestUserMessage(
        new Error(
          'graph-step:extract:Insufficient Balance (request_id: e342be5d-d72f-4916-9840-a03538c0a60f)'
        ),
        t
      )
    ).toBe('模型服务商提示账号额度不足。')
    expect(knowledgeIngestUserMessage(new Error('invalid url'), t)).toBe('请输入有效的 URL')
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

  it('should hide OCR settings on mobile and always show vision settings', () => {
    expect(knowledgeExtractSettingsVisibility('ocr')).toEqual({
      showOcrSettings: false,
      showVisionSettings: true
    })
    expect(knowledgeExtractSettingsVisibility('vision')).toEqual({
      showOcrSettings: false,
      showVisionSettings: true
    })
  })

  it('should pair status chips two per row and keep the last odd chip', () => {
    expect(pairStatusRows(['a', 'b', 'c', 'd', 'e'])).toEqual([['a', 'b'], ['c', 'd'], ['e']])
    expect(pairStatusRows([])).toEqual([])
  })

  it('should move a notebook by offset and stop at the edges', () => {
    const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    expect(moveNotebookByOffset(list, 1, -1)?.map((row) => row.id)).toEqual(['b', 'a', 'c'])
    expect(moveNotebookByOffset(list, 0, -1)).toBeNull()
    expect(moveNotebookByOffset(list, 2, 1)).toBeNull()
  })
})
