import { describe, expect, it, vi } from 'vitest'
import { StreamAccumulator } from '../stream-accumulator'
import { StreamChunkAdapter } from '../stream-chunk.adapter'
import { ChunkType } from '../stream-chunk.types'

function noOutputError(): Error {
  return Object.assign(new Error('No output generated.'), {
    name: 'AI_NoOutputGeneratedError',
    [Symbol.for('vercel.ai.error.AI_NoOutputGeneratedError')]: true
  })
}

describe('StreamChunkAdapter', () => {
  it('should treat a no-output error chunk as non-fatal after tool calls', async () => {
    const chunks = [
      { type: 'tool-call', toolCallId: 'c1', toolName: 'workspace_run', input: { command: 'ls' } },
      { type: 'tool-result', toolCallId: 'c1', toolName: 'workspace_run', output: 'ok' },
      { type: 'error', error: noOutputError() },
      { type: 'finish-step', finishReason: 'stop' }
    ]
    let index = 0
    const fullStream = {
      getReader: () => ({
        read: async () => {
          if (index >= chunks.length) return { done: true, value: undefined }
          return { done: false, value: chunks[index++] }
        },
        releaseLock: () => {}
      })
    }
    const seen: string[] = []
    const adapter = new StreamChunkAdapter(new StreamAccumulator(), {
      onChunk: (chunk) => {
        seen.push(chunk.type)
      }
    })

    const result = await adapter.consumeStream({ fullStream } as never)
    expect(result.error).toBeNull()
    expect(seen).toEqual([ChunkType.TOOL_CALL, ChunkType.TOOL_RESULT, ChunkType.STEP_FINISH])
  })

  it('should treat tool-input-start as the call so later results keep call order', async () => {
    const chunks = [
      { type: 'tool-input-start', id: 't1', toolName: 'current_time' },
      { type: 'tool-input-start', id: 't2', toolName: 'knowledge_search' },
      {
        type: 'tool-result',
        toolCallId: 't2',
        toolName: 'knowledge_search',
        output: '晴'
      }
    ]
    let index = 0
    const fullStream = {
      getReader: () => ({
        read: async () => {
          if (index >= chunks.length) return { done: true, value: undefined }
          return { done: false, value: chunks[index++] }
        },
        releaseLock: () => {}
      })
    }
    const seen: string[] = []
    const accumulator = new StreamAccumulator()
    const adapter = new StreamChunkAdapter(accumulator, {
      onChunk: (chunk) => {
        seen.push(chunk.type)
      }
    })

    await adapter.consumeStream({ fullStream } as never)
    expect(seen).toEqual([ChunkType.TOOL_CALL, ChunkType.TOOL_CALL, ChunkType.TOOL_RESULT])
    expect(
      accumulator.timeline.filter((item) => item.kind === 'tool').map((item) => item.callId)
    ).toEqual(['t1', 't2'])
  })

  it('should mark tool-input-start as partial and leave a finished tool-call complete', async () => {
    const chunks = [
      { type: 'tool-input-start', id: 't1', toolName: 'url_read' },
      {
        type: 'tool-call',
        toolCallId: 't1',
        toolName: 'url_read',
        input: { url: 'https://example.com' }
      }
    ]
    let index = 0
    const fullStream = {
      getReader: () => ({
        read: async () => {
          if (index >= chunks.length) return { done: true, value: undefined }
          return { done: false, value: chunks[index++] }
        },
        releaseLock: () => {}
      })
    }
    const seen: Array<{ partial?: boolean; input: unknown }> = []
    const adapter = new StreamChunkAdapter(new StreamAccumulator(), {
      onChunk: (chunk) => {
        if (chunk.type === ChunkType.TOOL_CALL) {
          seen.push({ partial: chunk.partial, input: chunk.input })
        }
      }
    })

    await adapter.consumeStream({ fullStream } as never)
    expect(seen).toEqual([
      { partial: true, input: {} },
      { partial: undefined, input: { url: 'https://example.com' } }
    ])
  })

  it('should mark first output when a tool call arrives', async () => {
    const chunks = [
      { type: 'tool-call', toolCallId: 'c1', toolName: 'web_search', input: { query: 'q' } },
      { type: 'finish-step', finishReason: 'stop' }
    ]
    let index = 0
    const fullStream = {
      getReader: () => ({
        read: async () => {
          if (index >= chunks.length) return { done: true, value: undefined }
          return { done: false, value: chunks[index++] }
        },
        releaseLock: () => {}
      })
    }
    const onFirstOutput = vi.fn()
    const adapter = new StreamChunkAdapter(new StreamAccumulator())
    await adapter.consumeStream({ fullStream } as never, { onFirstOutput })
    expect(onFirstOutput).toHaveBeenCalled()
  })

  it('should forward a companion_ask question as soon as the argument JSON closes', async () => {
    const chunks = [
      { type: 'tool-input-start', id: 'c1', toolName: 'companion_ask' },
      { type: 'tool-input-delta', id: 'c1', delta: '{"question":"你在哪座城市？"' },
      {
        type: 'tool-input-delta',
        id: 'c1',
        delta: ',"options":["北京","上海"],"allow_custom_input":true}'
      }
    ]
    let index = 0
    const fullStream = {
      getReader: () => ({
        read: async () => {
          if (index >= chunks.length) return { done: true, value: undefined }
          return { done: false, value: chunks[index++] }
        },
        releaseLock: () => {}
      })
    }
    const inputs: unknown[] = []
    const adapter = new StreamChunkAdapter(new StreamAccumulator(), {
      onChunk: (chunk) => {
        if (chunk.type === ChunkType.TOOL_CALL) inputs.push(chunk.input)
      }
    })

    await adapter.consumeStream({ fullStream } as never)
    expect(inputs).toEqual([
      {},
      {
        question: '你在哪座城市？',
        options: ['北京', '上海'],
        allow_custom_input: true
      }
    ])
  })

  it('should forward a companion_ask question from UI-stream delta fields', async () => {
    const chunks = [
      { type: 'tool-input-start', toolCallId: 'c1', toolName: 'companion_ask' },
      {
        type: 'tool-input-delta',
        toolCallId: 'c1',
        inputTextDelta: '{"question":"你在哪座城市？","options":["北京","上海"]}'
      }
    ]
    let index = 0
    const fullStream = {
      getReader: () => ({
        read: async () => {
          if (index >= chunks.length) return { done: true, value: undefined }
          return { done: false, value: chunks[index++] }
        },
        releaseLock: () => {}
      })
    }
    const inputs: unknown[] = []
    const adapter = new StreamChunkAdapter(new StreamAccumulator(), {
      onChunk: (chunk) => {
        if (chunk.type === ChunkType.TOOL_CALL) inputs.push(chunk.input)
      }
    })

    await adapter.consumeStream({ fullStream } as never)
    expect(inputs).toEqual([
      {},
      {
        question: '你在哪座城市？',
        options: ['北京', '上海']
      }
    ])
  })

  it('should keep the start callId when a later delta uses the other id field', async () => {
    const chunks = [
      { type: 'tool-input-start', id: 'alias', toolCallId: 'c1', toolName: 'companion_ask' },
      {
        type: 'tool-input-delta',
        id: 'alias',
        delta: '{"question":"继续吗？"}'
      }
    ]
    let index = 0
    const fullStream = {
      getReader: () => ({
        read: async () => {
          if (index >= chunks.length) return { done: true, value: undefined }
          return { done: false, value: chunks[index++] }
        },
        releaseLock: () => {}
      })
    }
    const callIds: string[] = []
    const adapter = new StreamChunkAdapter(new StreamAccumulator(), {
      onChunk: (chunk) => {
        if (chunk.type === ChunkType.TOOL_CALL) callIds.push(chunk.toolCallId)
      }
    })

    await adapter.consumeStream({ fullStream } as never)
    expect(callIds).toEqual(['c1', 'c1'])
  })
})
