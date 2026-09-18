import { describe, expect, it } from 'vitest'
import {
  MODEL_REASONING_SLOTS,
  isModelReasoningSlot,
  normalizeReasoningEffortBySlot,
  resolveDialogueEffortPreference,
  resolveReasoningEffortForSlot,
  setReasoningEffortForSlot
} from '../reasoning-effort-slot'

describe('reasoning-effort-slot', () => {
  it('should treat missing slot values as auto after upgrade', () => {
    expect(MODEL_REASONING_SLOTS).toEqual(['dialogue', 'graph', 'naming', 'summary', 'vision'])
    expect(isModelReasoningSlot('graph')).toBe(true)
    expect(isModelReasoningSlot('embedding')).toBe(false)
    expect(resolveReasoningEffortForSlot(undefined, 'dialogue')).toBe('auto')
    expect(resolveReasoningEffortForSlot({}, 'graph')).toBe('auto')
    expect(resolveReasoningEffortForSlot({ dialogue: 'high' }, 'graph')).toBe('auto')
    expect(resolveReasoningEffortForSlot({ dialogue: 'high' }, 'dialogue')).toBe('high')
  })

  it('should not inherit another slot or a legacy global default when normalizing', () => {
    expect(
      normalizeReasoningEffortBySlot({
        dialogue: 'high',
        graph: 'nope',
        embedding: 'max',
        naming: 'auto'
      })
    ).toEqual({ dialogue: 'high' })
    expect(
      normalizeReasoningEffortBySlot({
        reasoningEffortDefault: 'max',
        dialogue: 'low'
      })
    ).toEqual({ dialogue: 'low' })
    expect(normalizeReasoningEffortBySlot(null)).toEqual({})
  })

  it('should record a concrete slot effort without copying it to other slots', () => {
    const next = setReasoningEffortForSlot({ dialogue: 'high' }, 'summary', 'low')
    expect(next).toEqual({ dialogue: 'high', summary: 'low' })
    expect(resolveReasoningEffortForSlot(next, 'graph')).toBe('auto')
    expect(setReasoningEffortForSlot(next, 'dialogue', 'auto')).toEqual({ summary: 'low' })
  })

  it('should prefer per-model chat memory over the dialogue slot', () => {
    expect(resolveDialogueEffortPreference('high', 'low')).toBe('high')
    expect(resolveDialogueEffortPreference('auto', 'low')).toBe('low')
    expect(resolveDialogueEffortPreference(undefined, undefined)).toBe('auto')
  })
})
