import type {
  AgentGateAllowlistEntry,
  AgentGateResourceRef,
  BaishouAgentGateConfig
} from '@baishou/shared'
import { allowlistEntryMatches, createAgentGateAllowlistEntryId } from '@baishou/shared'

export interface IAgentGateAllowlistStore {
  list(): AgentGateAllowlistEntry[]
  has(action: string, resources?: readonly AgentGateResourceRef[]): boolean
  add(entry: Omit<AgentGateAllowlistEntry, 'id' | 'createdAt'>): AgentGateAllowlistEntry
  remove(id: string): boolean
  persist(): Promise<void>
}

export class BaishouAgentGateAllowlistStore implements IAgentGateAllowlistStore {
  constructor(
    private readonly getConfig: () => BaishouAgentGateConfig,
    private readonly persistConfig?: () => Promise<void>
  ) {}

  list(): AgentGateAllowlistEntry[] {
    return [...this.getConfig().allowlist]
  }

  has(action: string, resources?: readonly AgentGateResourceRef[]): boolean {
    return this.getConfig().allowlist.some((entry) =>
      allowlistEntryMatches(entry, { action, resources })
    )
  }

  add(entry: Omit<AgentGateAllowlistEntry, 'id' | 'createdAt'>): AgentGateAllowlistEntry {
    const existing = this.getConfig().allowlist.find((item) => {
      if (item.action !== entry.action) return false
      if ((item.pattern ?? '') !== (entry.pattern ?? '')) return false
      if ((item.resourceKind ?? '') !== (entry.resourceKind ?? '')) return false
      return true
    })
    if (existing) return existing

    const created: AgentGateAllowlistEntry = {
      id: createAgentGateAllowlistEntryId(),
      createdAt: Date.now(),
      ...entry
    }
    this.getConfig().allowlist.push(created)
    return created
  }

  remove(id: string): boolean {
    const allowlist = this.getConfig().allowlist
    const index = allowlist.findIndex((entry) => entry.id === id)
    if (index < 0) return false
    allowlist.splice(index, 1)
    return true
  }

  async persist(): Promise<void> {
    await this.persistConfig?.()
  }
}
