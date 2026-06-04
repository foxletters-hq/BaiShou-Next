export type CompressionLifecyclePhase = 'auto' | 'manual'

export type CompressionLifecycleEvent =
  | {
      type: 'start'
      sessionId: string
      phase: CompressionLifecyclePhase
      /** 方案 A：刚发送并触发发送前压缩的用户消息 ID */
      triggerUserMessageId?: string
    }
  | { type: 'delta'; sessionId: string; chunk: string }
  | { type: 'reasoning-delta'; sessionId: string; chunk: string }
  | {
      type: 'finish'
      sessionId: string
      phase: CompressionLifecyclePhase
      ok: boolean
      triggerUserMessageId?: string
      coveredUpToMessageId?: string
      snapshotId?: number
    }

export type CompressionLifecycleListener = (event: CompressionLifecycleEvent) => void

const listeners = new Set<CompressionLifecycleListener>()

export function onCompressionLifecycle(listener: CompressionLifecycleListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function emitCompressionLifecycle(event: CompressionLifecycleEvent): void {
  for (const listener of listeners) {
    try {
      listener(event)
    } catch {
      /* ignore listener errors */
    }
  }
}
