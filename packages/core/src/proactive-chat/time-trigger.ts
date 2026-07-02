import { logger } from '@baishou/shared'
import type { ProactiveTrigger } from './types'

// 定时触发器：在指定时间触发问候
// 调用方：ProactiveChatService
// API：schedule、cancel、checkAndExecute
// 用户指示：按 MVP → P1 → P2 实现 AI 主动互动，P0-MVP 实现定时问候

export class TimeTrigger {
  private timers: Map<string, NodeJS.Timeout> = new Map()
  private onTrigger: (trigger: ProactiveTrigger) => Promise<void>

  constructor(onTrigger: (trigger: ProactiveTrigger) => Promise<void>) {
    this.onTrigger = onTrigger
  }

  schedule(trigger: ProactiveTrigger): void {
    if (!trigger.schedule) {
      logger.warn(`[TimeTrigger] 触发器 ${trigger.id} 没有 schedule 配置`)
      return
    }

    if (!trigger.enabled) {
      logger.debug(`[TimeTrigger] 触发器 ${trigger.id} 已禁用，跳过调度`)
      return
    }

    // 取消已有的定时器
    this.cancel(trigger.id)

    const { hour, minute } = trigger.schedule
    const nextTriggerTime = this.getNextTriggerTime(hour, minute)
    const delayMs = nextTriggerTime.getTime() - Date.now()

    logger.info(
      `[TimeTrigger] 调度触发器 ${trigger.id}，下次触发时间：${nextTriggerTime.toLocaleString()}`
    )

    const timer = setTimeout(async () => {
      try {
        await this.onTrigger(trigger)
      } catch (error) {
        logger.error('[TimeTrigger] 触发器执行失败', error as Error)
      }

      // 执行后重新调度下一次
      this.schedule(trigger)
    }, delayMs)

    this.timers.set(trigger.id, timer)
  }

  cancel(triggerId: string): void {
    const timer = this.timers.get(triggerId)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(triggerId)
      logger.debug(`[TimeTrigger] 取消触发器 ${triggerId}`)
    }
  }

  cancelAll(): void {
    for (const [triggerId] of this.timers) {
      this.cancel(triggerId)
    }
  }

  private getNextTriggerTime(hour: number, minute: number): Date {
    const now = new Date()
    const next = new Date()
    next.setHours(hour, minute, 0, 0)

    // 如果今天的时间已过，推到明天
    if (next <= now) {
      next.setDate(next.getDate() + 1)
    }

    return next
  }
}
