import { describe, expect, it } from 'vitest'
import { formatKnowledgeBytesMb, knowledgeSourceStatusLabel } from '../knowledge-screen.util'

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
})
