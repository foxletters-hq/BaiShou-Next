/** 领域数据变更域 — Core 写路径与同步/resync 边界统一 emit */
export type MutationDomain = 'diary' | 'summary' | 'settings' | 'vault' | 'sync'

export type MutationAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'save'
  | 'switch'
  | 'complete'
  | 'resync-complete'

/**
 * Core 层领域变更事件。
 * 各端 CacheCoordinator 订阅后按 invalidation-rules 失效对应 CacheKey。
 */
export interface DomainMutationEvent {
  domain: MutationDomain
  action: MutationAction
  vaultKey?: string
  entityId?: string | number
  reason?: string
  meta?: Record<string, unknown>
  timestamp: number
}

export type DomainMutationListener = (event: DomainMutationEvent) => void

export function mutationRuleKey(event: Pick<DomainMutationEvent, 'domain' | 'action'>): string {
  return `${event.domain}.${event.action}`
}
