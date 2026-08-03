import { AgentGateEffect } from './agent-gate.enums'
import type {
  AgentGatePermissionRule,
  AgentGateResourceRef,
  BaishouAgentGateConfig
} from './agent-gate.types'
import { matchShellCommandPattern } from './agent-gate-shell-match.util'

const EFFECT_PRECEDENCE: Record<AgentGateEffect, number> = {
  [AgentGateEffect.Deny]: 3,
  [AgentGateEffect.Ask]: 2,
  [AgentGateEffect.Allow]: 1
}

function escapeRegexChar(char: string): string {
  return char.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
}

/** Glob matcher: `*` (no slash), `**` (any), `?` (single non-slash char) */
export function agentGateGlobMatch(pattern: string, value: string): boolean {
  let regex = '^'
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i]
    if (char === '*') {
      if (pattern[i + 1] === '*') {
        if (pattern[i + 2] === '/') {
          regex += '(?:.*/)?'
          i += 2
        } else {
          regex += '.*'
          i += 1
        }
      } else {
        regex += '[^/]*'
      }
      continue
    }
    if (char === '?') {
      regex += '[^/]'
      continue
    }
    if (char != null) {
      regex += escapeRegexChar(char)
    }
  }
  regex += '$'
  return new RegExp(regex).test(value)
}

export function agentGateActionPatternMatch(pattern: string, action: string): boolean {
  return agentGateGlobMatch(pattern, action)
}

export function agentGateResourcePatternMatch(
  pattern: string,
  resources: readonly AgentGateResourceRef[]
): boolean {
  if (resources.length === 0) return false
  // Shell commands must use structured prefix match, never bare glob `*`.
  const shellResources = resources.filter((r) => r.kind === 'shell_command')
  if (shellResources.length > 0) {
    const trimmed = pattern.trim()
    if (trimmed === '*' || trimmed === '**' || trimmed === '**/*' || trimmed === '* *') {
      return false
    }
    return shellResources.some((resource) => matchShellCommandPattern(resource.value, pattern))
  }
  // Path resources: reject only bare catch-all stars (keep `**/*`, `src/**`, etc.)
  const trimmed = pattern.trim()
  if (trimmed === '*' || trimmed === '**') {
    return false
  }
  return resources.some((resource) => agentGateGlobMatch(pattern, resource.value))
}

export function agentGatePermissionRuleMatches(
  rule: AgentGatePermissionRule,
  action: string,
  resources: readonly AgentGateResourceRef[]
): boolean {
  if (!agentGateActionPatternMatch(rule.action, action)) return false
  if (!rule.pattern) {
    // Action-only Allow on workspace_run would silently allow every command.
    if (action === 'workspace_run' && rule.effect === AgentGateEffect.Allow) {
      return false
    }
    // Wildcard action-only Allow must not open the external_directory gate.
    if (
      action === 'external_directory' &&
      rule.effect === AgentGateEffect.Allow &&
      rule.action.includes('*')
    ) {
      return false
    }
    return true
  }
  return agentGateResourcePatternMatch(rule.pattern, resources)
}

export function combineAgentGateRuleEffects(
  effects: readonly AgentGateEffect[]
): AgentGateEffect | undefined {
  if (effects.length === 0) return undefined
  return effects.reduce((strongest, effect) =>
    EFFECT_PRECEDENCE[effect] > EFFECT_PRECEDENCE[strongest] ? effect : strongest
  )
}

export interface EvaluateAgentGatePermissionRulesInput {
  action: string
  resources?: readonly AgentGateResourceRef[]
  rules: readonly AgentGatePermissionRule[]
  /** When true, matching allow rules are clamped to ask */
  forceExcluded?: boolean
}

/**
 * Evaluate wildcard permission rules for an action (+ optional resources).
 * Returns undefined when no rule matches.
 */
export function evaluateAgentGatePermissionRules(
  input: EvaluateAgentGatePermissionRulesInput
): AgentGateEffect | undefined {
  const resources = input.resources ?? []
  const matchedEffects: AgentGateEffect[] = []

  for (const rule of input.rules) {
    if (!agentGatePermissionRuleMatches(rule, input.action, resources)) continue
    matchedEffects.push(rule.effect)
  }

  const combined = combineAgentGateRuleEffects(matchedEffects)
  if (combined == null) return undefined

  if (input.forceExcluded && combined === AgentGateEffect.Allow) {
    return AgentGateEffect.Ask
  }

  return combined
}

export interface EvaluateLayeredAgentGateRulesInput {
  action: string
  resources?: readonly AgentGateResourceRef[]
  /** 分层规则：后者覆盖前者；层内顺序即优先级（最后匹配赢） */
  layers: readonly (readonly AgentGatePermissionRule[])[]
}

export type AgentGateRuleLayerKind = 'profile' | 'user' | 'remembered' | 'session'

export interface FindLastMatchingLayeredRuleInput {
  action: string
  resources?: readonly AgentGateResourceRef[]
  layers: ReadonlyArray<{
    kind: AgentGateRuleLayerKind
    rules: readonly AgentGatePermissionRule[]
  }>
}

export interface FindLastMatchingLayeredRuleResult {
  rule: AgentGatePermissionRule
  layer: AgentGateRuleLayerKind
}

/**
 * G4：分层拼接后取最后一条命中规则（findLast）。
 * 未命中返回 undefined，由调用方默认 Ask。
 */
export function evaluateLayeredRules(
  input: EvaluateLayeredAgentGateRulesInput
): AgentGateEffect | undefined {
  const matched = findLastMatchingLayeredRule({
    action: input.action,
    resources: input.resources,
    layers: input.layers.map((rules) => ({ kind: 'user' as const, rules }))
  })
  return matched?.rule.effect
}

export function findLastMatchingLayeredRule(
  input: FindLastMatchingLayeredRuleInput
): FindLastMatchingLayeredRuleResult | undefined {
  const resources = input.resources ?? []
  for (let layerIndex = input.layers.length - 1; layerIndex >= 0; layerIndex--) {
    const layer = input.layers[layerIndex]
    if (!layer) continue
    for (let i = layer.rules.length - 1; i >= 0; i--) {
      const rule = layer.rules[i]
      if (!rule) continue
      if (!agentGatePermissionRuleMatches(rule, input.action, resources)) continue
      return { rule, layer: layer.kind }
    }
  }
  return undefined
}

/** 将始终允许名单转为规则层（全部为 Allow） */
export function allowlistEntriesToPermissionRules(
  entries: ReadonlyArray<{ action: string; pattern?: string }>
): AgentGatePermissionRule[] {
  return entries.map((entry) => ({
    action: entry.action,
    effect: AgentGateEffect.Allow,
    ...(entry.pattern ? { pattern: entry.pattern } : {})
  }))
}

/**
 * Merge explicit permissionRules with legacy actionRules (action-only, no pattern).
 * Explicit rules win for the same action when both are action-only.
 */
export function resolveAgentGatePermissionRules(
  config: Pick<BaishouAgentGateConfig, 'actionRules' | 'permissionRules'>
): AgentGatePermissionRule[] {
  const explicit = config.permissionRules ?? []
  const explicitActionOnly = new Set(
    explicit.filter((rule) => !rule.pattern).map((rule) => rule.action)
  )

  const derived: AgentGatePermissionRule[] = Object.entries(config.actionRules ?? {})
    .filter(([action, effect]) => !explicitActionOnly.has(action) && effect != null)
    .map(([action, effect]) => ({ action, effect: effect! }))

  return [...explicit, ...derived]
}
