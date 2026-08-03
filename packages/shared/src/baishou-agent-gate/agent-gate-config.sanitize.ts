import { AgentGateEffect } from './agent-gate.enums'
import type {
  AgentGateAllowlistEntry,
  AgentGatePermissionRule,
  BaishouAgentGateConfig
} from './agent-gate.types'
import {
  migrateLegacyExternalPathFields,
  migrateLegacyTrustMode,
  setCatchAllAllowRule
} from './agent-gate-migrate.util'

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
                    : action === 'external_directory'
                      ? ('external_path' as const)
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
      // bare catch-alls only; path prefixes like D:/Notes/** are fine
      if (rule.pattern === '*' || rule.pattern === '**') {
        return false
      }
      if (rule.pattern === '**/*' && rule.action !== 'external_directory') {
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
  if (
    typeof config.repeatAssertAskThreshold === 'number' &&
    Number.isFinite(config.repeatAssertAskThreshold) &&
    config.repeatAssertAskThreshold >= 0
  ) {
    next.repeatAssertAskThreshold = Math.floor(config.repeatAssertAskThreshold)
  }

  if (config.scopePreset !== undefined) {
    const allowed = new Set(['readonly', 'workspace_write', 'with_trusted_dirs', 'custom'])
    if (typeof config.scopePreset === 'string' && allowed.has(config.scopePreset)) {
      next.scopePreset = config.scopePreset as BaishouAgentGateConfig['scopePreset']
    }
  }
  if (config.approvalPreset !== undefined) {
    const allowed = new Set(['always_ask', 'dangerous_only', 'never_ask', 'custom'])
    if (typeof config.approvalPreset === 'string' && allowed.has(config.approvalPreset)) {
      next.approvalPreset = config.approvalPreset as BaishouAgentGateConfig['approvalPreset']
    }
  }

  // 旧 trustMode → `*: allow`
  const legacyTrust = (config as { trustMode?: string }).trustMode
  if (legacyTrust === 'full_trust') {
    const base: BaishouAgentGateConfig = {
      exclusionList: next.exclusionList ?? [],
      allowlist: next.allowlist ?? [],
      permissionRules: next.permissionRules
    }
    next.permissionRules = setCatchAllAllowRule(base, true).permissionRules
  }

  // 旧字段 → external_directory 规则
  const legacy = config as Partial<BaishouAgentGateConfig> & {
    forceAskExternalPath?: boolean
    externalPathEffect?: 'ask' | 'allow' | 'deny'
    trustedExternalDirs?: string[]
  }
  if (
    legacy.trustedExternalDirs != null ||
    legacy.externalPathEffect != null ||
    typeof legacy.forceAskExternalPath === 'boolean'
  ) {
    const migrated = migrateLegacyTrustMode(
      migrateLegacyExternalPathFields({
        exclusionList: next.exclusionList ?? [],
        allowlist: next.allowlist ?? [],
        permissionRules: next.permissionRules,
        forceAskExternalPath: legacy.forceAskExternalPath,
        externalPathEffect: legacy.externalPathEffect,
        trustedExternalDirs: legacy.trustedExternalDirs
      })
    )
    next.permissionRules = migrated.permissionRules
  }

  return next
}
