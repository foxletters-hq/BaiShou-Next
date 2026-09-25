import { describe, expect, it } from 'vitest'
import { knowledgeIngestProgressLabel } from '../knowledge-ingest-progress-label.util'

const t = (key: string, fallback: string, options?: Record<string, number>) =>
  (fallback || key)
    .replace('{{page}}', String(options?.page ?? ''))
    .replace('{{total}}', String(options?.total ?? ''))

describe('knowledgeIngestProgressLabel', () => {
  it('should describe embed chunks instead of pages', () => {
    expect(
      knowledgeIngestProgressLabel(t, { page: 12, total: 80, phase: 'embed' })
    ).toBe('正在建立索引 12/80')
  })

  it('should describe pdf parse progress while the worker is reading pages', () => {
    expect(knowledgeIngestProgressLabel(t, { page: 12, total: 0, phase: 'parse' })).toBe(
      '正在读取 PDF 第 12 页'
    )
  })

  it('should describe page rendering separately from recognition', () => {
    expect(knowledgeIngestProgressLabel(t, { page: 2, total: 40, phase: 'render' })).toBe(
      '正在渲染页面 2/40'
    )
    expect(knowledgeIngestProgressLabel(t, { page: 2, total: 40, phase: 'recognize' })).toBe(
      '正在识图 2/40'
    )
  })

  it('should keep extract progress as page counts', () => {
    expect(
      knowledgeIngestProgressLabel(t, { page: 3, total: 10, phase: 'vision' })
    ).toBe('OCR 中 3/10')
  })
})
