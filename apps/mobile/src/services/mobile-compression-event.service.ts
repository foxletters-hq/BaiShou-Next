import type { CompressionLifecycleEvent } from '@baishou/ai'
import { onCompressionLifecycle } from '@baishou/ai'
import { agentDbRuntimeRef } from './mobile-agent-db-runtime-ref'

export type MobileCompressionListener = (event: CompressionLifecycleEvent) => void

const listeners = new Set<MobileCompressionListener>()
let unsubscribeCore: (() => void) | null = null

/** 对齐 desktop compression-event.service：桥接 @baishou/ai 生命周期到 RN 订阅方 */
export function ensureMobileCompressionBridge(): void {
  if (unsubscribeCore) return
  unsubscribeCore = onCompressionLifecycle((event) => {
    for (const listener of listeners) {
      try {
        listener(event)
      } catch {
        /* ignore */
      }
    }
    if (event.type === 'finish' && event.ok) {
      const sessionManager = agentDbRuntimeRef.current?.sessionManager
      if (sessionManager) {
        void sessionManager.flushSessionToDisk(event.sessionId).catch(() => undefined)
      }
    }
  })
}

export function subscribeMobileCompressionEvents(listener: MobileCompressionListener): () => void {
  ensureMobileCompressionBridge()
  listeners.add(listener)
  return () => listeners.delete(listener)
}
