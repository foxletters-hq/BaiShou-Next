import type { AgentGateEvent, AgentGatePartData, AgentGateResolution } from '@baishou/shared'

type BufferedRecord = {
  request: AgentGatePartData['request']
  resolution?: AgentGateResolution
}

/** 单次 stream 内收集门控 asked/replied，供落盘写入 agent_gate parts */
export class BaishouAgentGateSessionBuffer {
  private readonly records = new Map<string, BufferedRecord>()

  handleEvent(event: AgentGateEvent): void {
    if (event.type === 'agent_gate.asked') {
      this.records.set(event.request.id, { request: event.request })
      return
    }

    if (event.type === 'agent_gate.replied') {
      const existing = this.records.get(event.requestId)
      if (!existing) return
      existing.resolution = {
        requestId: event.requestId,
        reply: event.reply,
        message: event.message,
        selectedOptionIds: event.selectedOptionIds,
        resolvedAt: Date.now()
      }
    }
  }

  buildPartDataList(): AgentGatePartData[] {
    return [...this.records.values()].map((record) => ({
      request: record.request,
      resolution: record.resolution
    }))
  }

  clear(): void {
    this.records.clear()
  }
}

export function subscribeAgentGateSessionBuffer(
  eventBus: { subscribe: (listener: (event: AgentGateEvent) => void) => () => void },
  buffer: BaishouAgentGateSessionBuffer
): () => void {
  return eventBus.subscribe((event) => buffer.handleEvent(event))
}
