import {
  AgentGateEffect,
  AgentGateProfileId,
  AgentGateTrustMode,
  evaluateAgentGatePermissionRules,
  extractAgentGateResourcesFromMetadata,
  getAgentGateProfileRules,
  isAgentGateActionForceExcluded,
  mergeAgentGateResources,
  resolveAgentGatePermissionRules,
  resolveAgentGateProfileId,
  type AgentGateEvaluateInput,
  type AgentGatePermissionRule,
  type AgentGateResourceRef,
  type BaishouAgentGateConfig
} from '@baishou/shared'
import type { IAgentGateAllowlistStore } from './baishou-agent-gate-allowlist.store'

export interface IAgentGatePolicy {
  evaluate(input: AgentGateEvaluateInput): AgentGateEffect
  getConfig(): Readonly<BaishouAgentGateConfig>
  isExcluded(action: string): boolean
}

function hasExternalPath(resources: readonly AgentGateResourceRef[]): boolean {
  return resources.some((resource) => resource.kind === 'external_path')
}

function mergeProfileAndUserRules(
  profileId: AgentGateProfileId,
  config: BaishouAgentGateConfig
): AgentGatePermissionRule[] {
  return [...getAgentGateProfileRules(profileId), ...resolveAgentGatePermissionRules(config)]
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

    // Profile rules only when callers bind a scene (interceptor / tool registry).
    const permissionRules =
      input.profileId != null
        ? mergeProfileAndUserRules(
            resolveAgentGateProfileId(input.profileId, AgentGateProfileId.Companion),
            config
          )
        : resolveAgentGatePermissionRules(config)
    const ruleEffect = evaluateAgentGatePermissionRules({
      action: input.action,
      resources,
      rules: permissionRules,
      forceExcluded
    })
    if (ruleEffect != null) {
      return ruleEffect
    }

    // After rules: external path forces Ask (overrides FullTrust / action allowlist).
    const forceAskExternal = config.forceAskExternalPath !== false
    if (forceAskExternal && hasExternalPath(resources)) {
      return AgentGateEffect.Ask
    }

    if (config.trustMode === AgentGateTrustMode.FullTrust) {
      return AgentGateEffect.Allow
    }

    if (this.allowlistStore.has(input.action, resources)) {
      return AgentGateEffect.Allow
    }

    return AgentGateEffect.Ask
  }
}
