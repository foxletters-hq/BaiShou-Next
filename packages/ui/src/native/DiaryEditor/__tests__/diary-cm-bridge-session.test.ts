import { describe, expect, it } from 'vitest'
import { buildInitPayload, shouldInjectDiaryBridgeMessage } from '../diary-cm-bridge-session'

const theme = {
  isDark: false,
  textPrimary: '#111',
  textSecondary: '#666',
  bgEditor: '#fff',
  borderColor: '#ddd',
  primary: '#007aff',
  tagColors: ['#60A5FA', '#34D399', '#F59E0B', '#A78BFA'] as [string, string, string, string]
}

describe('buildInitPayload', () => {
  it('should clamp a negative bottom inset when building init payload', () => {
    const payload = buildInitPayload('hello', 'hint', theme, true, undefined, -12)
    expect(payload.scrollInsets).toEqual({ bottom: 0 })
    expect(payload.interactionMode).toBe('touch')
    expect(payload.tagLineMode).toBe(true)
  })
})

describe('shouldInjectDiaryBridgeMessage', () => {
  it('should inject confirm responses when running on Android', () => {
    expect(
      shouldInjectDiaryBridgeMessage('android', {
        type: 'confirmResponse',
        payload: { requestId: '1', confirmed: true }
      })
    ).toBe(true)
  })

  it('should keep ordinary messages on postMessage when running on iOS', () => {
    expect(
      shouldInjectDiaryBridgeMessage('ios', {
        type: 'confirmResponse',
        payload: { requestId: '1', confirmed: true }
      })
    ).toBe(false)
  })
})
