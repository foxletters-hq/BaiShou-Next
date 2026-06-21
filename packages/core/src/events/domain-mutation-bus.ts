import type { DomainMutationEvent, DomainMutationListener } from '@baishou/shared/cache'

export type {
  DomainMutationEvent,
  DomainMutationListener,
  MutationDomain,
  MutationAction
} from '@baishou/shared/cache'

/**
 * 进程内领域变更总线。
 * Mobile 单进程直连；Desktop 主进程订阅后通过 IPC 转发至 Renderer。
 */
export class DomainMutationBus {
  private readonly listeners = new Set<DomainMutationListener>()

  subscribe(listener: DomainMutationListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  emit(event: Omit<DomainMutationEvent, 'timestamp'> & { timestamp?: number }): void {
    const full: DomainMutationEvent = {
      ...event,
      timestamp: event.timestamp ?? Date.now()
    }
    for (const listener of this.listeners) {
      try {
        listener(full)
      } catch (e) {
        console.warn('[DomainMutationBus] listener error:', e)
      }
    }
  }
}

/** 全局单例：Core 服务 emit，各端 Coordinator subscribe */
export const domainMutationBus = new DomainMutationBus()

export function emitDomainMutation(event: Omit<DomainMutationEvent, 'timestamp'>): void {
  domainMutationBus.emit(event)
}
