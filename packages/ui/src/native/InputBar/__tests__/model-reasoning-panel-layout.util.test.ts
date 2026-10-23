import { describe, expect, it } from 'vitest'
import { computeModelReasoningPanelLayout } from '../model-reasoning-panel-layout.util'

const host = { x: 0, y: 0, width: 390, height: 800 }
const trigger = { x: 250, y: 700, width: 80, height: 28 }

describe('computeModelReasoningPanelLayout', () => {
  it('should sit just above the trigger when host origin is the window', () => {
    const layout = computeModelReasoningPanelLayout({ trigger, host })
    expect(layout.bottom).toBe(104)
    expect(layout.right).toBe(60)
    expect(layout.width).toBe(280)
  })

  it('should not add a status-bar host offset as extra distance from the trigger', () => {
    const layout = computeModelReasoningPanelLayout({
      trigger: { ...trigger, y: 748 },
      host: { ...host, y: 48 }
    })
    expect(layout.bottom).toBe(104)
  })

  it('should move the panel down when trigger window Y excludes the host top inset', () => {
    const layout = computeModelReasoningPanelLayout({
      trigger,
      host,
      triggerYOffset: 48
    })
    expect(layout.bottom).toBe(56)
  })

  it('should follow the trigger down when the keyboard hides', () => {
    const lifted = computeModelReasoningPanelLayout({
      trigger: { ...trigger, y: 450 },
      host
    })
    const rest = computeModelReasoningPanelLayout({ trigger, host })
    expect(lifted.bottom).toBeGreaterThan(rest.bottom)
    expect(rest.bottom).toBe(104)
    expect(lifted.bottom).toBe(354)
  })

  it('should clamp maxHeight to the space above the trigger', () => {
    const nearTop = computeModelReasoningPanelLayout({
      trigger: { ...trigger, y: 200 },
      host
    })
    expect(nearTop.maxHeight).toBe(188)

    const nearBottom = computeModelReasoningPanelLayout({ trigger, host })
    expect(nearBottom.maxHeight).toBe(420)
  })

  it('should keep the panel on-screen when the trigger is near the right edge', () => {
    const layout = computeModelReasoningPanelLayout({
      trigger: { x: 330, y: 700, width: 80, height: 28 },
      host
    })
    expect(layout.right).toBeGreaterThanOrEqual(8)
    expect(layout.right + layout.width).toBeLessThanOrEqual(host.width - 8)
  })
})
