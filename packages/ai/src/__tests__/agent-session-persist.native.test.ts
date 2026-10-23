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
      existingAssistantMessageId: 'asst-1'
    })

    expect(sessionRepo.insertMessageWithParts).not.toHaveBeenCalled()
    expect(sessionRepo.replaceMessageParts).toHaveBeenCalledWith(
      'asst-1',
      's1',
      expect.any(Array),
      expect.objectContaining({ outputTokens: 2 })
    )
  })
})
