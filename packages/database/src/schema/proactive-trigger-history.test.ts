import { describe, it, expect } from 'vitest'
import { proactiveTriggerHistoryTable } from './proactive-trigger-history'

// 测试主动触发历史表 Schema
// 调用方：Vitest 测试框架
// 用途：TDD 验证 proactive_trigger_history 表结构正确
// 用户指示：按 MVP → P1 → P2 实现 AI 主动互动，使用 TDD 红→绿→重构，遵守项目 AI 编程规范
describe('proactiveTriggerHistoryTable schema', () => {
  it('should have id as primary key', () => {
    expect(proactiveTriggerHistoryTable.id).toBeDefined()
    expect(proactiveTriggerHistoryTable.id.primary).toBe(true)
  })

  it('should have triggerId and triggerType fields', () => {
    expect(proactiveTriggerHistoryTable.triggerId).toBeDefined()
    expect(proactiveTriggerHistoryTable.triggerType).toBeDefined()
    expect(proactiveTriggerHistoryTable.triggerType.enumValues).toEqual([
      'time_greeting',
      'diary_response',
      'silence_reminder',
      'sentiment_care'
    ])
  })

  it('should have assistantId field', () => {
    expect(proactiveTriggerHistoryTable.assistantId).toBeDefined()
    expect(proactiveTriggerHistoryTable.assistantId.notNull).toBe(true)
  })

  it('should have executionSuccess boolean field', () => {
    expect(proactiveTriggerHistoryTable.executionSuccess).toBeDefined()
    expect(proactiveTriggerHistoryTable.executionSuccess.dataType).toBe('boolean')
  })

  it('should have userInteracted field with default false', () => {
    expect(proactiveTriggerHistoryTable.userInteracted).toBeDefined()
    expect(proactiveTriggerHistoryTable.userInteracted.dataType).toBe('boolean')
  })

  it('should have timestamp fields', () => {
    expect(proactiveTriggerHistoryTable.triggerTime).toBeDefined()
    expect(proactiveTriggerHistoryTable.interactionTime).toBeDefined()
    expect(proactiveTriggerHistoryTable.createdAt).toBeDefined()
  })
})
