import { describe, expect, it } from 'vitest'
import { buildKnowledgeSourceMenuActions } from '../knowledge-source-menu.util'

describe('buildKnowledgeSourceMenuActions', () => {
  it('只保存的资料提供预览、嵌入和删除', () => {
    expect(buildKnowledgeSourceMenuActions({ status: 'stored' })).toEqual([
      'preview',
      'embed',
      'delete'
    ])
  })

  it('提取中提供预览、取消和删除', () => {
    expect(
      buildKnowledgeSourceMenuActions({ status: 'extracting', extractEngine: 'ocr' })
    ).toEqual(['preview', 'cancel', 'delete'])
  })

  it('失败时提供预览、重试和删除', () => {
    expect(buildKnowledgeSourceMenuActions({ status: 'failed' })).toEqual([
      'preview',
      'retry',
      'delete'
    ])
  })

  it('需 OCR 时提供预览、补 OCR、重试和删除', () => {
    expect(buildKnowledgeSourceMenuActions({ status: 'needs_ocr' })).toEqual([
      'preview',
      'ocr',
      'retry',
      'delete'
    ])
  })

  it('就绪资料提供预览、重新嵌入和删除', () => {
    expect(buildKnowledgeSourceMenuActions({ status: 'ready' })).toEqual([
      'preview',
      'reembed',
      'delete'
    ])
  })

  it('部分文本资料提供预览、重新嵌入、补 OCR 和删除', () => {
    expect(buildKnowledgeSourceMenuActions({ status: 'partial' })).toEqual([
      'preview',
      'reembed',
      'ocr',
      'delete'
    ])
  })
})
