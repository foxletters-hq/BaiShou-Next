import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { DesktopProactiveChatService } from '../proactive-chat.service'
import type { ProactiveChatSettings } from '@baishou/core/shared'

// TDD：桌面端主动互动服务集成测试
// 测试目标：验证 DesktopProactiveChatService 正确集成 core 服务和桌面端依赖

vi.mock('@baishou/database-desktop', () => ({
  ProactiveTriggerHistoryRepository: class {
    create = vi.fn().mockResolvedValue(undefined)
  },
  AssistantRepository: class {
    findById = vi.fn().mockResolvedValue({
      id: 'assistant-1',
      name: 'AI 助手',
      providerId: 'openai',
      modelId: 'gpt-4'
    })
  }
}))

vi.mock('@baishou/ai', () => ({
  AIProviderRegistry: {
    getInstance: vi.fn().mockReturnValue({
      getProvider: vi.fn().mockReturnValue({
        config: { type: 'openai', id: 'openai', baseUrl: 'https://api.openai.com' },
        getLanguageModel: vi.fn().mockReturnValue({})
      })
    })
  },
  wrapLanguageModelWithMiddlewares: vi.fn().mockReturnValue({})
}))

vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({ text: '早安！今天有什么计划吗？' })
}))

vi.mock('../notification.service', () => ({
  NotificationService: class {
    sendNotification = vi.fn().mockResolvedValue(undefined)
    isSupported = vi.fn().mockReturnValue(true)
  }
}))

describe('DesktopProactiveChatService', () => {
  let service: DesktopProactiveChatService
  let mockDb: any

  const defaultSettings: ProactiveChatSettings = {
    enabled: true,
    maxDailyTriggers: 3,
    minIntervalMinutes: 60,
    quietHours: {
      start: { hour: 22, minute: 0 },
      end: { hour: 8, minute: 0 }
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb = {}
    service = new DesktopProactiveChatService(mockDb, 'assistant-1')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initialize', () => {
    it('should initialize service with settings', async () => {
      await service.initialize(defaultSettings)

      // 验证服务已初始化（通过 start 不抛出错误来验证）
      await expect(service.start()).resolves.not.toThrow()
    })
  })

  describe('start and stop', () => {
    it('should start service when enabled', async () => {
      await service.initialize(defaultSettings)
      await expect(service.start()).resolves.not.toThrow()
    })

    it('should stop service gracefully', async () => {
      await service.initialize(defaultSettings)
      await service.start()
      await expect(service.stop()).resolves.not.toThrow()
    })

    it('should throw error when starting without initialization', async () => {
      await expect(service.start()).rejects.toThrow('ProactiveChatService 未初始化')
    })
  })

  describe('scheduleMorningGreeting', () => {
    it('should schedule morning greeting with default time', async () => {
      await service.initialize(defaultSettings)

      expect(() => service.scheduleMorningGreeting()).not.toThrow()
    })

    it('should schedule morning greeting with custom time', async () => {
      await service.initialize(defaultSettings)

      expect(() => service.scheduleMorningGreeting(9, 30)).not.toThrow()
    })
  })

  describe('scheduleEveningGreeting', () => {
    it('should schedule evening greeting with default time', async () => {
      await service.initialize(defaultSettings)

      expect(() => service.scheduleEveningGreeting()).not.toThrow()
    })

    it('should schedule evening greeting with custom time', async () => {
      await service.initialize(defaultSettings)

      expect(() => service.scheduleEveningGreeting(22, 30)).not.toThrow()
    })
  })
})
