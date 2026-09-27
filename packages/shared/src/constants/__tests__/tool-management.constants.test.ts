import { describe, it, expect } from 'vitest'
import {
  AUTO_INJECT_TIME_TOOL_ID,
  DEFAULT_TOOL_MANAGEMENT_CONFIG,
  LEGACY_AUTO_INJECT_TIME_TOOL_ID,
  isAutoInjectCurrentTimeEnabled,
  isEnablingAutoInjectTime,
  normalizeToolManagementConfig
} from '../tool-management.constants'

describe('isAutoInjectCurrentTimeEnabled', () => {
  it('returns false for empty or missing disabled list', () => {
    expect(isAutoInjectCurrentTimeEnabled([])).toBe(false)
    expect(isAutoInjectCurrentTimeEnabled(undefined)).toBe(false)
  })

  it('defaults auto inject time to off in DEFAULT_TOOL_MANAGEMENT_CONFIG', () => {
    expect(
      isAutoInjectCurrentTimeEnabled(DEFAULT_TOOL_MANAGEMENT_CONFIG.disabledToolIds)
    ).toBe(false)
  })

  it('returns false when auto inject tool id is disabled', () => {
    expect(isAutoInjectCurrentTimeEnabled([AUTO_INJECT_TIME_TOOL_ID])).toBe(false)
    expect(isAutoInjectCurrentTimeEnabled([LEGACY_AUTO_INJECT_TIME_TOOL_ID])).toBe(false)
  })

  it('returns true when other tools are disabled but auto inject is not', () => {
    expect(isAutoInjectCurrentTimeEnabled(['diary_read'])).toBe(true)
  })
})

describe('isEnablingAutoInjectTime', () => {
  it('should be true only when turning auto inject time on', () => {
    expect(isEnablingAutoInjectTime(AUTO_INJECT_TIME_TOOL_ID, false)).toBe(true)
    expect(isEnablingAutoInjectTime(LEGACY_AUTO_INJECT_TIME_TOOL_ID, false)).toBe(true)
    expect(isEnablingAutoInjectTime(AUTO_INJECT_TIME_TOOL_ID, true)).toBe(false)
    expect(isEnablingAutoInjectTime('diary_read', false)).toBe(false)
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
