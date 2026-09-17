import { describe, expect, it } from 'vitest'
import {
  KNOWLEDGE_IMPORT_PROCESS_MODES,
  knowledgeImportProcessModeLabel,
  knowledgeImportProcessSelectOptions,
  knowledgeImportProcessTargets,
  normalizeKnowledgeImportProcessMode,
  shouldDeferKnowledgeImportOrganize
} from '../import-process-mode.util'

describe('normalizeKnowledgeImportProcessMode', () => {
  it('should keep the three current modes and map old save-only to later', () => {
    expect(normalizeKnowledgeImportProcessMode('vector')).toBe('vector')
    expect(normalizeKnowledgeImportProcessMode('both')).toBe('both')
    expect(normalizeKnowledgeImportProcessMode('later')).toBe('later')
    expect(normalizeKnowledgeImportProcessMode('none')).toBe('later')
    expect(normalizeKnowledgeImportProcessMode('save-only')).toBe('later')
    expect(normalizeKnowledgeImportProcessMode('process')).toBe('both')
    expect(normalizeKnowledgeImportProcessMode('extract-only')).toBe('both')
    expect(normalizeKnowledgeImportProcessMode('')).toBe('both')
    expect(normalizeKnowledgeImportProcessMode(null)).toBe('both')
  })

  it('should map legacy graph-only import mode to both', () => {
    expect(normalizeKnowledgeImportProcessMode('graph')).toBe('both')
  })
})

describe('knowledgeImportProcessModeLabel', () => {
  it('should give chinese names including later organize', () => {
    expect(knowledgeImportProcessModeLabel('vector')).toBe('向量')
    expect(knowledgeImportProcessModeLabel('both')).toBe('向量和图关系')
    expect(knowledgeImportProcessModeLabel('later')).toBe('稍后整理')
  })
})

describe('knowledgeImportProcessTargets', () => {
  it('should extract for vector and both, and skip all work when later', () => {
    expect(knowledgeImportProcessTargets('vector')).toEqual({
      extract: true,
      embed: true,
      graph: false
    })
    expect(knowledgeImportProcessTargets('both')).toEqual({
      extract: true,
      embed: true,
      graph: true
    })
    expect(knowledgeImportProcessTargets('later')).toEqual({
      extract: false,
      embed: false,
      graph: false
    })
  })
})

describe('knowledgeImportProcessSelectOptions', () => {
  it('should not offer graph-only as a current import mode', () => {
    expect(KNOWLEDGE_IMPORT_PROCESS_MODES).toEqual(['vector', 'both', 'later'])
    expect(knowledgeImportProcessSelectOptions().map((item) => item.value)).toEqual([
      'vector',
      'both',
      'later'
    ])
  })
})

describe('shouldDeferKnowledgeImportOrganize', () => {
  it('should defer only the later organize mode', () => {
    expect(shouldDeferKnowledgeImportOrganize('later')).toBe(true)
    expect(shouldDeferKnowledgeImportOrganize('both')).toBe(false)
    expect(shouldDeferKnowledgeImportOrganize('vector')).toBe(false)
    expect(shouldDeferKnowledgeImportOrganize(normalizeKnowledgeImportProcessMode('graph'))).toBe(
      false
    )
  })
})
