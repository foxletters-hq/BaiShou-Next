import type {
  AgentGateAllowlistEntry,
  BaishouAgentGateConfig
} from '@baishou/shared'
import { createAgentGateAllowlistEntryId } from '@baishou/shared'

export interface IAgentGateAllowlistStore {
  list(): AgentGateAllowlistEntry[]
  has(action: string): boolean
  add(
    entry: Omit<AgentGateAllowlistEntry, 'id' | 'createdAt'>
  ): AgentGateAllowlistEntry
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

  has(action: string): boolean {
    return this.getConfig().allowlist.some((entry) => entry.action === action)
  }

  add(entry: Omit<AgentGateAllowlistEntry, 'id' | 'createdAt'>): AgentGateAllowlistEntry {
    const existing = this.getConfig().allowlist.find((item) => item.action === entry.action)
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
