import { logger } from '@baishou/shared'
import type { ProactiveChatSettings } from './types'

// 频率控制器：防止过度打扰用户
// 调用方：packages/core/src/proactive-chat/service.ts（ProactiveChatService）
// API：canTrigger、recordTrigger、getNextTriggerTime
// 数据结构：维护内存中的 triggerHistory（TriggerAttempt[]）
// 用户指示：按 MVP → P1 → P2 实现 AI 主动互动，使用 TDD，遵守项目规范

export interface TriggerAttempt {
  triggerId: string
  timestamp: Date
}

export class FrequencyController {
  private triggerHistory: TriggerAttempt[] = []
  private settings: ProactiveChatSettings

  constructor(settings: ProactiveChatSettings) {
    this.settings = settings
  }

  updateSettings(settings: ProactiveChatSettings): void {
    this.settings = settings
  }

  async canTrigger(): Promise<boolean> {
    if (!this.settings.enabled) {
      logger.debug('[FrequencyController] 主动互动已关闭')
      return false
    }

    const now = new Date()

    // 检查免打扰时段
    if (this.isInDndPeriod(now)) {
      logger.debug('[FrequencyController] 当前处于免打扰时段')
      return false
    }

    // 检查每日上限
    const todayCount = this.getTodayTriggerCount()
    if (todayCount >= this.settings.maxTriggersPerDay) {
      logger.debug(`[FrequencyController] 已达每日上限 ${this.settings.maxTriggersPerDay}`)
      return false
    }

    // 检查最小间隔
    const lastTrigger = this.getLastTrigger()
    if (lastTrigger) {
      const minutesSinceLastTrigger =
        (now.getTime() - lastTrigger.timestamp.getTime()) / (1000 * 60)
      if (minutesSinceLastTrigger < this.settings.minIntervalMinutes) {
        logger.debug(
          `[FrequencyController] 距上次触发仅 ${minutesSinceLastTrigger.toFixed(1)} 分钟，未达最小间隔 ${this.settings.minIntervalMinutes}`
        )
        return false
      }
    }

    return true
  }

  recordTrigger(triggerId: string): void {
    this.triggerHistory.push({
      triggerId,
      timestamp: new Date()
    })

    // 清理 7 天前的历史
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    this.triggerHistory = this.triggerHistory.filter((t) => t.timestamp > sevenDaysAgo)
  }

  getNextTriggerTime(currentTime: Date = new Date()): Date {
    const next = new Date(currentTime)

    // 如果当前在免打扰时段，跳到免打扰结束
    if (this.isInDndPeriod(currentTime)) {
      next.setHours(this.settings.dndEndHour, 0, 0, 0)
      if (next <= currentTime) {
        next.setDate(next.getDate() + 1)
      }
      return next
    }

    // 否则加上最小间隔
    next.setMinutes(next.getMinutes() + this.settings.minIntervalMinutes)

    // 如果跳到了免打扰时段，继续推迟到免打扰结束
    if (this.isInDndPeriod(next)) {
      next.setHours(this.settings.dndEndHour, 0, 0, 0)
      if (next.getHours() < this.settings.dndEndHour) {
        next.setDate(next.getDate() + 1)
      }
    }

    return next
  }

  private isInDndPeriod(time: Date): boolean {
    const hour = time.getHours()
    const { dndStartHour, dndEndHour } = this.settings

    if (dndStartHour < dndEndHour) {
      return hour >= dndStartHour && hour < dndEndHour
    } else {
      // 跨午夜的情况（如 23:00-08:00）
      return hour >= dndStartHour || hour < dndEndHour
    }
  }

  private getTodayTriggerCount(): number {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    return this.triggerHistory.filter((t) => t.timestamp >= todayStart).length
  }

  private getLastTrigger(): TriggerAttempt | undefined {
    if (this.triggerHistory.length === 0) {
      return undefined
    }
    return this.triggerHistory[this.triggerHistory.length - 1]
  }
}
