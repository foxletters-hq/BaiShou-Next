import { AgentGateEffect, AgentGateTrustMode } from './agent-gate.enums'
import type {
  AgentGateAllowlistEntry,
  AgentGatePermissionRule,
  BaishouAgentGateConfig
} from './agent-gate.types'

const ALLOWED_EFFECTS = new Set<string>([
  AgentGateEffect.Allow,
  AgentGateEffect.Ask,
  AgentGateEffect.Deny
])

function sanitizeAllowlist(raw: unknown): AgentGateAllowlistEntry[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (
        entry: unknown
      ): entry is {
        id: string
        action: string
        createdAt: number
        pattern?: string
        resourceKind?: string
        sourceSessionId?: string
        sourceRequestId?: string
      } =>
        !!entry &&
        typeof entry === 'object' &&
        typeof (entry as { id?: unknown }).id === 'string' &&
        typeof (entry as { action?: unknown }).action === 'string' &&
        typeof (entry as { createdAt?: unknown }).createdAt === 'number'
    )
    .map((entry) => {
      const action = entry.action.trim()
      const pattern =
        typeof entry.pattern === 'string' && entry.pattern.trim() ? entry.pattern.trim() : undefined
      if (action === 'workspace_run' && !pattern) return null
      if (pattern === '*' || pattern === '* *' || pattern === '**') return null
      return {
        id: entry.id,
        action,
        createdAt: entry.createdAt,
        ...(pattern
          ? {
              pattern,
              resourceKind:
                entry.resourceKind === 'shell_command' ||
                entry.resourceKind === 'workspace_path' ||
                entry.resourceKind === 'file_path' ||
                entry.resourceKind === 'external_path'
                  ? entry.resourceKind
                  : action === 'workspace_run'
                    ? ('shell_command' as const)
                    : undefined
            }
          : {}),
        ...(typeof entry.sourceSessionId === 'string'
          ? { sourceSessionId: entry.sourceSessionId }
          : {}),
        ...(typeof entry.sourceRequestId === 'string'
          ? { sourceRequestId: entry.sourceRequestId }
          : {})
      } satisfies AgentGateAllowlistEntry
    })
    .filter((entry): entry is AgentGateAllowlistEntry => !!entry)
}

function sanitizePermissionRules(raw: unknown): AgentGatePermissionRule[] | undefined {
  if (!Array.isArray(raw)) return undefined
  return raw
    .filter(
      (rule: unknown): rule is { action: string; effect: string; pattern?: string } =>
        !!rule &&
        typeof rule === 'object' &&
        typeof (rule as { action?: unknown }).action === 'string' &&
        typeof (rule as { effect?: unknown }).effect === 'string' &&
        ALLOWED_EFFECTS.has((rule as { effect: string }).effect)
    )
    .map((rule) => ({
      action: rule.action.trim(),
      effect: rule.effect as AgentGateEffect,
      ...(typeof rule.pattern === 'string' && rule.pattern.trim()
        ? { pattern: rule.pattern.trim() }
        : {})
    }))
    .filter((rule) => {
      if (!rule.action) return false
      if (
        rule.action === 'workspace_run' &&
        rule.effect === AgentGateEffect.Allow &&
        !rule.pattern
      ) {
        return false
      }
      if (rule.pattern === '*' || rule.pattern === '**' || rule.pattern === '**/*') {
        return false
      }
      return true
    })
}

/** 清洗设置页/IPC 写入的门控配置，拒绝危险的全量放行 */
export function sanitizeBaishouAgentGateConfigPatch(
  config: Partial<BaishouAgentGateConfig> | null | undefined
): Partial<BaishouAgentGateConfig> {
  if (!config || typeof config !== 'object') return {}

  const next: Partial<BaishouAgentGateConfig> = {}

  if (
    config.trustMode === AgentGateTrustMode.Manual ||
    config.trustMode === AgentGateTrustMode.FullTrust
  ) {
    next.trustMode = config.trustMode
  }

  if (Array.isArray(config.allowlist)) {
    next.allowlist = sanitizeAllowlist(config.allowlist)
  }

  if (Array.isArray(config.exclusionList)) {
    next.exclusionList = config.exclusionList
      .filter((item: unknown): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  if (config.permissionRules !== undefined) {
    next.permissionRules = sanitizePermissionRules(config.permissionRules) ?? []
  }

  if (typeof config.hideDeniedTools === 'boolean') {
    next.hideDeniedTools = config.hideDeniedTools
  }
  if (typeof config.forceAskExternalPath === 'boolean') {
    next.forceAskExternalPath = config.forceAskExternalPath
  }
  if (
    config.externalPathEffect === 'ask' ||
    config.externalPathEffect === 'allow' ||
    config.externalPathEffect === 'deny'
  ) {
    next.externalPathEffect = config.externalPathEffect
    if (config.externalPathEffect === 'allow') {
      next.forceAskExternalPath =
        Array.isArray(config.trustedExternalDirs) && config.trustedExternalDirs.length > 0
          ? true
          : false
    } else {
      next.forceAskExternalPath = true
    }
  }
  if (Array.isArray(config.trustedExternalDirs)) {
    next.trustedExternalDirs = config.trustedExternalDirs
      .filter((item: unknown): item is string => typeof item === 'string')
      .map((item) => item.trim().replace(/\\/g, '/'))
      .filter((item) => item && item !== '*' && item !== '**' && item !== '**/*')
  }
  if (
    typeof config.repeatAssertAskThreshold === 'number' &&
    Number.isFinite(config.repeatAssertAskThreshold) &&
    config.repeatAssertAskThreshold >= 0
  ) {
    next.repeatAssertAskThreshold = Math.floor(config.repeatAssertAskThreshold)
  }

  return next
}
