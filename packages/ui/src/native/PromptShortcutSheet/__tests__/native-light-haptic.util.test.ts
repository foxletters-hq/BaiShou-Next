import { describe, expect, it, vi, beforeEach } from 'vitest'

const impactAsync = vi.fn()
const vibrate = vi.fn()

vi.mock('expo-haptics', () => ({
  impactAsync,
  ImpactFeedbackStyle: { Light: 'light' }
}))

vi.mock('react-native', () => ({
  Vibration: { vibrate }
}))

describe('nativeLightHaptic', () => {
  beforeEach(() => {
    impactAsync.mockReset()
    vibrate.mockReset()
  })

  it('should fire a light impact when expo haptics is available', async () => {
    const { nativeLightHaptic } = await import('../native-light-haptic.util')
    nativeLightHaptic()
    expect(impactAsync).toHaveBeenCalledWith('light')
    expect(vibrate).not.toHaveBeenCalled()
  })
})
