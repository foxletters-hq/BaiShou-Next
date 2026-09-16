import { describe, it, expect } from 'vitest'
import {
  getConfigKeysForSegment,
  getDefaultGlobalModels,
  normalizeSettingsConfigKey,
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

  it('should keep an independently configured graph model when loading global models', () => {
    const patch = normalizeSettingsConfigKey('globalModels', {
      ...getDefaultGlobalModels(),
      globalDialogueProviderId: 'gemini',
      globalDialogueModelId: 'gemini-pro',
      globalGraphProviderId: 'deepseek',
      globalGraphModelId: 'deepseek-chat'
    })
    expect(patch.globalModels).toMatchObject({
      globalDialogueModelId: 'gemini-pro',
      globalGraphProviderId: 'deepseek',
      globalGraphModelId: 'deepseek-chat'
    })
  })
})
