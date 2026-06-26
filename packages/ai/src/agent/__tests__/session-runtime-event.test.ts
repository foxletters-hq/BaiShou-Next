import { describe, it, expect, beforeEach } from 'vitest'
import { ChunkType, type StreamChunk } from '../stream-chunk.types'
import { StreamChunkAdapter } from '../stream-chunk.adapter'
import { StreamAccumulator } from '../stream-accumulator'
import {
  AgentSessionRuntimeRecorder,
  bridgeStreamChunkToRuntimeEvents,
  createSessionRuntimeBridgeState,
  onAgentSessionRuntime,
  resetAgentSessionRuntimeForTests
} from '../session-runtime-event'

describe('session-runtime-event bridge', () => {
  beforeEach(() => {
    resetAgentSessionRuntimeForTests()
  })

  it('maps tool call / result / step finish in order', () => {
    const state = createSessionRuntimeBridgeState()
    const sessionId = 'sess-1'
    const chunks: StreamChunk[] = [
      { type: ChunkType.TOOL_CALL, toolCallId: 'tc1', toolName: 'read_file', input: { path: 'a.ts' } },
      { type: ChunkType.TOOL_RESULT, toolCallId: 'tc1', toolName: 'read_file', output: 'ok' },
      {
        type: ChunkType.STEP_FINISH,
        finishReason: 'tool-calls',
        usage: { inputTokens: 10, outputTokens: 5 }
      },
      { type: ChunkType.TEXT_DELTA, text: 'done' },
      { type: ChunkType.STEP_FINISH, finishReason: 'stop', usage: { inputTokens: 12, outputTokens: 8 } }
    ]

    const events = chunks.flatMap((chunk) => bridgeStreamChunkToRuntimeEvents(sessionId, chunk, state))
    const types = events.map((event) => event.type)

    expect(types).toEqual([
      'session.step_started',
      'session.tool_started',
      'session.tool_completed',
      'session.step_ended',
      'session.step_started',
      'session.step_ended'
    ])
    expect(state.stepIndex).toBe(2)
  })

  it('emits tool_failed when tool output carries error', () => {
    const state = createSessionRuntimeBridgeState()
    const events = bridgeStreamChunkToRuntimeEvents(
      'sess-1',
      {
        type: ChunkType.TOOL_RESULT,
        toolCallId: 'tc1',
        toolName: 'write_file',
        output: { isError: true, error: 'permission denied' }
      },
      state
    )

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: 'session.tool_failed',
      error: 'permission denied'
    })
  })

  it('records events and notifies global listeners', () => {
    const recorder = new AgentSessionRuntimeRecorder()
    const seen: string[] = []
    onAgentSessionRuntime((event) => seen.push(event.type))

    recorder.record({
      type: 'session.prompt_admitted',
      sessionId: 'sess-1',
      timestamp: Date.now()
    })

    expect(recorder.getEvents()).toHaveLength(1)
    expect(seen).toEqual(['session.prompt_admitted'])
  })

  it('preserves emission order through StreamChunkAdapter', async () => {
    const chunks = [
      { type: 'tool-call', toolCallId: 'tc1', toolName: 'grep', input: { q: 'foo' } },
      { type: 'tool-result', toolCallId: 'tc1', toolName: 'grep', output: ['a.ts:1:foo'] },
      {
        type: 'finish-step',
        finishReason: 'tool-calls',
        usage: { inputTokens: 20, outputTokens: 4 }
      },
      { type: 'text-delta', textDelta: 'answer' },
      {
        type: 'finish-step',
        finishReason: 'stop',
        usage: { inputTokens: 30, outputTokens: 10 }
      }
    ]
    let index = 0
    const fullStream = {
      getReader: () => ({
        read: async () => {
          if (index >= chunks.length) return { done: true, value: undefined }
          const value = chunks[index++]
          return { done: false, value }
        },
        releaseLock: () => {}
      })
    }

    const recorder = new AgentSessionRuntimeRecorder()
    const bridgeState = createSessionRuntimeBridgeState()
    const adapter = new StreamChunkAdapter(new StreamAccumulator(), {
      onChunk: (chunk) => {
        for (const event of bridgeStreamChunkToRuntimeEvents('sess-adapter', chunk, bridgeState)) {
          recorder.record(event)
        }
      }
    })

    await adapter.consumeStream({ fullStream } as never)

    expect(recorder.getEvents().map((event) => event.type)).toEqual([
      'session.step_started',
      'session.tool_started',
      'session.tool_completed',
      'session.step_ended',
      'session.step_started',
      'session.step_ended'
    ])
  })
})
