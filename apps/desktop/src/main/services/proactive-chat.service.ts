import { ProactiveChatService, type ProactiveChatSettings } from '@baishou/core/shared'
import {
  ProactiveTriggerHistoryRepository,
  type CreateProactiveTriggerHistoryInput
} from '@baishou/database-desktop'
import { logger } from '@baishou/shared'
import { NotificationService } from './notification.service'
import type { TriggerType, TriggerContext } from '@baishou/core/shared'

// 桌面端主动互动服务：集成 ProactiveChatService 与桌面端特定依赖
// 调用方：apps/desktop/src/main/index.ts（主进程启动时初始化）
// API：initialize、start、stop、scheduleMorningGreeting、scheduleEveningGreeting
// 用户指示：按 MVP → P1 → P2 实现 AI 主动互动，使用 TDD 红→绿→重构，遵守项目规范

export class DesktopProactiveChatService {
  private coreService: ProactiveChatService | null = null
  private notificationService: NotificationService
  private historyRepository: ProactiveTriggerHistoryRepository

  constructor(
    private db: any,
    private assistantId: string
  ) {
    this.notificationService = new NotificationService()
    this.historyRepository = new ProactiveTriggerHistoryRepository(db)
  }

  async initialize(settings: ProactiveChatSettings): Promise<void> {
    logger.info('[DesktopProactiveChatService] 初始化桌面端主动互动服务')

    this.coreService = new ProactiveChatService(settings, {
      generateAIMessage: this.generateAIMessage.bind(this),
      sendNotification: this.sendNotification.bind(this),
      saveTriggerHistory: this.saveTriggerHistory.bind(this),
      getTriggerContext: this.getTriggerContext.bind(this)
    })

    await this.coreService.initialize()
  }

  async start(): Promise<void> {
    if (!this.coreService) {
      throw new Error('ProactiveChatService 未初始化')
    }
    await this.coreService.start()
  }

  async stop(): Promise<void> {
    if (!this.coreService) {
      return
    }
    await this.coreService.stop()
  }

  scheduleMorningGreeting(hour = 8, minute = 0): void {
    if (!this.coreService) {
      logger.warn('[DesktopProactiveChatService] 服务未初始化，无法调度早安问候')
      return
    }

    this.coreService.scheduleTrigger({
      id: 'morning-greeting',
      type: 'time_greeting',
      assistantId: this.assistantId,
      enabled: true,
      schedule: { hour, minute }
    })

    logger.info(`[DesktopProactiveChatService] 已调度早安问候: ${hour}:${minute}`)
  }

  scheduleEveningGreeting(hour = 21, minute = 0): void {
    if (!this.coreService) {
      logger.warn('[DesktopProactiveChatService] 服务未初始化，无法调度晚安问候')
      return
    }

    this.coreService.scheduleTrigger({
      id: 'evening-greeting',
      type: 'time_greeting',
      assistantId: this.assistantId,
      enabled: true,
      schedule: { hour, minute }
    })

    logger.info(`[DesktopProactiveChatService] 已调度晚安问候: ${hour}:${minute}`)
  }

