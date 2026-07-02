import { logger } from '@baishou/shared'
import type {
  ProactiveChatSettings,
  ProactiveTrigger,
  TriggerContext,
  TriggerType,
  ProactiveTriggerHistory
} from './types'
import { FrequencyController } from './frequency-controller'
import { TimeTrigger } from './time-trigger'

// 主动互动核心服务：协调频率控制器和触发器，生成 AI 消息
// 调用方：apps/desktop/src/main（桌面端主进程）、apps/mobile/src（移动端）
// API：initialize、start、stop、scheduleTrigger、cancelTrigger、handleTrigger
// 依赖注入：generateAIMessage、sendNotification、saveTriggerHistory、getTriggerContext
// 用户指示：按 MVP → P1 → P2 实现 AI 主动互动，使用 TDD 红→绿→重构，遵守项目规范

export interface ProactiveChatServiceDeps {
  generateAIMessage: (params: {
    assistantId: string
    triggerType: TriggerType
    context: TriggerContext
  }) => Promise<string>
  sendNotification: (params: { title: string; body: string; sessionId?: string }) => Promise<void>
  saveTriggerHistory: (history: Omit<ProactiveTriggerHistory, 'id' | 'createdAt'>) => Promise<void>
  getTriggerContext: (assistantId: string) => Promise<TriggerContext>
}

export class ProactiveChatService {
  private frequencyController: FrequencyController
  private timeTrigger: TimeTrigger
  private settings: ProactiveChatSettings
  private deps: ProactiveChatServiceDeps
  private isRunning = false

  constructor(settings: ProactiveChatSettings, deps: ProactiveChatServiceDeps) {
    this.settings = settings
    this.deps = deps
    this.frequencyController = new FrequencyController(settings)
    this.timeTrigger = new TimeTrigger(this.handleTrigger.bind(this))
  }

  async initialize(): Promise<void> {
    logger.info('[ProactiveChatService] 初始化主动互动服务')
    this.isRunning = false
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('[ProactiveChatService] 服务已在运行')
      return
    }

    if (!this.settings.enabled) {
      logger.info('[ProactiveChatService] 主动互动已禁用')
      return
    }

    logger.info('[ProactiveChatService] 启动主动互动服务')
    this.isRunning = true
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    logger.info('[ProactiveChatService] 停止主动互动服务')
    this.isRunning = false
    this.timeTrigger.cancelAll()
  }

  updateSettings(settings: ProactiveChatSettings): void {
    this.settings = settings
    this.frequencyController.updateSettings(settings)

    if (!settings.enabled && this.isRunning) {
      this.stop()
    }
  }

  scheduleTrigger(trigger: ProactiveTrigger): void {
    if (!this.settings.enabled) {
      logger.debug('[ProactiveChatService] 主动互动已禁用，跳过调度')
      return
    }

    if (!trigger.enabled) {
      logger.debug(`[ProactiveChatService] 触发器 ${trigger.id} 已禁用`)
      return
    }

    if (trigger.type === 'time_greeting' && trigger.schedule) {
      this.timeTrigger.schedule(trigger)
      logger.info(`[ProactiveChatService] 已调度定时触发器: ${trigger.id}`)
    }
  }

  cancelTrigger(triggerId: string): void {
    this.timeTrigger.cancel(triggerId)
    logger.info(`[ProactiveChatService] 已取消触发器: ${triggerId}`)
  }

  private async handleTrigger(trigger: ProactiveTrigger): Promise<void> {
    logger.info(`[ProactiveChatService] 触发器触发: ${trigger.id} (${trigger.type})`)

    const canTrigger = await this.frequencyController.canTrigger()
    if (!canTrigger) {
      logger.debug(`[ProactiveChatService] 触发器 ${trigger.id} 被频率控制器阻止`)
      return
    }

    try {
      const context = await this.deps.getTriggerContext(trigger.assistantId)

      const message = await this.deps.generateAIMessage({
        assistantId: trigger.assistantId,
        triggerType: trigger.type,
        context
      })

      await this.deps.sendNotification({
        title: this.getNotificationTitle(trigger.type),
        body: message
      })

      await this.deps.saveTriggerHistory({
        triggerId: trigger.id,
        triggerType: trigger.type,
        assistantId: trigger.assistantId,
        triggerTime: new Date(),
        executionSuccess: true,
        userInteracted: false
      })

      this.frequencyController.recordTrigger(trigger.id)

      logger.info(`[ProactiveChatService] 触发器 ${trigger.id} 执行成功`)
    } catch (error) {
      logger.error('[ProactiveChatService] 触发器执行失败:', error as Error)

      await this.deps.saveTriggerHistory({
        triggerId: trigger.id,
        triggerType: trigger.type,
        assistantId: trigger.assistantId,
        triggerTime: new Date(),
        executionSuccess: false,
        errorMessage: error instanceof Error ? error.message : String(error),
        userInteracted: false
      })
    }
  }

  private getNotificationTitle(triggerType: TriggerType): string {
    switch (triggerType) {
      case 'time_greeting':
        return '早安问候'
      case 'diary_response':
        return '日记回应'
      case 'silence_reminder':
        return '静默提醒'
      case 'sentiment_care':
        return '情感关怀'
      default:
        return 'AI 消息'
    }
  }

  getNextTriggerTime(): Date {
    return this.frequencyController.getNextTriggerTime()
  }
}
