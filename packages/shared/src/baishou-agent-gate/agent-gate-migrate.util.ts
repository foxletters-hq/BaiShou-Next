import { AgentGateEffect } from './agent-gate.enums'
import type { AgentGatePermissionRule, BaishouAgentGateConfig } from './agent-gate.types'

export const EXTERNAL_DIRECTORY_ACTION = 'external_directory'

/** 旧 FullTrust 迁移后的垫底规则 */
export const CATCH_ALL_ALLOW_RULE: AgentGatePermissionRule = {
  action: '*',
  effect: AgentGateEffect.Allow
}

function normalizeTrustedDir(dir: string): string | null {
  const trimmed = dir.trim().replace(/\\/g, '/')
  if (!trimmed) return null
  if (trimmed === '*' || trimmed === '**' || trimmed === '**/*') return null
  if (!trimmed.includes('*')) {
    return `${trimmed.replace(/\/+$/, '')}/**`
  }
  return trimmed
}

function buildExternalDirectoryRules(
  externalEffect: AgentGateEffect,
  trustedDirs: readonly string[]
): AgentGatePermissionRule[] {
  const normalizedDirs = trustedDirs
    .map(normalizeTrustedDir)
    .filter((item): item is string => !!item)

  if (externalEffect === AgentGateEffect.Deny) {
    return [{ action: EXTERNAL_DIRECTORY_ACTION, effect: AgentGateEffect.Deny }]
  }

  if (externalEffect === AgentGateEffect.Allow && normalizedDirs.length === 0) {
    return [{ action: EXTERNAL_DIRECTORY_ACTION, effect: AgentGateEffect.Allow }]
  }

  return normalizedDirs.map((pattern) => ({
    action: EXTERNAL_DIRECTORY_ACTION,
    pattern,
    effect: AgentGateEffect.Allow
  }))
}

function isCatchAllAllowRule(rule: AgentGatePermissionRule): boolean {
  return rule.action === '*' && !rule.pattern && rule.effect === AgentGateEffect.Allow
}

/** 是否含有旧 FullTrust 等价的 `*: allow` 垫底规则 */
export function hasCatchAllAllowRule(config: BaishouAgentGateConfig): boolean {
  return (config.permissionRules ?? []).some(isCatchAllAllowRule)
}

/** 伙伴「完全信任」开关：写入/移除 `*: allow`（红线仍由钳制层兜底） */
export function setCatchAllAllowRule(
  config: BaishouAgentGateConfig,
  enabled: boolean
): BaishouAgentGateConfig {
  const without = (config.permissionRules ?? []).filter((rule) => !isCatchAllAllowRule(rule))
  return {
    ...config,
    permissionRules: enabled ? [...without, CATCH_ALL_ALLOW_RULE] : without
  }
}

/**
 * 将旧版 forceAskExternalPath / externalPathEffect / trustedExternalDirs
 * 迁移为 external_directory 规则（读盘兼容）。
 */
export function migrateLegacyExternalPathFields(
  config: BaishouAgentGateConfig & {
    forceAskExternalPath?: boolean
    externalPathEffect?: 'ask' | 'allow' | 'deny'
    trustedExternalDirs?: string[]
  }
): BaishouAgentGateConfig {
  const legacyDirs = Array.isArray(config.trustedExternalDirs)
    ? config.trustedExternalDirs
    : undefined
  const legacyEffect = config.externalPathEffect
  const hasLegacy =
    legacyDirs != null ||
    legacyEffect != null ||
    typeof config.forceAskExternalPath === 'boolean'

  const {
    forceAskExternalPath: _f,
    externalPathEffect: _e,
    trustedExternalDirs: _t,
    ...rest
  } = config as BaishouAgentGateConfig & {
    forceAskExternalPath?: boolean
    externalPathEffect?: 'ask' | 'allow' | 'deny'
    trustedExternalDirs?: string[]
  }

  if (!hasLegacy) return rest

  const existing = rest.permissionRules ?? []
  const alreadyHasExternal = existing.some((rule) => rule.action === EXTERNAL_DIRECTORY_ACTION)
  if (alreadyHasExternal) {
    return { ...rest, permissionRules: existing }
  }

  let externalEffect: AgentGateEffect = AgentGateEffect.Ask
  if (legacyEffect === 'deny') externalEffect = AgentGateEffect.Deny
  else if (legacyEffect === 'allow') externalEffect = AgentGateEffect.Allow
  else if (config.forceAskExternalPath === false) externalEffect = AgentGateEffect.Allow

  const dirs = (legacyDirs ?? []).map(normalizeTrustedDir).filter((item): item is string => !!item)
  const migrated = buildExternalDirectoryRules(externalEffect, dirs)

  return {
    ...rest,
    permissionRules: [...existing, ...migrated]
  }
}

/**
 * 将旧 trustMode=full_trust 迁移为 `*: allow` 规则后剥离该字段。
 */
export function migrateLegacyTrustMode(
  config: BaishouAgentGateConfig & { trustMode?: string }
): BaishouAgentGateConfig {
  const { trustMode, ...rest } = config
  if (trustMode !== 'full_trust') {
    return rest
  }
  if (hasCatchAllAllowRule(rest)) {
    return rest
  }
  return setCatchAllAllowRule(rest, true)
}
