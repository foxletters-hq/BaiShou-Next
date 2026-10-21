import type {
  AgentGateAllowlistEntry,
  AgentGateResourceRef,
  BaishouAgentGateConfig
} from '@baishou/shared'
import {
  allowlistEntryMatches,
  createAgentGateAllowlistEntryId,
  isDangerousShellCommand,
  splitShellChainCommands
} from '@baishou/shared'

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
    return [...(this.getConfig().allowlist ?? [])]
  }

  has(action: string, resources?: readonly AgentGateResourceRef[]): boolean {
    const entries = this.getConfig().allowlist
    if (entries.some((entry) => allowlistEntryMatches(entry, { action, resources }))) {
      return true
    }
    if (action === 'workspace_run' && resources && resources.length > 0) {
      const shellResources = resources.filter((r) => r.kind === 'shell_command')
      if (
        shellResources.length > 0 &&
        shellResources.every((r) => !isDangerousShellCommand(r.value))
      ) {
        const segments = shellResources.flatMap((r) => splitShellChainCommands(r.value))
        if (segments.length > 1) {
          const nonShell = resources.filter((r) => r.kind !== 'shell_command')
          return segments.every((seg) =>
            entries.some((entry) =>
              allowlistEntryMatches(entry, {
                action,
                resources: [...nonShell, { kind: 'shell_command', value: seg }]
              })
            )
          )
        }
      }
    }
    return false
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