  private async generateAIMessage(params: {
    assistantId: string
    triggerType: TriggerType
    context: TriggerContext
  }): Promise<string> {
    logger.info('[DesktopProactiveChatService] 生成 AI 消息', params)

    try {
      const { AssistantRepository } = await import('@baishou/database-desktop')
      const { AIProviderRegistry } = await import('@baishou/ai')
      const { generateText } = await import('ai')
      const { wrapLanguageModelWithMiddlewares } = await import('@baishou/ai')

      const assistantRepo = new AssistantRepository(this.db)
      const assistant = await assistantRepo.findById(params.assistantId)

      if (!assistant) {
        logger.warn(`[DesktopProactiveChatService] 助手 ${params.assistantId} 不存在，使用默认消息`)
        return this.getDefaultMessage(params.triggerType)
      }

      const providerId = assistant.providerId || ''
      const modelId = assistant.modelId || ''

      const providerRegistry = AIProviderRegistry.getInstance()
      const provider = providerRegistry.getProvider(providerId)

      if (!provider) {
        logger.warn(`[DesktopProactiveChatService] Provider ${providerId} 不存在，使用默认消息`)
        return this.getDefaultMessage(params.triggerType)
      }

      const baseModel = provider.getLanguageModel(modelId)
      const model = wrapLanguageModelWithMiddlewares(baseModel, {
        providerType: provider.config?.type || 'openai',
        providerId: provider.config?.id ?? undefined,
        modelId,
        sessionId: undefined,
        baseUrl: provider.config?.baseUrl ?? undefined
      })

      const prompt = this.buildPrompt(params.triggerType, params.context, assistant.name)

      const { text } = await generateText({
        model,
        prompt,
        temperature: 0.7
      })

      return text.trim() || this.getDefaultMessage(params.triggerType)
    } catch (error) {
      logger.error('[DesktopProactiveChatService] AI 消息生成失败:', error as Error)
      return this.getDefaultMessage(params.triggerType)
    }
  }

  private buildPrompt(
    triggerType: TriggerType,
    context: TriggerContext,
    assistantName: string
  ): string {
    const baseContext = `你是 ${assistantName}，一个温暖贴心的 AI 助手。`

    switch (triggerType) {
      case 'time_greeting':
        return `${baseContext}\n\n现在是早晨时间，请向用户发送一条简短温暖的早安问候（不超过 30 字）。可以询问今天的计划或心情。`

      case 'diary_response':
        const daysSinceLastInteraction = context.lastInteractionDate
          ? Math.floor((Date.now() - context.lastInteractionDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0
        return `${baseContext}\n\n用户刚刚写了一篇日记。请发送一条简短的鼓励或回应（不超过 30 字），让用户感受到你在关注。${daysSinceLastInteraction > 0 ? `距离上次互动已有 ${daysSinceLastInteraction} 天。` : ''}`

      case 'silence_reminder':
        const daysSinceInteraction = context.lastInteractionDate
          ? Math.floor((Date.now() - context.lastInteractionDate.getTime()) / (1000 * 60 * 60 * 24))
          : 7
        return `${baseContext}\n\n已经有 ${daysSinceInteraction} 天没有见到用户了。请发送一条简短温暖的问候（不超过 30 字），表达关心并询问近况。`

      case 'sentiment_care':
        return `${baseContext}\n\n观察到用户最近的情绪状态可能不太好。请发送一条简短温暖的关怀消息（不超过 30 字），表达支持和陪伴。`

      default:
        return `${baseContext}\n\n请发送一条简短温暖的问候（不超过 30 字）。`
    }
  }

  private getDefaultMessage(triggerType: TriggerType): string {
    const greetings = {
      time_greeting: '早安！新的一天开始了，今天有什么计划吗？',
      diary_response: '看到你今天的日记了，感觉你今天过得不错！',
      silence_reminder: '好久没见到你了，最近过得怎么样？',
      sentiment_care: '感觉你最近情绪不太好，需要聊聊吗？'
    }

    return greetings[triggerType] || '你好！'
  }

  private async sendNotification(params: {
    title: string
    body: string
    sessionId?: string
  }): Promise<void> {
    await this.notificationService.sendNotification({
      title: params.title,
      body: params.body,
      sessionId: params.sessionId,
      silent: false
    })
  }

  private async saveTriggerHistory(
    history: Omit<CreateProactiveTriggerHistoryInput, 'id' | 'createdAt'>
  ): Promise<void> {
    await this.historyRepository.create(history)
  }

  private async getTriggerContext(assistantId: string): Promise<TriggerContext> {
    // TODO: 从数据库获取用户上下文
    logger.info('[DesktopProactiveChatService] 获取触发上下文', { assistantId })

    return {
      lastInteractionDate: new Date(),
      userActivityLevel: 'normal'
    }
  }
}
