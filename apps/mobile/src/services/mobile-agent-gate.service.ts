import type { AgentGateLifecycleEvent } from '@baishou/ai'
import { onAgentGateLifecycle } from '@baishou/ai'

export type MobileAgentGateListener = (event: AgentGateLifecycleEvent) => void

const listeners = new Set<MobileAgentGateListener>()
let unsubscribeCore: (() => void) | null = null

/** 对齐 mobile-compression-event.service：桥接 @baishou/ai 门控生命周期到 RN 订阅方 */
export function ensureMobileAgentGateBridge(): void {
  if (unsubscribeCore) return
  unsubscribeCore = onAgentGateLifecycle((event) => {
    for (const listener of listeners) {
      try {
        listener(event)
      } catch {
        /* ignore */
      }
    }
  })
}

export function subscribeMobileAgentGateEvents(listener: MobileAgentGateListener): () => void {
  ensureMobileAgentGateBridge()
  listeners.add(listener)
  return () => listeners.delete(listener)
}
