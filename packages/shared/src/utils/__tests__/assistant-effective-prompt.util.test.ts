import { describe, it, expect } from 'vitest'
import { buildEffectiveAssistantSystemPrompt } from '../assistant-effective-prompt.util'

describe('buildEffectiveAssistantSystemPrompt', () => {
  it('returns persona when custom is empty', () => {
    expect(buildEffectiveAssistantSystemPrompt('persona', '')).toBe('persona')
    expect(buildEffectiveAssistantSystemPrompt('persona', null)).toBe('persona')
    expect(buildEffectiveAssistantSystemPrompt('persona', '   ')).toBe('persona')
  })

  it('returns custom when persona is empty', () => {
    expect(buildEffectiveAssistantSystemPrompt('', 'custom')).toBe('custom')
    expect(buildEffectiveAssistantSystemPrompt(null, 'custom')).toBe('custom')
  })

  it('joins persona and custom with a blank line', () => {
    expect(buildEffectiveAssistantSystemPrompt('persona', 'custom')).toBe('persona\n\ncustom')
  })
})
