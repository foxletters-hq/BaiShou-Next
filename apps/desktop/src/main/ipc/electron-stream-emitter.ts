import type { IStreamEmitter, StreamFinishPayload } from '@baishou/ai'
import { logger } from '@baishou/shared'

export class ElectronStreamEmitter implements IStreamEmitter {
  constructor(private readonly event: Electron.IpcMainInvokeEvent) {}

  sendChunk(sessionId: string, chunk: string) {
    logger.info(
      `[ElectronStreamEmitter] sendChunk - sessionId=${sessionId}, chunkLength=${chunk.length}`
    )
    this.event.sender.send('agent:stream-chunk', { sessionId, chunk })
  }

  sendReasoningChunk(sessionId: string, chunk: string) {
    logger.info(
      `[ElectronStreamEmitter] sendReasoningChunk - sessionId=${sessionId}, chunkLength=${chunk.length}`
    )
    this.event.sender.send('agent:reasoning-chunk', { sessionId, chunk })
  }

  sendToolStart(sessionId: string, name: string, args: unknown, toolCallId?: string) {
    logger.info(
      `[ElectronStreamEmitter] sendToolStart - sessionId=${sessionId}, name=${name}, callId=${toolCallId ?? ''}`
    )
    this.event.sender.send('agent:tool-start', { sessionId, name, args, toolCallId })
  }

  sendToolResult(sessionId: string, name: string, result: unknown, toolCallId?: string) {
    logger.info(
      `[ElectronStreamEmitter] sendToolResult - sessionId=${sessionId}, name=${name}, callId=${toolCallId ?? ''}`
    )
    this.event.sender.send('agent:tool-result', { sessionId, name, result, toolCallId })
  }

  sendFinish(sessionId: string, payload: StreamFinishPayload) {
    logger.info(
      `[ElectronStreamEmitter] sendFinish - sessionId=${sessionId}, payload=${JSON.stringify(payload)}`
    )
    this.event.sender.send('agent:stream-finish', { sessionId, ...payload })
  }
}
