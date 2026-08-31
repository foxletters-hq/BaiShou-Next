import {
  AgentGateEffect,
  AgentGateProfileId,
  AgentGateRiskLevel,
  CATCH_ALL_ALLOW_RULE,
  allowlistEntriesToPermissionRules,
  agentGatePermissionRuleMatches,
  clampAgentGateEffect,
  findLastMatchingLayeredRule,
  extractAgentGateResourcesFromMetadata,
  getAgentGateProfileRules,
  hasCatchAllAllowRule,
  isAgentGateActionForceExcluded,
  mergeAgentGateResources,
  resolveAgentGatePermissionRules,
  resolveAgentGateProfileId,
  type AgentGateDecisionSource,
  type AgentGateEvaluateInput,
  type AgentGatePermissionRule,
  type BaishouAgentGateConfig
} from '@baishou/shared'
import type { IAgentGateAllowlistStore } from './baishou-agent-gate-allowlist.store'

export interface AgentGateEvaluateResult {
  effect: AgentGateEffect
  decisionSource: AgentGateDecisionSource
}

export interface IAgentGatePolicy {
  evaluate(input: AgentGateEvaluateInput): AgentGateEffect
  evaluateDetailed(input: AgentGateEvaluateInput): AgentGateEvaluateResult
  getConfig(): Readonly<BaishouAgentGateConfig>
  isExcluded(action: string): boolean
}

function isCatchAllAllowRule(rule: AgentGatePermissionRule): boolean {
  return (
    rule.action === CATCH_ALL_ALLOW_RULE.action &&
    !rule.pattern &&
    rule.effect === CATCH_ALL_ALLOW_RULE.effect
  )
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
    return this.evaluateDetailed(input).effect
  }

  evaluateDetailed(input: AgentGateEvaluateInput): AgentGateEvaluateResult {
    if (input.toolDisabled) {
      return {
        effect: AgentGateEffect.Deny,
        decisionSource: {
          layer: 'default',
          action: input.action,
          effect: AgentGateEffect.Deny
        }
      }
    }

    const config = this.configProvider()
    const forceExcluded = isAgentGateActionForceExcluded(input.action, input.metadata)
    const resources = mergeAgentGateResources(
      input.resources,
      extractAgentGateResourcesFromMetadata(input.metadata)
    )

    const profileRules =
      input.profileId != null
        ? [
            ...getAgentGateProfileRules(
              resolveAgentGateProfileId(input.profileId, AgentGateProfileId.Companion)
            )
          ]
        : []
    const userRules = resolveAgentGatePermissionRules(config).filter(
      (rule) => !isCatchAllAllowRule(rule)
    )
    const rememberedRules = allowlistEntriesToPermissionRules(this.allowlistStore.list())
    const sessionRules = [
      ...(input.autoAccept ? [{ action: '*', effect: AgentGateEffect.Allow }] : []),
      ...(input.sessionRules ?? [])
    ]

    const matched = findLastMatchingLayeredRule({
      action: input.action,
      resources,
      layers: [
        { kind: 'profile', rules: profileRules },
        { kind: 'user', rules: userRules },
        { kind: 'remembered', rules: rememberedRules },
        { kind: 'session', rules: sessionRules }
      ]
    })

    const unmatchedDefault =
      input.metadata?.riskLevel === AgentGateRiskLevel.Safe
        ? AgentGateEffect.Allow
        : AgentGateEffect.Ask
    let rawEffect = matched?.rule.effect ?? unmatchedDefault
    let usedCatchAllFallback = false
    if (
      rawEffect === AgentGateEffect.Ask &&
      hasCatchAllAllowRule(config) &&
      agentGatePermissionRuleMatches(CATCH_ALL_ALLOW_RULE, input.action, resources)
    ) {
      rawEffect = AgentGateEffect.Allow
      usedCatchAllFallback = true
    }
    // auto_review：命令默认先按 Allow 初评（sanitize 禁止裸 workspace_run Allow），
    // 再交给黑名单钳制与模型二次审核；allow_list 保持默认 Ask。
    let usedAutoReviewCommandDefault = false
    if (
      config.securityMode === 'auto_review' &&
      input.action === 'workspace_run' &&
      rawEffect === AgentGateEffect.Ask &&
      !forceExcluded
    ) {
      rawEffect = AgentGateEffect.Allow
      usedAutoReviewCommandDefault = true
    }
    const riskLevelRaw = input.metadata?.riskLevel
    const riskLevel =
      riskLevelRaw === AgentGateRiskLevel.Safe ||
      riskLevelRaw === AgentGateRiskLevel.Mutating ||
      riskLevelRaw === AgentGateRiskLevel.Destructive
        ? riskLevelRaw
        : undefined
    const explicitAllow =
      matched != null &&
      (matched.layer === 'remembered' ||
        matched.layer === 'session' ||
        (matched.layer === 'user' && !isCatchAllAllowRule(matched.rule)))

    const effect = clampAgentGateEffect(rawEffect, {
      action: input.action,
      resources,
      exclusionList: config.exclusionList,
      commandBlacklist: config.commandBlacklist,
      forceExcluded,
      metadata: input.metadata,
      riskLevel,
      preview: input.preview,
      explicitAllow
    })

    const decisionSource: AgentGateDecisionSource = matched
      ? {
          layer: matched.layer,
          action: matched.rule.action,
          pattern: matched.rule.pattern,
          effect,
          ...(effect !== rawEffect ? { clampedFrom: rawEffect } : {})
        }
      : usedCatchAllFallback
        ? {
            layer: 'user',
            action: '*',
            effect,
            ...(effect !== rawEffect ? { clampedFrom: rawEffect } : {})
          }
        : usedAutoReviewCommandDefault
          ? {
              layer: 'user',
              action: 'workspace_run',
              effect,
              ...(effect !== rawEffect ? { clampedFrom: rawEffect } : {})
            }
          : {
              layer: 'default',
              action: input.action,
              effect,
              ...(effect !== rawEffect ? { clampedFrom: rawEffect } : {})
            }

    return { effect, decisionSource }
  }
}
