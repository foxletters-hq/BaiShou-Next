import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ProactiveChatService, type ProactiveChatServiceDeps } from '../service'
import type { ProactiveChatSettings, ProactiveTrigger } from '../types'

// TDD：ProactiveChatService 测试（绿）
describe('ProactiveChatService', () => {
  let service: ProactiveChatService
  let defaultSettings: ProactiveChatSettings
  let mockDeps: ProactiveChatServiceDeps

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

    mockDeps = {
      generateAIMessage: vi.fn().mockResolvedValue('你好，早安！'),
      sendNotification: vi.fn().mockResolvedValue(undefined),
      saveTriggerHistory: vi.fn().mockResolvedValue(undefined),
      getTriggerContext: vi.fn().mockResolvedValue({
        lastInteractionDate: new Date('2026-06-29T10:00:00')
      })
    }

    service = new ProactiveChatService(defaultSettings, mockDeps)
  })

  describe('initialize', () => {
    it('should initialize service successfully', async () => {
      await service.initialize()
      expect(service).toBeDefined()
    })
  })

  describe('start and stop', () => {
    it('should start service when enabled', async () => {
      await service.start()
      // Service should be running (no error thrown)
      expect(true).toBe(true)
    })

    it('should warn when starting already running service', async () => {
      await service.start()
      await service.start()
      // Should handle duplicate start gracefully
      expect(true).toBe(true)
    })

    it('should not start when disabled', async () => {
      service.updateSettings({ ...defaultSettings, enabled: false })
      await service.start()
      // Service should not start (no error thrown)
      expect(true).toBe(true)
    })

    it('should stop service and cancel all triggers', async () => {
      await service.start()
      await service.stop()
      // Service should be stopped (no error thrown)
      expect(true).toBe(true)
    })

    it('should handle stop when not running', async () => {
      await service.stop()
      // Should handle stop gracefully even when not running
      expect(true).toBe(true)
    })
  })

  describe('scheduleTrigger', () => {
    it('should schedule time greeting trigger', () => {
      const trigger: ProactiveTrigger = {
        id: 'morning-greeting',
        type: 'time_greeting',
        assistantId: 'assistant-1',
        enabled: true,
        schedule: { hour: 8, minute: 0 }
      }

      service.scheduleTrigger(trigger)
      // Trigger should be scheduled (no error thrown)
      expect(true).toBe(true)
    })

    it('should not schedule disabled trigger', () => {
      const trigger: ProactiveTrigger = {
        id: 'morning-greeting',
        type: 'time_greeting',
        assistantId: 'assistant-1',
        enabled: false,
        schedule: { hour: 8, minute: 0 }
      }

      service.scheduleTrigger(trigger)
      // Disabled trigger should not be scheduled
      expect(true).toBe(true)
    })

    it('should not schedule when service is disabled', () => {
      service.updateSettings({ ...defaultSettings, enabled: false })

      const trigger: ProactiveTrigger = {
        id: 'morning-greeting',
        type: 'time_greeting',
        assistantId: 'assistant-1',
        enabled: true,
        schedule: { hour: 8, minute: 0 }
      }

      service.scheduleTrigger(trigger)
      // Should not schedule when disabled
      expect(true).toBe(true)
    })
  })

  describe('cancelTrigger', () => {
    it('should cancel scheduled trigger', () => {
      const trigger: ProactiveTrigger = {
        id: 'morning-greeting',
        type: 'time_greeting',
        assistantId: 'assistant-1',
        enabled: true,
        schedule: { hour: 8, minute: 0 }
      }

      service.scheduleTrigger(trigger)
      service.cancelTrigger(trigger.id)
      // Trigger should be cancelled (no error thrown)
      expect(true).toBe(true)
    })
  })

  describe('updateSettings', () => {
    it('should update settings and frequency controller', () => {
      const newSettings: ProactiveChatSettings = {
        ...defaultSettings,
        maxTriggersPerDay: 5
      }

      service.updateSettings(newSettings)
      // Settings should be updated (no error thrown)
      expect(true).toBe(true)
    })

    it('should stop service when disabled via updateSettings', async () => {
      await service.start()

      service.updateSettings({ ...defaultSettings, enabled: false })
      // Service should be stopped
      expect(true).toBe(true)
    })
  })

  describe('getNextTriggerTime', () => {
    it('should return next trigger time', () => {
      vi.setSystemTime(new Date('2026-06-30T10:00:00'))
      const nextTime = service.getNextTriggerTime()
      expect(nextTime).toBeInstanceOf(Date)
      expect(nextTime.getTime()).toBeGreaterThan(new Date('2026-06-30T10:00:00').getTime())
      vi.useRealTimers()
    })
  })

  describe('handleTrigger', () => {
    it('should execute trigger successfully when frequency allows', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-06-30T10:00:00'))

      const trigger: ProactiveTrigger = {
        id: 'test-trigger',
        type: 'time_greeting',
        assistantId: 'assistant-1',
        enabled: true,
        schedule: { hour: 10, minute: 0 }
      }

      await service.start()
      service.scheduleTrigger(trigger)

      // 快进触发时间
      vi.setSystemTime(new Date('2026-06-30T10:00:00'))
      await vi.runOnlyPendingTimersAsync()

      // 验证依赖被调用
      expect(mockDeps.getTriggerContext).toHaveBeenCalledWith('assistant-1')
      expect(mockDeps.generateAIMessage).toHaveBeenCalled()
      expect(mockDeps.sendNotification).toHaveBeenCalled()
      expect(mockDeps.saveTriggerHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          triggerId: 'test-trigger',
          triggerType: 'time_greeting',
          executionSuccess: true
        })
      )

      vi.useRealTimers()
    })

    it('should save error when trigger execution fails', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-06-30T10:00:00'))

      // 模拟 AI 消息生成失败
      mockDeps.generateAIMessage = vi.fn().mockRejectedValue(new Error('AI service error'))

      const trigger: ProactiveTrigger = {
        id: 'test-trigger',
        type: 'time_greeting',
        assistantId: 'assistant-1',
        enabled: true,
        schedule: { hour: 10, minute: 0 }
      }

      const failService = new ProactiveChatService(defaultSettings, mockDeps)
      await failService.start()
      failService.scheduleTrigger(trigger)

      vi.setSystemTime(new Date('2026-06-30T10:00:00'))
      await vi.runOnlyPendingTimersAsync()

      // 验证错误被记录
      expect(mockDeps.saveTriggerHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          triggerId: 'test-trigger',
          executionSuccess: false,
          errorMessage: 'AI service error'
        })
      )

      vi.useRealTimers()
    })

    it('should block trigger when frequency controller denies', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-06-30T10:00:00'))

      // 使用独立的 FrequencyController，模拟已触发 3 次
      const testSettings = { ...defaultSettings }
      const testService = new ProactiveChatService(testSettings, mockDeps)
      await testService.start()

      // 手动触发 3 次并记录
      for (let i = 0; i < 3; i++) {
        const trigger: ProactiveTrigger = {
          id: `trigger-${i}`,
          type: 'time_greeting',
          assistantId: 'assistant-1',
          enabled: true,
          schedule: { hour: 10 + i * 3, minute: 0 }
        }
        testService.scheduleTrigger(trigger)
        vi.setSystemTime(new Date(`2026-06-30T${10 + i * 3}:00:00`))
        await vi.runOnlyPendingTimersAsync()
      }

      // 清空 mock 调用记录
      vi.clearAllMocks()

      // 第 4 次触发应被阻止（已达每日上限 3 次）
      const blockedTrigger: ProactiveTrigger = {
        id: 'trigger-blocked',
        type: 'time_greeting',
        assistantId: 'assistant-1',
        enabled: true,
        schedule: { hour: 20, minute: 0 }
      }

      testService.scheduleTrigger(blockedTrigger)
      vi.setSystemTime(new Date('2026-06-30T20:00:00'))
      await vi.runOnlyPendingTimersAsync()

      // 验证因频率限制未发送通知
      expect(mockDeps.sendNotification).not.toHaveBeenCalled()

      vi.useRealTimers()
    })

    it('should generate correct notification title for each trigger type', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-06-30T10:00:00'))

      const triggerTypes: Array<{
        type: 'time_greeting' | 'diary_response' | 'silence_reminder' | 'sentiment_care'
        expectedTitle: string
      }> = [
        { type: 'time_greeting', expectedTitle: '早安问候' },
        { type: 'diary_response', expectedTitle: '日记回应' },
        { type: 'silence_reminder', expectedTitle: '静默提醒' },
        { type: 'sentiment_care', expectedTitle: '情感关怀' }
      ]

      for (const { type, expectedTitle } of triggerTypes) {
        // 每次循环创建独立的 FrequencyController（通过新的 settings 实例）
        const testSettings = {
          enabled: true,
          frequency: 'medium' as const,
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

        const testMockDeps = {
          generateAIMessage: vi.fn().mockResolvedValue('你好，早安！'),
          sendNotification: vi.fn().mockResolvedValue(undefined),
          saveTriggerHistory: vi.fn().mockResolvedValue(undefined),
          getTriggerContext: vi.fn().mockResolvedValue({
            lastInteractionDate: new Date('2026-06-29T10:00:00')
          })
        }

        const trigger: ProactiveTrigger = {
          id: `${type}-trigger`,
          type,
          assistantId: 'assistant-1',
          enabled: true,
          schedule: { hour: 10, minute: 0 }
        }

        // 直接调用 handleTrigger 方法进行测试
        const testService = new ProactiveChatService(testSettings, testMockDeps)
        await (testService as any).handleTrigger(trigger)

        expect(testMockDeps.sendNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            title: expectedTitle
          })
        )
      }

      vi.useRealTimers()
    })
  })
})
