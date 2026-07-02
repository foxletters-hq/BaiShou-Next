import { describe, it, expect } from 'vitest'
import { agentMessagesTable } from './agent-messages'

// 测试主动互动 Schema 扩展
// 调用方：Vitest 测试框架
// 用途：TDD 验证 agent_messages 表的主动互动字段定义正确
// 用户指示：按 MVP → P1 → P2 实现 AI 主动互动，使用 TDD 红→绿→重构
describe('agentMessagesTable schema', () => {
  it('should have isProactive field with boolean mode', () => {
    const schema = agentMessagesTable
    expect(schema.isProactive).toBeDefined()
    expect(schema.isProactive.dataType).toBe('boolean')
  })

  it('should have triggerId field as text', () => {
    const schema = agentMessagesTable
    expect(schema.triggerId).toBeDefined()
    expect(schema.triggerId.dataType).toBe('string')
  })

  it('should have triggerType field with enum constraint', () => {
    const schema = agentMessagesTable
    expect(schema.triggerType).toBeDefined()
    expect(schema.triggerType.enumValues).toEqual([
      'time_greeting',
      'diary_response',
      'silence_reminder',
      'sentiment_care'
    ])
  })

  it('should have userFeedback field with enum constraint', () => {
    const schema = agentMessagesTable
    expect(schema.userFeedback).toBeDefined()
    expect(schema.userFeedback.enumValues).toEqual(['positive', 'neutral', 'negative', 'dismissed'])
  })
})
