import type { AgentGateEvent } from '@baishou/shared'

export type AgentGateLifecycleEvent = AgentGateEvent
export type AgentGateLifecycleListener = (event: AgentGateLifecycleEvent) => void

const listeners = new Set<AgentGateLifecycleListener>()

/** 订阅门控生命周期事件（桌面 IPC 桥接 / 移动 RN 订阅共用） */
export function onAgentGateLifecycle(listener: AgentGateLifecycleListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function emitAgentGateLifecycle(event: AgentGateLifecycleEvent): void {
  for (const listener of listeners) {
    try {
      listener(event)
    } catch {
      /* ignore listener errors */
    }
  }
}
