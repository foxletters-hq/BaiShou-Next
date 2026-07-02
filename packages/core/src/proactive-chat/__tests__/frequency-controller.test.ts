import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FrequencyController } from '../frequency-controller'
import type { ProactiveChatSettings } from '../types'

// TDD：频率控制器测试（绿）
describe('FrequencyController', () => {
  let controller: FrequencyController
  let defaultSettings: ProactiveChatSettings

  beforeEach(() => {
    defaultSettings = {
      enabled: true,
      frequency: 'medium',
      maxTriggersPerDay: 3,
      minIntervalMinutes: 120,
      dndStartHour: 23,
      dndEndHour: 8,
      enabledScenarios: {
        timeBasedGreeting: true,
        diaryResponse: true,
        silenceReminder: true,
        sentimentCare: false
      }
    }
    controller = new FrequencyController(defaultSettings)
  })

  describe('canTrigger', () => {
    it('should block trigger when proactive chat is disabled', async () => {
      controller.updateSettings({ ...defaultSettings, enabled: false })
      const canTrigger = await controller.canTrigger()
      expect(canTrigger).toBe(false)
    })

    it('should block trigger when max triggers per day reached', async () => {
      // 模拟已触发 3 次
      controller.recordTrigger('trigger-1')
      controller.recordTrigger('trigger-2')
      controller.recordTrigger('trigger-3')

      const canTrigger = await controller.canTrigger()
      expect(canTrigger).toBe(false)
    })

    it('should block trigger when within minimum interval', async () => {
      controller.recordTrigger('trigger-1')

      // 立即尝试再次触发（间隔 < 120 分钟）
      const canTrigger = await controller.canTrigger()
      expect(canTrigger).toBe(false)
    })

    it('should block trigger during DND hours', async () => {
      vi.setSystemTime(new Date('2026-06-30T23:30:00'))

      const canTrigger = await controller.canTrigger()
      expect(canTrigger).toBe(false)

      vi.useRealTimers()
    })

    it('should allow trigger when all conditions met', async () => {
      vi.setSystemTime(new Date('2026-06-30T10:00:00'))

      const canTrigger = await controller.canTrigger()
      expect(canTrigger).toBe(true)

      vi.useRealTimers()
    })
  })

  describe('getNextTriggerTime', () => {
    it('should calculate next trigger time after minimum interval', () => {
      const currentTime = new Date('2026-06-30T10:00:00')
      const nextTime = controller.getNextTriggerTime(currentTime)

      // 应该是 10:00 + 120 分钟 = 12:00
      expect(nextTime.getHours()).toBe(12)
      expect(nextTime.getMinutes()).toBe(0)
    })

    it('should skip DND period when calculating next trigger time', () => {
      const currentTime = new Date('2026-06-30T22:00:00')
      const nextTime = controller.getNextTriggerTime(currentTime)

      // 22:00 + 120 分钟会进入 DND（23:00-08:00），应跳到次日 08:00
      expect(nextTime.getDate()).toBe(1)
      expect(nextTime.getHours()).toBe(8)
    })

    it('should handle DND period crossing midnight', () => {
      const currentTime = new Date('2026-06-30T23:30:00')
      const nextTime = controller.getNextTriggerTime(currentTime)

      // 当前在 DND 内，应跳到次日 08:00
      expect(nextTime.getDate()).toBe(1)
      expect(nextTime.getHours()).toBe(8)
    })
  })

  describe('recordTrigger', () => {
    it('should record trigger attempt', async () => {
      controller.recordTrigger('trigger-1')

      // 立即再次尝试应被阻止(最小间隔)
      const canTrigger = await controller.canTrigger()
      expect(canTrigger).toBe(false)
    })
  })
})
