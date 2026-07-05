import { describe, it, expect, vi } from 'vitest'
import { persistResult } from '../agent/agent-session-persist'
import type { MessageWithParts } from '../agent/message.adapter'

function makeMsg(id: string, role: string, orderIndex: number, text: string): MessageWithParts {
  return {
    id,
    sessionId: 's1',
    role: role as MessageWithParts['role'],
    isSummary: false,
    orderIndex,
    createdAt: new Date(),
    parts: [
      {
        id: `p-${id}`,
        messageId: id,
        sessionId: 's1',
        type: 'text',
        data: { text }
      }
    ]
  }
}

import { ModelPricingService } from '../pricing/model-pricing.service'

describe('persistResult token estimation', () => {
  it(
    'should estimate input tokens correctly when api usage is missing',
    { timeout: 60_000 },
    async () => {
      vi.spyOn(ModelPricingService.getInstance(), 'calculateCostMicros').mockResolvedValue(0)
      const sessionRepo = {
        getMessagesBySession: vi.fn().mockResolvedValue([]),
        insertMessageWithParts: vi.fn().mockResolvedValue(undefined),
        updateTokenUsage: vi.fn().mockResolvedValue(undefined)
      }

      const snapshotRepo = {
        getLatestSnapshot: vi.fn().mockResolvedValue(null)
      }

      const provider = {
        config: {
          id: 'mock-provider',
          type: 'openai'
        }
      }

      const accumulator = {
        text: 'AI response text',
        reasoning: '',
        toolCalls: [],
        toolResults: [],
        usage: {
          inputTokens: 0,
          outputTokens: 0
        }
      }

      const streamResult = {
        usage: Promise.resolve(undefined) // usage missing
      }

      const dbHistory = [
        makeMsg('1', 'user', 1, 'Hello old message'),
        makeMsg('2', 'assistant', 2, 'Hi there')
      ]

      const systemPrompt = 'You are a helpful assistant'
      const rawUserText = 'Current user message'

      await persistResult({
        sessionId: 's1',
        rawUserText,
        streamResult: streamResult as any,
        accumulator: accumulator as any,
        sessionRepo: sessionRepo as any,
        snapshotRepo: snapshotRepo as any,
        provider: provider as any,
        modelId: 'gpt-4',
        streamError: null,
        dbHistory,
        systemPrompt
      })

      // Assertions
      expect(sessionRepo.insertMessageWithParts).toHaveBeenCalled()
      const insertedMessage = sessionRepo.insertMessageWithParts.mock.calls[0]![0]

      // We expect the inputTokens to be estimated using tiktoken (cl100k_base)
      const { get_encoding } = await import('tiktoken')
      const enc = get_encoding('cl100k_base')
      const expectedInputTokens =
        enc.encode(rawUserText).length +
        enc.encode(systemPrompt).length +
        enc.encode('Hello old message').length +
        enc.encode('Hi there').length
      enc.free()

      expect(insertedMessage.inputTokens).toBe(expectedInputTokens)
    }
  )

  it('writes cache read/write tokens to message row and session totals', async () => {
    vi.spyOn(ModelPricingService.getInstance(), 'calculateCostMicros').mockResolvedValue(42)

    const sessionRepo = {
      getMessagesBySession: vi.fn().mockResolvedValue([{ orderIndex: 2 }]),
      insertMessageWithParts: vi.fn().mockResolvedValue(undefined),
      updateTokenUsage: vi.fn().mockResolvedValue(undefined)
    }

    const snapshotRepo = {
      getLatestSnapshot: vi.fn().mockResolvedValue(null)
    }

    const provider = {
      config: {
        id: 'deepseek',
        type: 'openai'
      }
    }

    const accumulator = {
      text: 'cached reply',
      reasoning: '',
      toolCalls: [],
      toolResults: [],
      usage: {
        inputTokens: 1200,
        outputTokens: 80,
        cacheReadInputTokens: 960,
        cacheWriteInputTokens: 0
      }
    }

    const streamResult = {
      usage: Promise.resolve({
        inputTokens: 1200,
        outputTokens: 80,
        cacheReadInputTokens: 960,
        cacheWriteInputTokens: 0
      })
    }

    await persistResult({
      sessionId: 's1',
      rawUserText: 'follow-up',
      streamResult: streamResult as any,
      accumulator: accumulator as any,
      sessionRepo: sessionRepo as any,
      snapshotRepo: snapshotRepo as any,
      provider: provider as any,
      modelId: 'deepseek-chat',
      streamError: null
    })

    expect(sessionRepo.insertMessageWithParts).toHaveBeenCalled()
    const insertedMessage = sessionRepo.insertMessageWithParts.mock.calls[0]![0]
    expect(insertedMessage.inputTokens).toBe(1200)
    expect(insertedMessage.outputTokens).toBe(80)
    expect(insertedMessage.cacheReadInputTokens).toBe(960)
    expect(insertedMessage.cacheWriteInputTokens).toBe(0)
    expect(insertedMessage.costMicros).toBe(42)

    expect(sessionRepo.updateTokenUsage).toHaveBeenCalledWith('s1', 1200, 80, 42, 960, 0)
  })

  it('anchors assistant orderIndex to user message on resend even if stale assistant remains', async () => {
    vi.spyOn(ModelPricingService.getInstance(), 'calculateCostMicros').mockResolvedValue(0)

    const sessionRepo = {
      getMessagesBySession: vi.fn().mockResolvedValue([{ orderIndex: 4 }]),
      getMessageById: vi.fn().mockResolvedValue({ id: 'user-1', orderIndex: 2 }),
      insertMessageWithParts: vi.fn().mockResolvedValue(undefined),
      updateTokenUsage: vi.fn().mockResolvedValue(undefined)
    }

    const snapshotRepo = {
      getLatestSnapshot: vi.fn().mockResolvedValue(null)
    }

    const provider = {
      config: {
        id: 'mock-provider',
        type: 'openai'
      }
    }

    const accumulator = {
      text: 'new reply',
      reasoning: '',
      toolCalls: [],
      toolResults: [],
      usage: {
        inputTokens: 10,
        outputTokens: 5
      }
    }

    const streamResult = {
      usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 })
    }

    await persistResult({
      sessionId: 's1',
      rawUserText: 'hello again',
      streamResult: streamResult as any,
      accumulator: accumulator as any,
      sessionRepo: sessionRepo as any,
      snapshotRepo: snapshotRepo as any,
      provider: provider as any,
      modelId: 'gpt-4',
      skipUserMessageRecording: true,
      userMessageId: 'user-1',
      streamError: null
    })

    expect(sessionRepo.getMessageById).toHaveBeenCalledWith('user-1')
    const insertedMessage = sessionRepo.insertMessageWithParts.mock.calls[0]![0]
    expect(insertedMessage.orderIndex).toBe(3)
  })

  it('does not crash when streamResult.usage rejects with undefined', async () => {
    vi.spyOn(ModelPricingService.getInstance(), 'calculateCostMicros').mockResolvedValue(0)

    const sessionRepo = {
      getMessagesBySession: vi.fn().mockResolvedValue([{ orderIndex: 1 }]),
      insertMessageWithParts: vi.fn().mockResolvedValue(undefined),
      updateTokenUsage: vi.fn().mockResolvedValue(undefined)
    }

    const snapshotRepo = {
      getLatestSnapshot: vi.fn().mockResolvedValue(null)
    }

    const provider = {
      config: {
        id: 'mock-provider',
        type: 'openai'
      }
    }

    const accumulator = {
      text: 'search summary',
      reasoning: '',
      toolCalls: [{ callId: 'call_1', name: 'web_search', arguments: '{"q":"news"}' }],
      toolResults: [{ callId: 'call_1', result: 'ok' }],
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheWriteInputTokens: 0
      }
    }

    const streamResult = {
      usage: Promise.reject(undefined)
    }

    await persistResult({
      sessionId: 's1',
      rawUserText: 'search news',
      streamResult: streamResult as any,
      accumulator: accumulator as any,
      sessionRepo: sessionRepo as any,
      snapshotRepo: snapshotRepo as any,
      provider: provider as any,
      modelId: 'gpt-4',
      streamError: null
    })

    expect(sessionRepo.insertMessageWithParts).toHaveBeenCalled()
  })
})
