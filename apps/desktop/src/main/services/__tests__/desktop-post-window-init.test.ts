import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  bindDesktopWindowMcpKeepAlive,
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

  it('should trigger ensureAlive on window focus and show without duplicate bindings', async () => {
    const handlers = new Map<'focus' | 'show', Array<() => void>>()
    const fakeWindow = {
      on(event: 'focus' | 'show', listener: () => void) {
        const list = handlers.get(event) ?? []
        list.push(listener)
        handlers.set(event, list)
      }
    }
    const ensureAlive = vi.fn().mockResolvedValue(undefined)

    bindDesktopWindowMcpKeepAlive(fakeWindow, ensureAlive)
    bindDesktopWindowMcpKeepAlive(fakeWindow, ensureAlive)

    expect(handlers.get('focus')).toHaveLength(1)
    expect(handlers.get('show')).toHaveLength(1)

    handlers.get('focus')?.[0]?.()
    handlers.get('show')?.[0]?.()

    expect(ensureAlive).toHaveBeenCalledTimes(2)
  })
})
