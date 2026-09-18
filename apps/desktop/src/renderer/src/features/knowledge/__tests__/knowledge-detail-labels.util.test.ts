import { describe, expect, it } from 'vitest'
import {
  extractEngineShortLabel,
  knowledgeSourceFileExtension,
  knowledgeSourceMenuLabel,
  knowledgeSourceStatusLabel
} from '../knowledge-detail-labels.util'

const t = (key: string, fallback: string) => fallback

describe('knowledge-detail-labels.util', () => {
  it('should map known source statuses and keep unknown values', () => {
    expect(knowledgeSourceStatusLabel(t, 'stored')).toBe('待整理')
    expect(knowledgeSourceStatusLabel(t, 'ready')).toBe('就绪')
    expect(knowledgeSourceStatusLabel(t, 'custom')).toBe('custom')
  })

  it('should label extract engines and source menu actions', () => {
    expect(extractEngineShortLabel(t, 'ocr')).toBe('本地 OCR')
    expect(extractEngineShortLabel(t, 'vision')).toBe('视觉模型')
    expect(extractEngineShortLabel(t, 'simple')).toBe('PDF 文字层')
    expect(knowledgeSourceMenuLabel(t, 'preview')).toBe('预览')
    expect(knowledgeSourceMenuLabel(t, 'reembed-graph')).toBe('图数据')
  })

  it('should read the lowercase extension and ignore names without one', () => {
    expect(knowledgeSourceFileExtension('notes/Paper.PDF')).toBe('pdf')
    expect(knowledgeSourceFileExtension('README')).toBe('')
    expect(knowledgeSourceFileExtension('.gitignore')).toBe('')
  })
})
