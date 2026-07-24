import {
  AgentGateEffect,
  AgentGateProfileId,
  AgentGateTrustMode,
  evaluateAgentGatePermissionRules,
  extractAgentGateResourcesFromMetadata,
  getAgentGateProfileRules,
  isAgentGateActionForceExcluded,
  matchesTrustedExternalDirs,
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

function shouldForceAskExternal(
  config: BaishouAgentGateConfig,
  resources: readonly AgentGateResourceRef[]
): boolean {
  if (config.externalPathEffect === 'deny') return false
  const forceAskExternal =
    config.externalPathEffect === 'allow'
      ? config.forceAskExternalPath === true
      : config.forceAskExternalPath !== false
  if (!forceAskExternal) return false
  // 可信区外目录：仅通过区外门，后续仍走能力矩阵
  return !matchesTrustedExternalDirs(config, resources)
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
    return config.exclusionList.includes(action) || isAgentGateActionForceExcluded(action)
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

    // 区外路径：先过区外门（拒绝 / 可信目录放行 / 询问），再走能力矩阵
    if (hasExternalPath(resources)) {
      if (config.externalPathEffect === 'deny') {
        return AgentGateEffect.Deny
      }
      if (shouldForceAskExternal(config, resources)) {
        // 高级：带 pattern 的显式 Allow 仍可在询问门之前放行
        const permissionRulesEarly =
          input.profileId != null
            ? mergeProfileAndUserRules(
                resolveAgentGateProfileId(input.profileId, AgentGateProfileId.Companion),
                config
              )
            : resolveAgentGatePermissionRules(config)
        const patternedAllow = evaluateAgentGatePermissionRules({
          action: input.action,
          resources,
          rules: permissionRulesEarly.filter((rule) => !!rule.pattern),
          forceExcluded
        })
        if (patternedAllow === AgentGateEffect.Allow) {
          return AgentGateEffect.Allow
        }
        if (patternedAllow === AgentGateEffect.Deny) {
          return AgentGateEffect.Deny
        }
        return AgentGateEffect.Ask
      }
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

    // Host command execution never rides FullTrust; needs allowlist pattern or Ask.
    if (config.trustMode === AgentGateTrustMode.FullTrust && input.action !== 'workspace_run') {
      return AgentGateEffect.Allow
    }

    if (this.allowlistStore.has(input.action, resources)) {
      return AgentGateEffect.Allow
    }

    return AgentGateEffect.Ask
  }
}
