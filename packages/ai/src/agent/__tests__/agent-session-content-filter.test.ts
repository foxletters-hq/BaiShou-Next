import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PROVIDER_CONTENT_FILTER_MESSAGE, logger } from '@baishou/shared'
import { StreamAccumulator } from '../stream-accumulator'
import { finishAgentSessionStream } from '../agent-session-stream-finish'
import { ModelPricingService } from '../../pricing/model-pricing.service'

describe('agent session content filter handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(ModelPricingService.getInstance(), 'calculateCostMicros').mockResolvedValue(0)
  })

  it('captures finishReason, rawFinishReason, and Google promptFeedback without spamming unknown chunk logs for tool-input-delta', () => {
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {})
    const acc = new StreamAccumulator()

    acc.add({
      type: 'tool-input-delta',
      id: 'call-1',
      delta: '{}',
      providerMetadata: { google: { thoughtSignature: 'secret-sig' } }
    })
    acc.add({
      type: 'tool-input-end',
      id: 'call-1',
      providerMetadata: { google: { thoughtSignature: 'secret-sig' } }
    })
    acc.add({
      type: 'finish-step',
      finishReason: 'content-filter',
      rawFinishReason: 'PROHIBITED_CONTENT',
      usage: { inputTokens: 100, outputTokens: 0 },
      providerMetadata: {
        google: {
          finishMessage: 'Blocked by safety filter',
          promptFeedback: { blockReason: 'PROHIBITED_CONTENT' }
        }
      }
    })

    expect(acc.finishReason).toBe('content-filter')
    expect(acc.rawFinishReason).toBe('PROHIBITED_CONTENT')
    expect(acc.providerFinishMessage).toBe('Blocked by safety filter')
    expect(acc.promptBlockReason).toBe('PROHIBITED_CONTENT')
    expect(
      infoSpy.mock.calls.some((args) =>
        String(args[0]).includes('Unknown chunk with potential usage metadata')
      )
    ).toBe(false)
  })

  it('reports gentle content filter error instead of attachment hint when zero output finishes with content-filter', async () => {
    const acc = new StreamAccumulator()
    acc.add({
      type: 'finish-step',
      finishReason: 'content-filter',
      rawFinishReason: 'PROHIBITED_CONTENT',
      usage: { inputTokens: 100, outputTokens: 0 }
    })

    const onError = vi.fn()
    const onFinish = vi.fn()
    const sessionRepo = {
      getMessagesBySession: vi.fn().mockResolvedValue([{ id: 'u1', role: 'user', orderIndex: 1 }]),
      replaceMessageParts: vi.fn().mockResolvedValue(undefined),
      insertMessageWithParts: vi.fn().mockResolvedValue(undefined),
      updateTokenUsage: vi.fn().mockResolvedValue(undefined)
    }

    await finishAgentSessionStream({
      options: {
        sessionId: 's-filter-1',
        userText: 'hello',
        userMessageId: 'u1',
        skipUserMessageRecording: true,
        sessionRepo: sessionRepo as any,
        snapshotRepo: { getLatestSnapshot: vi.fn().mockResolvedValue(null) } as any,
        provider: { config: { id: 'gemini', type: 'gemini' } } as any,
        modelId: 'gemini-4-hydrogen',
        toolRegistry: {} as any
      },
      callbacks: { onError, onFinish },
      streamResult: null,
      streamError: null,
      accumulator: acc,
      assistantCheckpoint: {
        assistantMessageId: 'a1',
        drain: vi.fn().mockResolvedValue(null),
        discard: vi.fn().mockResolvedValue(undefined)
      } as any,
      doomTripped: false,
      dbHistory: [],
      builtSystemPrompt: '',
      mergedUserConfig: {},
      gateSessionBuffer: { buildPartDataList: () => [] } as any,
      workspaceSessionBuffer: { buildPartDataList: () => [] } as any,
      runtimeRecorder: { record: vi.fn() } as any,
      recordRuntimeInterrupted: vi.fn()
    })

    expect(onFinish).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0]?.[0]?.message).toBe(PROVIDER_CONTENT_FILTER_MESSAGE)
    expect(sessionRepo.insertMessageWithParts).not.toHaveBeenCalled()
  })

  it('preserves partial output and reports gentle content filter error when mid-stream blocked', async () => {
    const acc = new StreamAccumulator()
    acc.add({ type: 'text-delta', textDelta: '先说了半句话' })
    acc.add({
      type: 'finish-step',
      finishReason: 'other',
      rawFinishReason: 'SAFETY',
      usage: { inputTokens: 100, outputTokens: 10 }
    })

    const onError = vi.fn()
    const sessionRepo = {
      getMessagesBySession: vi.fn().mockResolvedValue([{ id: 'u1', role: 'user', orderIndex: 1 }]),
      replaceMessageParts: vi.fn().mockResolvedValue(undefined),
      insertMessageWithParts: vi.fn().mockResolvedValue(undefined),
      updateTokenUsage: vi.fn().mockResolvedValue(undefined)
    }

    await finishAgentSessionStream({
      options: {
        sessionId: 's-filter-2',
        userText: 'hello',
        userMessageId: 'u1',
        skipUserMessageRecording: true,
        sessionRepo: sessionRepo as any,
        snapshotRepo: { getLatestSnapshot: vi.fn().mockResolvedValue(null) } as any,
        provider: { config: { id: 'openai', type: 'openai' } } as any,
        modelId: 'gpt-4o',
        toolRegistry: {} as any
      },
      callbacks: { onError },
      streamResult: null,
      streamError: null,
      accumulator: acc,
      assistantCheckpoint: {
        assistantMessageId: 'a1',
        drain: vi.fn().mockResolvedValue(null),
        discard: vi.fn().mockResolvedValue(undefined)
      } as any,
      doomTripped: false,
      dbHistory: [],
      builtSystemPrompt: '',
      mergedUserConfig: {},
      gateSessionBuffer: { buildPartDataList: () => [] } as any,
      workspaceSessionBuffer: { buildPartDataList: () => [] } as any,
      runtimeRecorder: { record: vi.fn() } as any,
      recordRuntimeInterrupted: vi.fn()
    })

    expect(sessionRepo.insertMessageWithParts).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0]?.[0]?.message).toBe(PROVIDER_CONTENT_FILTER_MESSAGE)
  })

  it('does not blame attachments when plain text prompt produces empty output without filter metadata', async () => {
    const acc = new StreamAccumulator()
    const onError = vi.fn()
    const sessionRepo = {
      getMessagesBySession: vi.fn().mockResolvedValue([{ id: 'u1', role: 'user', orderIndex: 1 }]),
      replaceMessageParts: vi.fn().mockResolvedValue(undefined),
      insertMessageWithParts: vi.fn().mockResolvedValue(undefined),
      updateTokenUsage: vi.fn().mockResolvedValue(undefined)
    }

    await finishAgentSessionStream({
      options: {
        sessionId: 's-empty-plain',
        userText: 'hello',
        userMessageId: 'u1',
        skipUserMessageRecording: true,
        sessionRepo: sessionRepo as any,
        snapshotRepo: { getLatestSnapshot: vi.fn().mockResolvedValue(null) } as any,
        provider: { config: { id: 'gemini', type: 'gemini' } } as any,
        modelId: 'gemini-2.5-pro',
        toolRegistry: {} as any
      },
      callbacks: { onError },
      streamResult: null,
      streamError: null,
      accumulator: acc,
      assistantCheckpoint: {
        assistantMessageId: 'a1',
        drain: vi.fn().mockResolvedValue(null),
        discard: vi.fn().mockResolvedValue(undefined)
      } as any,
      doomTripped: false,
      dbHistory: [],
      builtSystemPrompt: '',
      mergedUserConfig: {},
      gateSessionBuffer: { buildPartDataList: () => [] } as any,
      workspaceSessionBuffer: { buildPartDataList: () => [] } as any,
      runtimeRecorder: { record: vi.fn() } as any,
      recordRuntimeInterrupted: vi.fn()
    })

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0]?.[0]?.message).not.toContain('请检查附件格式')
  })
})
