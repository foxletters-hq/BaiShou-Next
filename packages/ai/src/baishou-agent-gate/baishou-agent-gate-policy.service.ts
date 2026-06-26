import {
  AgentGateEffect,
  AgentGateTrustMode,
  evaluateAgentGatePermissionRules,
  extractAgentGateResourcesFromMetadata,
  isAgentGateActionForceExcluded,
  mergeAgentGateResources,
  resolveAgentGatePermissionRules,
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
    const config = this.configProvider()
    return (
      config.exclusionList.includes(action) || isAgentGateActionForceExcluded(action)
    )
  }

  evaluate(input: AgentGateEvaluateInput): AgentGateEffect {
    if (input.toolDisabled) {
      return AgentGateEffect.Deny
    }

    const config = this.configProvider()
    const forceExcluded = isAgentGateActionForceExcluded(input.action, input.metadata)
    const resources = mergeAgentGateResources(
      input.resources,
      extractAgentGateResourcesFromMetadata(input.metadata)
    )

    if (config.exclusionList.includes(input.action) || forceExcluded) {
      return AgentGateEffect.Ask
    }

    const permissionRules = resolveAgentGatePermissionRules(config)
    const ruleEffect = evaluateAgentGatePermissionRules({
      action: input.action,
      resources,
      rules: permissionRules,
      forceExcluded
    })
    if (ruleEffect != null) {
      return ruleEffect
    }

    if (config.trustMode === AgentGateTrustMode.FullTrust) {
      return AgentGateEffect.Allow
    }

    if (this.allowlistStore.has(input.action)) {
      return AgentGateEffect.Allow
    }

    return AgentGateEffect.Ask
  }
}
