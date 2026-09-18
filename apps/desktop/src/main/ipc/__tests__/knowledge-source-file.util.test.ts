import { describe, expect, it } from 'vitest'
import { classifyKnowledgeSourceFile } from '../knowledge-source-file.util'

describe('classifyKnowledgeSourceFile', () => {
  it('should mark missing relative path as unsupported', () => {
    expect(
      classifyKnowledgeSourceFile({ hasRelativePath: false, sourceKind: 'file', ext: '.pdf' })
    ).toBe('unsupported')
  })

  it('should classify pdf by extension', () => {
    expect(
      classifyKnowledgeSourceFile({ hasRelativePath: true, sourceKind: 'file', ext: '.pdf' })
    ).toBe('pdf')
  })

  it('should classify url kind as url and note as text', () => {
    expect(
      classifyKnowledgeSourceFile({ hasRelativePath: true, sourceKind: 'url', ext: '.md' })
    ).toBe('url')
    expect(
      classifyKnowledgeSourceFile({ hasRelativePath: true, sourceKind: 'note', ext: '.bin' })
    ).toBe('text')
  })

  it('should mark unknown binary as unsupported', () => {
    expect(
      classifyKnowledgeSourceFile({ hasRelativePath: true, sourceKind: 'file', ext: '.bin' })
    ).toBe('unsupported')
  })
})
