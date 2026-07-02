// 主动互动触发器类型定义
// 调用方：packages/core/src/proactive-chat/service.ts（待创建的 ProactiveChatService）
// 用途：定义主动互动的核心数据结构（设置、触发器、上下文、历史记录）
// 数据结构：与 database schema 的 proactive_trigger_history 表对应
// 用户指示：按 MVP → P1 → P2 实现 AI 主动互动，遵守项目 AI 编程规范

export type TriggerType = 'time_greeting' | 'diary_response' | 'silence_reminder' | 'sentiment_care'

export type UserFeedback = 'positive' | 'neutral' | 'negative' | 'dismissed'

export interface ProactiveChatSettings {
  enabled: boolean
  frequency: 'low' | 'medium' | 'high'
  maxTriggersPerDay: number
  minIntervalMinutes: number
  dndStartHour: number
  dndEndHour: number
  enabledScenarios: {
    timeBasedGreeting: boolean
    diaryResponse: boolean
    silenceReminder: boolean
    sentimentCare: boolean
  }
}

export interface ProactiveTrigger {
  id: string
  type: TriggerType
  assistantId: string
  enabled: boolean
  schedule?: {
    hour: number
    minute: number
  }
  condition?: {
    type: string
    params: Record<string, any>
  }
}

export interface TriggerContext {
  lastDiaryDate?: Date
  lastDiaryContent?: string
  lastInteractionDate?: Date
  recentSentiment?: 'positive' | 'neutral' | 'negative'
  userActivityLevel?: 'active' | 'normal' | 'inactive'
}

export interface ProactiveTriggerHistory {
  id: string
  triggerId: string
  triggerType: TriggerType
  assistantId: string
  sessionId?: string
  messageId?: string
  triggerTime: Date
  executionSuccess: boolean
  errorMessage?: string
  userInteracted: boolean
  interactionTime?: Date
  createdAt: Date
}
