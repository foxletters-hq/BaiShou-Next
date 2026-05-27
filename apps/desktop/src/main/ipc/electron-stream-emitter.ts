import type { IStreamEmitter } from '@baishou/ai'

export class ElectronStreamEmitter implements IStreamEmitter {
  constructor(private readonly event: Electron.IpcMainInvokeEvent) {}

  sendChunk(sessionId: string, chunk: string) {
    this.event.sender.send('agent:stream-chunk', { sessionId, chunk })
  }

  sendReasoningChunk(sessionId: string, chunk: string) {
    this.event.sender.send('agent:reasoning-chunk', { sessionId, chunk })
  }

  sendToolStart(sessionId: string, name: string, args: unknown) {
    this.event.sender.send('agent:tool-start', { sessionId, name, args })
  }

  sendToolResult(sessionId: string, name: string, result: unknown) {
    this.event.sender.send('agent:tool-result', { sessionId, name, result })
  }

  sendFinish(sessionId: string, payload: { success?: boolean; error?: string }) {
    this.event.sender.send('agent:stream-finish', { sessionId, ...payload })
  }
}
