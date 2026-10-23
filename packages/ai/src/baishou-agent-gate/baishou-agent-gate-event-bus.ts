import type { AgentGateEvent } from '@baishou/shared'

export type AgentGateEventListener = (event: AgentGateEvent) => void

/** 进程内门控事件总线（桌面 Main / 移动 RN 共用实现） */
export class BaishouAgentGateEventBus {
  private readonly listeners = new Set<AgentGateEventListener>()

  publish(event: AgentGateEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch {
        /* 订阅方错误不影响门控主流程 */
      }
    }
  }

  subscribe(listener: AgentGateEventListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  clear(): void {
    this.listeners.clear()
  }
}
