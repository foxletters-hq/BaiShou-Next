import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TimeTrigger } from '../time-trigger'
import type { ProactiveTrigger } from '../types'

// TDD：定时触发器测试
describe('TimeTrigger', () => {
  let timeTrigger: TimeTrigger
  let mockHandler: (trigger: ProactiveTrigger) => Promise<void>

  beforeEach(() => {
    vi.useFakeTimers()
    mockHandler = vi.fn().mockResolvedValue(undefined)
    timeTrigger = new TimeTrigger(mockHandler)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('schedule', () => {
    it('should schedule trigger for future time', () => {
      const trigger: ProactiveTrigger = {
        id: 'morning-greeting',
        type: 'time_greeting',
        assistantId: 'assistant-1',
        enabled: true,
        schedule: { hour: 8, minute: 0 }
      }

      vi.setSystemTime(new Date('2026-06-30T07:00:00'))

      timeTrigger.schedule(trigger)

      // 快进到 08:00
      vi.setSystemTime(new Date('2026-06-30T08:00:00'))
      vi.runOnlyPendingTimers()

      expect(mockHandler).toHaveBeenCalledWith(trigger)
    })

    it('should schedule trigger for next day when time already passed', () => {
      const trigger: ProactiveTrigger = {
        id: 'morning-greeting',
        type: 'time_greeting',
        assistantId: 'assistant-1',
        enabled: true,
        schedule: { hour: 8, minute: 0 }
      }

      // 当前时间是 10:00，已过 08:00
      vi.setSystemTime(new Date('2026-06-30T10:00:00'))

      timeTrigger.schedule(trigger)

      // 应该调度到次日 08:00
      // 快进到次日
      vi.setSystemTime(new Date('2026-07-01T08:00:00'))
      vi.runOnlyPendingTimers()

      expect(mockHandler).toHaveBeenCalledWith(trigger)
    })

    it('should handle multiple scheduled triggers', () => {
      const morningTrigger: ProactiveTrigger = {
        id: 'morning-greeting',
        type: 'time_greeting',
        assistantId: 'assistant-1',
        enabled: true,
        schedule: { hour: 8, minute: 0 }
      }

      const eveningTrigger: ProactiveTrigger = {
        id: 'evening-greeting',
        type: 'time_greeting',
        assistantId: 'assistant-1',
        enabled: true,
        schedule: { hour: 21, minute: 0 }
      }

      vi.setSystemTime(new Date('2026-06-30T07:00:00'))

      timeTrigger.schedule(morningTrigger)
      timeTrigger.schedule(eveningTrigger)

      // 快进到 08:00
      vi.setSystemTime(new Date('2026-06-30T08:00:00'))
      vi.runOnlyPendingTimers()

      expect(mockHandler).toHaveBeenCalledWith(morningTrigger)

      // 快进到 21:00
      vi.setSystemTime(new Date('2026-06-30T21:00:00'))
      vi.runOnlyPendingTimers()

      expect(mockHandler).toHaveBeenCalledWith(eveningTrigger)
    })
  })

  describe('cancel', () => {
    it('should cancel scheduled trigger', () => {
      const trigger: ProactiveTrigger = {
        id: 'morning-greeting',
        type: 'time_greeting',
        assistantId: 'assistant-1',
        enabled: true,
        schedule: { hour: 8, minute: 0 }
      }

      vi.setSystemTime(new Date('2026-06-30T07:00:00'))

      timeTrigger.schedule(trigger)
      timeTrigger.cancel(trigger.id)

      // 快进到 08:00
      vi.setSystemTime(new Date('2026-06-30T08:00:00'))
      vi.runOnlyPendingTimers()

      // 触发器已取消，handler 不应被调用
      expect(mockHandler).not.toHaveBeenCalled()
    })

    it('should not throw when cancelling non-existent trigger', () => {
      expect(() => {
        timeTrigger.cancel('non-existent-trigger')
      }).not.toThrow()
    })
  })

  describe('cancelAll', () => {
    it('should cancel all scheduled triggers', () => {
      const trigger1: ProactiveTrigger = {
        id: 'morning-greeting',
        type: 'time_greeting',
        assistantId: 'assistant-1',
        enabled: true,
        schedule: { hour: 8, minute: 0 }
      }

      const trigger2: ProactiveTrigger = {
        id: 'evening-greeting',
        type: 'time_greeting',
        assistantId: 'assistant-1',
        enabled: true,
        schedule: { hour: 21, minute: 0 }
      }

      vi.setSystemTime(new Date('2026-06-30T07:00:00'))

      timeTrigger.schedule(trigger1)
      timeTrigger.schedule(trigger2)

      timeTrigger.cancelAll()

      // 快进到 08:00 和 21:00
      vi.setSystemTime(new Date('2026-06-30T08:00:00'))
      vi.runOnlyPendingTimers()

      vi.setSystemTime(new Date('2026-06-30T21:00:00'))
      vi.runOnlyPendingTimers()

      // 所有触发器已取消，handler 不应被调用
      expect(mockHandler).not.toHaveBeenCalled()
    })
  })
})
