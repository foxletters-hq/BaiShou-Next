import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { finishAgentSessionStream } from '../agent-session-stream-finish'
import {
  claimAgentStreamSession,
  resetAgentStreamSessionGuardForTests
} from '../stream-session-guard'
import { ModelPricingService } from '../../pricing/model-pricing.service'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'agent-session-stream-finish.ts'),
  'utf8'
)

describe('agent session stream finish chrome', () => {
  it('should report first-output timeout instead of treating it as a user stop', () => {
    expect(src).toContain('isAgentStreamUserAborted')
    expect(src).toContain('isAgentFirstOutputTimeoutError')
  })

  it('should complete a waiting companion_ask when the user stops the stream', () => {
    expect(src).toContain('applyRejectedCompanionAskResults')
    expect(src).toMatch(/isAgentGateRejectedError\(streamError\)\s*\|\|\s*userAborted/)
  })

  it('should fail incomplete tools and report unexpected abort as an error', () => {
    expect(src).toContain('applyFailedIncompleteToolResults')
    expect(src).toContain('UNEXPECTED_AGENT_STREAM_ABORT_MESSAGE')
    expect(src).toContain('abortSignal?.aborted')
    expect(src).toMatch(/existingAssistantMessageId,\s*userAborted/)
  })

  it('should persist the round instead of aborting it as a doom-loop interrupt', () => {
    expect(src).not.toContain('检测到工具调用死循环，已中断本轮')
    expect(src).not.toContain('Skip persist for session ${sessionId}: doom-loop')
  })

  it('should preserve assistant output when superseded by a subsequent user turn instead of discarding it', async () => {
    expect(src).toContain('shouldPreserveSupersededTurn')
    expect(src).toContain('hasSubsequentUserTurn && !hasExistingAssistantReply')

    resetAgentStreamSessionGuardForTests()
    vi.spyOn(ModelPricingService.getInstance(), 'calculateCostMicros').mockResolvedValue(0)

    const turn1Claim = claimAgentStreamSession('s1')
    // Turn 2 claims session before Turn 1 finishes
    claimAgentStreamSession('s1')

    const sessionRepo = {
      getMessageById: vi.fn().mockResolvedValue({ id: 'u1', role: 'user', orderIndex: 1 }),
      getMessagesBySession: vi.fn().mockResolvedValue([
        { id: 'u1', role: 'user', orderIndex: 1 },
        { id: 'asst-1', role: 'assistant', orderIndex: 2 },
        { id: 'u2', role: 'user', orderIndex: 3 }
      ]),
      replaceMessageParts: vi.fn().mockResolvedValue(undefined),
      insertMessageWithParts: vi.fn().mockResolvedValue(undefined),
      updateTokenUsage: vi.fn().mockResolvedValue(undefined)
    }
    const assistantCheckpoint = {
      assistantMessageId: 'asst-1',
      drain: vi.fn().mockResolvedValue('asst-1'),
      discard: vi.fn().mockResolvedValue(undefined)
    }

    await finishAgentSessionStream({
      options: {
        sessionId: 's1',
        userText: '第一条问题',
        userMessageId: 'u1',
        skipUserMessageRecording: true,
        streamClaimGeneration: turn1Claim.generation,
        sessionRepo: sessionRepo as any,
        snapshotRepo: { getLatestSnapshot: vi.fn().mockResolvedValue(null) } as any,
        provider: { config: { id: 'mock', type: 'openai' } } as any,
        modelId: 'gpt-4o',
        toolRegistry: {} as any
      },
      streamResult: { totalUsage: Promise.resolve({ inputTokens: 5, outputTokens: 10 }) },
      streamError: null,
      accumulator: {
        timeline: [{ kind: 'text', text: '第一条回复' }],
        text: '第一条回复',
        reasoning: '',
        sanitizedText: '第一条回复',
        toolCalls: [],
        toolResults: [],
        usage: { inputTokens: 5, outputTokens: 10 }
      } as any,
      assistantCheckpoint: assistantCheckpoint as any,
      doomTripped: false,
      dbHistory: [],
      builtSystemPrompt: '',
      mergedUserConfig: {},
      gateSessionBuffer: { buildPartDataList: () => [] } as any,
      workspaceSessionBuffer: { buildPartDataList: () => [] } as any,
      runtimeRecorder: {
        recordCompleted: vi.fn(),
        recordFailed: vi.fn()
      } as any,
      recordRuntimeInterrupted: vi.fn()
    })

    expect(assistantCheckpoint.discard).not.toHaveBeenCalled()
    expect(assistantCheckpoint.drain).toHaveBeenCalledTimes(1)
    expect(sessionRepo.replaceMessageParts).toHaveBeenCalledWith(
      'asst-1',
      's1',
      expect.any(Array),
      expect.objectContaining({ outputTokens: 10 })
    )
  })

  it('should still discard assistant checkpoint when superseded by regenerate without a subsequent user turn', async () => {
    resetAgentStreamSessionGuardForTests()

    const turn1Claim = claimAgentStreamSession('s1')
    claimAgentStreamSession('s1')

    const sessionRepo = {
      getMessageById: vi.fn().mockResolvedValue({ id: 'u1', role: 'user', orderIndex: 1 }),
      getMessagesBySession: vi.fn().mockResolvedValue([{ id: 'u1', role: 'user', orderIndex: 1 }]),
      replaceMessageParts: vi.fn().mockResolvedValue(undefined),
      insertMessageWithParts: vi.fn().mockResolvedValue(undefined),
      updateTokenUsage: vi.fn().mockResolvedValue(undefined)
    }
    const assistantCheckpoint = {
      assistantMessageId: 'asst-1',
      drain: vi.fn().mockResolvedValue('asst-1'),
      discard: vi.fn().mockResolvedValue(undefined)
    }

    await finishAgentSessionStream({
      options: {
        sessionId: 's1',
        userText: '第一条问题',
        userMessageId: 'u1',
        skipUserMessageRecording: true,
        streamClaimGeneration: turn1Claim.generation,
        sessionRepo: sessionRepo as any,
        snapshotRepo: { getLatestSnapshot: vi.fn().mockResolvedValue(null) } as any,
        provider: { config: { id: 'mock', type: 'openai' } } as any,
        modelId: 'gpt-4o',
        toolRegistry: {} as any
      },
      streamResult: null,
      streamError: null,
      accumulator: {
        timeline: [{ kind: 'text', text: '旧回复' }],
        text: '旧回复',
        reasoning: '',
        sanitizedText: '旧回复',
        toolCalls: [],
        toolResults: [],
        usage: { inputTokens: 0, outputTokens: 0 }
      } as any,
      assistantCheckpoint: assistantCheckpoint as any,
      doomTripped: false,
      dbHistory: [],
      builtSystemPrompt: '',
      mergedUserConfig: {},
      gateSessionBuffer: { buildPartDataList: () => [] } as any,
      workspaceSessionBuffer: { buildPartDataList: () => [] } as any,
      runtimeRecorder: {
        recordCompleted: vi.fn(),
        recordFailed: vi.fn()
      } as any,
      recordRuntimeInterrupted: vi.fn()
    })

    expect(assistantCheckpoint.discard).toHaveBeenCalledTimes(1)
    expect(sessionRepo.replaceMessageParts).not.toHaveBeenCalled()
  })
})
