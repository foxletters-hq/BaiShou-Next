import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  resetDesktopPostWindowInitForTests,
  scheduleDesktopPostWindowInit
} from '../desktop-post-window-init'

describe('scheduleDesktopPostWindowInit', () => {
  beforeEach(() => {
    resetDesktopPostWindowInitForTests()
  })

  it('should run the starter only once when the window has already been shown', async () => {
    const start = vi.fn().mockResolvedValue(undefined)
    expect(scheduleDesktopPostWindowInit(start)).toBe(true)
    expect(scheduleDesktopPostWindowInit(start)).toBe(false)
    expect(start).toHaveBeenCalledTimes(1)
  })
})
