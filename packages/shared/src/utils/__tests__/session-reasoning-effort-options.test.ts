import { afterEach, describe, expect, it } from 'vitest'
import { resetReasoningCatalogForTests } from '../reasoning-catalog-store'
import { listSessionReasoningEffortSettings } from '../session-reasoning-effort-options'

describe('listSessionReasoningEffortSettings', () => {
  afterEach(() => {
    resetReasoningCatalogForTests()
  })

  it('should expose DeepSeek Flash product efforts plus Default', () => {
    expect(listSessionReasoningEffortSettings('deepseek-flash', 'deepseek')).toEqual([
      'auto',
      'low',
      'medium',
      'high',
      'max'
    ])
  })

  it('should keep Default only when the model has no effort control', () => {
    expect(listSessionReasoningEffortSettings('deepseek-reasoner', 'deepseek')).toEqual(['auto'])
    expect(listSessionReasoningEffortSettings('')).toEqual(['auto'])
  })
})
