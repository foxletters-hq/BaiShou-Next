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

describe('persistResult token estimation', () => {
  it('should estimate input tokens correctly when api usage is missing', async () => {
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
  })
})
