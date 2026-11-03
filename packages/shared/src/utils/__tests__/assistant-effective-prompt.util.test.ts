import { describe, it, expect } from 'vitest'
import { getDefaultLatteAssistantSystemPrompt } from '../../constants/latte-assistant-prompt.defaults'
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

  it('replaces factory Latte self-references with custom assistant name when renamed', () => {
    const factoryPrompt = getDefaultLatteAssistantSystemPrompt('zh')
    const effective = buildEffectiveAssistantSystemPrompt(factoryPrompt, null, '酒狐')
    expect(effective).toContain('你是 酒狐。')
    expect(effective).toContain('自称「我」或「酒狐」')
    expect(effective).not.toContain('你是 Latte（拉提）')
    expect(effective).not.toContain('自称「我」或「Latte」')
  })

  it('keeps factory Latte prompt unchanged when assistant name is still Latte', () => {
    const factoryPrompt = getDefaultLatteAssistantSystemPrompt('zh')
    const effective = buildEffectiveAssistantSystemPrompt(factoryPrompt, null, 'Latte')
    expect(effective).toBe(factoryPrompt)
  })
})
