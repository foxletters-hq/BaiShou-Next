import { describe, it, expect } from 'vitest'
import {
  getConfigKeysForSegment,
  segmentNeedsConfigLoading,
  segmentHasConfigFailure,
  SETTINGS_SEGMENT_CONFIG_KEYS
} from '../settings-config.loader'

describe('settings-config.loader', () => {
  it('general segment should not block on config keys', () => {
    expect(getConfigKeysForSegment('general')).toEqual([])
    expect(SETTINGS_SEGMENT_CONFIG_KEYS.general).toBeUndefined()
  })

  it('segmentNeedsConfigLoading returns true when required keys missing', () => {
    expect(segmentNeedsConfigLoading('rag', [])).toBe(true)
    expect(segmentNeedsConfigLoading('rag', ['ragConfig'])).toBe(true)
    expect(segmentNeedsConfigLoading('rag', ['ragConfig', 'globalModels'])).toBe(false)
  })

  it('segmentHasConfigFailure detects failed required keys', () => {
    expect(segmentHasConfigFailure('mcp', ['mcpServerConfig'])).toBe(true)
    expect(segmentHasConfigFailure('mcp', ['providers'])).toBe(false)
    expect(segmentHasConfigFailure('general', ['hotkeyConfig'])).toBe(false)
  })
})
