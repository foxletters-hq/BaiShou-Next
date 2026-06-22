import { describe, expect, it } from 'vitest'
import {
  normalizeDiskAssistantRecord,
  shouldApplyDiskAssistantRecord,
  stableAssistantDiskJson
} from '../assistant-persist.util'

describe('shouldApplyDiskAssistantRecord', () => {
  it('applies disk record when disk is newer', () => {
    expect(
      shouldApplyDiskAssistantRecord('2026-06-16T12:00:00.000Z', '2026-06-16T11:00:00.000Z')
    ).toBe(true)
  })

  it('skips disk record when sqlite is newer', () => {
    expect(
      shouldApplyDiskAssistantRecord('2026-06-16T11:00:00.000Z', '2026-06-16T12:00:00.000Z')
    ).toBe(false)
  })

  it('applies disk record when sqlite timestamp is missing', () => {
    expect(shouldApplyDiskAssistantRecord('2026-06-16T12:00:00.000Z', null)).toBe(true)
  })
})

describe('normalizeDiskAssistantRecord', () => {
  it('maps snake_case assistant_kind to assistantKind', () => {
    const normalized = normalizeDiskAssistantRecord({
      id: 'a1',
      assistant_kind: 'work'
    })
    expect(normalized?.assistantKind).toBe('work')
    expect(normalized?.assistant_kind).toBeUndefined()
  })

  it('defaults invalid assistantKind to companion', () => {
    const normalized = normalizeDiskAssistantRecord({
      id: 'a1',
      assistantKind: 'unknown'
    })
    expect(normalized?.assistantKind).toBe('companion')
  })
})

describe('stableAssistantDiskJson', () => {
  it('treats equivalent records with different updatedAt shapes as equal', () => {
    const a = stableAssistantDiskJson({
      id: 'default',
      name: 'Latte',
      updatedAt: '2026-06-16T12:00:00.000Z'
    })
    const b = stableAssistantDiskJson({
      id: 'default',
      name: 'Latte',
      updatedAt: new Date('2026-06-16T12:00:00.000Z')
    })
    expect(a).toBe(b)
  })
})
