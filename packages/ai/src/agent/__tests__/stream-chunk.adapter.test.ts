import { describe, expect, it } from 'vitest'
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
})
