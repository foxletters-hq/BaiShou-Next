import {
  AgentGateEffect,
  AgentGateTrustMode,
  type AgentGateEvaluateInput,
  type BaishouAgentGateConfig
} from '@baishou/shared'
import type { IAgentGateAllowlistStore } from './baishou-agent-gate-allowlist.store'

export interface IAgentGatePolicy {
  evaluate(input: AgentGateEvaluateInput): AgentGateEffect
  getConfig(): Readonly<BaishouAgentGateConfig>
  isExcluded(action: string): boolean
}

export class BaishouAgentGatePolicyService implements IAgentGatePolicy {
  constructor(
    private readonly configProvider: () => BaishouAgentGateConfig,
    private readonly allowlistStore: IAgentGateAllowlistStore
  ) {}

  getConfig(): Readonly<BaishouAgentGateConfig> {
    return this.configProvider()
  }

  isExcluded(action: string): boolean {
    return this.configProvider().exclusionList.includes(action)
  }

  evaluate(input: AgentGateEvaluateInput): AgentGateEffect {
    if (input.toolDisabled) {
      return AgentGateEffect.Deny
    }

    const config = this.configProvider()

    if (config.exclusionList.includes(input.action)) {
      return AgentGateEffect.Ask
    }

    if (config.trustMode === AgentGateTrustMode.FullTrust) {
      return AgentGateEffect.Allow
    }

    if (this.allowlistStore.has(input.action)) {
      return AgentGateEffect.Allow
    }

    const rule = config.actionRules?.[input.action]
    if (rule) {
      return rule
    }

    return AgentGateEffect.Ask
  }
}
