import { describe, it, expect } from 'vitest'
import {
  AUTO_INJECT_TIME_TOOL_ID,
  LEGACY_AUTO_INJECT_TIME_TOOL_ID,
  isAutoInjectCurrentTimeEnabled,
  normalizeToolManagementConfig
} from '../tool-management.constants'

describe('isAutoInjectCurrentTimeEnabled', () => {
  it('returns true for legacy empty disabled list', () => {
    expect(isAutoInjectCurrentTimeEnabled([])).toBe(true)
    expect(isAutoInjectCurrentTimeEnabled(undefined)).toBe(true)
  })

  it('returns false when auto inject tool id is disabled', () => {
    expect(isAutoInjectCurrentTimeEnabled([AUTO_INJECT_TIME_TOOL_ID])).toBe(false)
    expect(isAutoInjectCurrentTimeEnabled([LEGACY_AUTO_INJECT_TIME_TOOL_ID])).toBe(false)
  })

  it('returns true when other tools are disabled but auto inject is not', () => {
    expect(isAutoInjectCurrentTimeEnabled(['diary_read'])).toBe(true)
  })
})

describe('normalizeToolManagementConfig', () => {
  it('migrates legacy auto inject tool id', () => {
    const normalized = normalizeToolManagementConfig({
      disabledToolIds: [LEGACY_AUTO_INJECT_TIME_TOOL_ID, 'diary_read'],
      customConfigs: {
        [LEGACY_AUTO_INJECT_TIME_TOOL_ID]: { foo: 1 }
      }
    })

    expect(normalized.disabledToolIds).toEqual([AUTO_INJECT_TIME_TOOL_ID, 'diary_read'])
    expect(normalized.customConfigs[AUTO_INJECT_TIME_TOOL_ID]).toEqual({ foo: 1 })
    expect(normalized.customConfigs[LEGACY_AUTO_INJECT_TIME_TOOL_ID]).toBeUndefined()
  })
})
