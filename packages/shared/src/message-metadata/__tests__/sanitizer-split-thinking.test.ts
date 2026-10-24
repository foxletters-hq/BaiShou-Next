import { describe, expect, it } from 'vitest'
import { splitThinkingFromAssistantText } from '../sanitizer'

describe('splitThinkingFromAssistantText', () => {
  it('should split closed think tags into reasoningText and cleanText', () => {
    const raw = '<think>这是模型的思考过程</think>你好！我是白守。'
    const result = splitThinkingFromAssistantText(raw)
    expect(result.reasoningText).toBe('这是模型的思考过程')
    expect(result.cleanText).toBe('你好！我是白守。')
  })

  it('should support redacted_thinking and thinking tag styles', () => {
    const raw1 = '<redacted_thinking>深层推理</redacted_thinking>这是结论。'
    const res1 = splitThinkingFromAssistantText(raw1)
    expect(res1.reasoningText).toBe('深层推理')
    expect(res1.cleanText).toBe('这是结论。')

    const raw2 = '<thinking>计划一下步骤</thinking>第一步：先做这个。'
    const res2 = splitThinkingFromAssistantText(raw2)
    expect(res2.reasoningText).toBe('计划一下步骤')
    expect(res2.cleanText).toBe('第一步：先做这个。')
  })

  it('should join multiple thinking blocks with double newlines', () => {
    const raw = '<think>思考第一步</think>中间插话<think>思考第二步</think>最终回答'
    const result = splitThinkingFromAssistantText(raw)
    expect(result.reasoningText).toBe('思考第一步\n\n思考第二步')
    expect(result.cleanText).toContain('中间插话')
    expect(result.cleanText).toContain('最终回答')
  })

  it('should return undefined reasoningText when no think blocks exist', () => {
    const raw = '这是一段普通的助手回答。'
    const result = splitThinkingFromAssistantText(raw)
    expect(result.reasoningText).toBeUndefined()
    expect(result.cleanText).toBe('这是一段普通的助手回答。')
  })

  it('should handle pure thinking content', () => {
    const raw = '<think>仅有思考过程，尚未生成回答</think>'
    const result = splitThinkingFromAssistantText(raw)
    expect(result.reasoningText).toBe('仅有思考过程，尚未生成回答')
    expect(result.cleanText).toBe('')
  })

  it('should unwrap message-content metadata wrappers properly', () => {
    const raw = '<message-content><think>内部思考</think>你好呀！🦊</message-content>'
    const result = splitThinkingFromAssistantText(raw)
    expect(result.reasoningText).toBe('内部思考')
    expect(result.cleanText).toBe('你好呀！🦊')
  })
})
