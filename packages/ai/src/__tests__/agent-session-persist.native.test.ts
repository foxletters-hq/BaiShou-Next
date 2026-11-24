import { describe, expect, it, vi } from 'vitest'
import { persistResult } from '../agent/agent-session-persist.native'
import { ModelPricingService } from '../pricing/model-pricing.service'

describe('native persistResult checkpoint reuse', () => {
  it('should replace parts on the checkpoint assistant instead of inserting a second row', async () => {
    vi.spyOn(ModelPricingService.getInstance(), 'calculateCostMicros').mockResolvedValue(0)
    const sessionRepo = {
      getMessagesBySession: vi.fn().mockResolvedValue([{ orderIndex: 1 }]),
      insertMessageWithParts: vi.fn().mockResolvedValue(undefined),
      replaceMessageParts: vi.fn().mockResolvedValue(undefined),
      updateTokenUsage: vi.fn().mockResolvedValue(undefined)
    }

    const flushSessionToDisk = vi.fn().mockResolvedValue(undefined)

    await persistResult({
      sessionId: 's1',
      rawUserText: 'hi',
      streamResult: { usage: Promise.resolve({ inputTokens: 1, outputTokens: 2 }) } as any,
      accumulator: {
        timeline: [],
        text: '最终回复',
        reasoning: '',
        sanitizedText: '最终回复',
        toolCalls: [],
        toolResults: [],
        usage: { inputTokens: 1, outputTokens: 2 }
      } as any,
      sessionRepo: sessionRepo as any,
      snapshotRepo: { getLatestSnapshot: vi.fn().mockResolvedValue(null) } as any,
      provider: { config: { id: 'mock', type: 'openai' } } as any,
      modelId: 'gpt-4',
      streamError: null,
      existingAssistantMessageId: 'asst-1',
      flushSessionToDisk
    })

    expect(sessionRepo.insertMessageWithParts).not.toHaveBeenCalled()
    expect(sessionRepo.replaceMessageParts).toHaveBeenCalledWith(
      'asst-1',
      's1',
      expect.any(Array),
      expect.objectContaining({ role: 'assistant', orderIndex: 2, outputTokens: 2 })
    )
    expect(flushSessionToDisk).toHaveBeenCalledWith('s1')
  })

  it('estimates fallback tokens without tiktoken when API returns empty usage', async () => {
    vi.spyOn(ModelPricingService.getInstance(), 'calculateCostMicros').mockResolvedValue(0)
    const sessionRepo = {
      getMessagesBySession: vi.fn().mockResolvedValue([]),
      insertMessageWithParts: vi.fn().mockResolvedValue(undefined),
      updateTokenUsage: vi.fn().mockResolvedValue(undefined)
    }

    const result = await persistResult({
      sessionId: 's-est',
      rawUserText: '这是一段测试用户输入内容',
      systemPrompt: '你是白守日记助手',
      streamResult: { totalUsage: Promise.resolve(undefined) } as any,
      accumulator: {
        timeline: [],
        text: '这是一段没有返回 usage 的助手回复',
        reasoning: '思考过程',
        sanitizedText: '这是一段没有返回 usage 的助手回复',
        toolCalls: [],
        toolResults: [],
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          cacheReadInputTokens: 0,
          cacheWriteInputTokens: 0
        }
      } as any,
      sessionRepo: sessionRepo as any,
      snapshotRepo: { getLatestSnapshot: vi.fn().mockResolvedValue(null) } as any,
      provider: { config: { id: 'mock', type: 'openai' } } as any,
      modelId: 'mock-model',
      streamError: null
    })

    expect(result.inputTokens).toBeGreaterThan(0)
    expect(result.outputTokens).toBeGreaterThan(0)
    expect(sessionRepo.updateTokenUsage).toHaveBeenCalledWith(
      's-est',
      result.inputTokens,
      result.outputTokens,
      0,
      0,
      0
    )
  })
})
