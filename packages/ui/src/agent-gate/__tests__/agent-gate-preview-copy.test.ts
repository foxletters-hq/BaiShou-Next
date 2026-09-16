import { describe, expect, it } from 'vitest'
import { canFlipGateQueue, formatGateQueueLabel } from '../agent-gate-preview-copy'

describe('formatGateQueueLabel', () => {
  it('should hide the label when there is only one pending item', () => {
    expect(formatGateQueueLabel(1, 1)).toBeNull()
    expect(formatGateQueueLabel(0, 3)).toBeNull()
  })

  it('should show the current page when several items are pending', () => {
    expect(formatGateQueueLabel(2, 3)).toBe('第 2 / 共 3 项')
  })
})

describe('canFlipGateQueue', () => {
  it('should allow next only before the last item', () => {
    expect(canFlipGateQueue(1, 3, 1)).toBe(true)
    expect(canFlipGateQueue(3, 3, 1)).toBe(false)
  })

  it('should allow previous only after the first item', () => {
    expect(canFlipGateQueue(1, 3, -1)).toBe(false)
    expect(canFlipGateQueue(2, 3, -1)).toBe(true)
  })
})
