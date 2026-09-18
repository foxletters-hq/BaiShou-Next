import { ChunkType } from './stream-chunk.types'
import type { StreamChunk } from './stream-chunk.types'
import type { StreamChatCallbacks } from './agent-session.types'

export function dispatchChunkToCallbacks(
  chunk: StreamChunk,
  callbacks?: StreamChatCallbacks
): void {
  if (!callbacks) return

  switch (chunk.type) {
    case ChunkType.TEXT_DELTA:
      callbacks.onTextDelta?.(chunk.text)
      break
    case ChunkType.REASONING_DELTA:
      callbacks.onReasoningDelta?.(chunk.text)
      break
    case ChunkType.TOOL_CALL:
      callbacks.onToolCallStart?.(chunk.toolName, chunk.input, chunk.toolCallId)
      break
    case ChunkType.TOOL_RESULT:
      callbacks.onToolCallResult?.(chunk.toolName, chunk.output, chunk.toolCallId)
      break
    case ChunkType.ERROR:
      break
  }
}
