import { describe, expect, it } from 'vitest'
import {
  knowledgeImportProcessModeLabel,
  knowledgeImportProcessTargets,
  normalizeKnowledgeImportProcessMode
} from '../import-process-mode.util'

describe('normalizeKnowledgeImportProcessMode', () => {
  it('识别三项，旧的只保存和只提取当成两者都做', () => {
    expect(normalizeKnowledgeImportProcessMode('vector')).toBe('vector')
    expect(normalizeKnowledgeImportProcessMode('graph')).toBe('graph')
    expect(normalizeKnowledgeImportProcessMode('both')).toBe('both')
    expect(normalizeKnowledgeImportProcessMode('process')).toBe('both')
    expect(normalizeKnowledgeImportProcessMode('save-only')).toBe('both')
    expect(normalizeKnowledgeImportProcessMode('extract-only')).toBe('both')
    expect(normalizeKnowledgeImportProcessMode('')).toBe('both')
    expect(normalizeKnowledgeImportProcessMode(null)).toBe('both')
  })
})

describe('knowledgeImportProcessModeLabel', () => {
  it('给出中文名称', () => {
    expect(knowledgeImportProcessModeLabel('vector')).toBe('向量')
    expect(knowledgeImportProcessModeLabel('graph')).toBe('图关系')
    expect(knowledgeImportProcessModeLabel('both')).toBe('向量和图关系')
  })
})

describe('knowledgeImportProcessTargets', () => {
  it('三项都会提取正文', () => {
    expect(knowledgeImportProcessTargets('vector')).toEqual({
      extract: true,
      embed: true,
      graph: false
    })
    expect(knowledgeImportProcessTargets('graph')).toEqual({
      extract: true,
      embed: false,
      graph: true
    })
    expect(knowledgeImportProcessTargets('both')).toEqual({
      extract: true,
      embed: true,
      graph: true
    })
  })
})
