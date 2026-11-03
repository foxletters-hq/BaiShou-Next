import { describe, it, expect } from 'vitest'

describe('useAgentAssistants fallback logic', () => {
  function computeFallbackAssistant(
    assistants: Array<{ id: string; name: string; isDefault?: boolean }>,
    currentAssistant: { id: string; name: string } | null
  ) {
    if (!currentAssistant?.id) {
      if (assistants.length > 0) {
        return assistants.find((a) => a.isDefault) || assistants[0] || null
      }
      return null
    }
    const updated = assistants.find((a) => a.id === currentAssistant.id)
    if (!updated) {
      return assistants.find((a) => a.isDefault) || assistants[0] || null
    }
    return updated
  }

  it('selects default assistant when currentAssistant is null', () => {
    const assistants = [
      { id: 'custom-1', name: 'Custom' },
      { id: 'latte', name: 'Latte', isDefault: true }
    ]
    const fallback = computeFallbackAssistant(assistants, null)
    expect(fallback?.id).toBe('latte')
  })

  it('selects first assistant when currentAssistant is null and no default exists', () => {
    const assistants = [
      { id: 'custom-1', name: 'Custom 1' },
      { id: 'custom-2', name: 'Custom 2' }
    ]
    const fallback = computeFallbackAssistant(assistants, null)
    expect(fallback?.id).toBe('custom-1')
  })

  it('falls back to default assistant when current assistant was deleted from list', () => {
    const assistants = [{ id: 'latte', name: 'Latte', isDefault: true }]
    const fallback = computeFallbackAssistant(assistants, { id: 'deleted-id', name: 'Old' })
    expect(fallback?.id).toBe('latte')
  })

  it('returns current assistant when it still exists in the list', () => {
    const assistants = [
      { id: 'latte', name: 'Latte', isDefault: true },
      { id: 'custom-1', name: 'Custom 1' }
    ]
    const fallback = computeFallbackAssistant(assistants, { id: 'custom-1', name: 'Custom 1' })
    expect(fallback?.id).toBe('custom-1')
  })
})
