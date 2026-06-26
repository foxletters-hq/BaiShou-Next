import { AgentGateEffect } from './agent-gate.enums'
import type {
  AgentGatePermissionRule,
  AgentGateResourceRef,
  BaishouAgentGateConfig
} from './agent-gate.types'

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
  return resources.some((resource) => agentGateGlobMatch(pattern, resource.value))
}

export function agentGatePermissionRuleMatches(
  rule: AgentGatePermissionRule,
  action: string,
  resources: readonly AgentGateResourceRef[]
): boolean {
  if (!agentGateActionPatternMatch(rule.action, action)) return false
  if (!rule.pattern) return true
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
