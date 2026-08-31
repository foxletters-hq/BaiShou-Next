import { AgentGateEffect } from './agent-gate.enums'
import type {
  AgentWorkspaceSecurityMode,
  BaishouAgentGateConfig
} from './agent-gate.types'
import { hasCatchAllAllowRule, setCatchAllAllowRule } from './agent-gate-migrate.util'
import { applyCapabilityStateToConfig } from './agent-gate-capability.util'
import {
  DEFAULT_WORKSPACE_COMMAND_BLACKLIST,
  isDangerousShellCommand
} from './agent-gate-shell-match.util'

export type { AgentWorkspaceSecurityMode }

/** @deprecated 保留导出供旧测试/兼容路径 */
export type { AgentGateScopePreset, AgentGateApprovalPreset } from './agent-gate.types'

/**
 * 将工作台安全模式展开为 permissionRules。
 * - full_access：`*: allow` 垫底（黑名单仍钳制）
 * - auto_review：常规编辑直接允许；命令在策略层按 Allow 初评后再经模型审核（sanitize 禁止裸 workspace_run Allow）
 * - allow_list：编辑/命令默认询问，仅 allowlist 放行
 */
export function applyWorkspaceSecurityModeToConfig(
  config: BaishouAgentGateConfig,
  mode: AgentWorkspaceSecurityMode
): BaishouAgentGateConfig {
  const allowList = mode === 'allow_list'
  const fullAccess = mode === 'full_access'

  const effects = {
    browse: AgentGateEffect.Allow,
    edit: allowList ? AgentGateEffect.Ask : AgentGateEffect.Allow,
    delete: AgentGateEffect.Ask,
    command: AgentGateEffect.Ask,
    external: AgentGateEffect.Ask
  }

  let next = applyCapabilityStateToConfig(config, 'workspace', {
    effects,
    trustedExternalDirs: []
  })

  next = setCatchAllAllowRule(next, fullAccess)

  const commandBlacklist =
    next.commandBlacklist && next.commandBlacklist.length > 0
      ? [...next.commandBlacklist]
      : [...DEFAULT_WORKSPACE_COMMAND_BLACKLIST]

  return {
    ...next,
    securityMode: mode,
    commandBlacklist,
    // 清理旧二维标签，避免 UI 误读
    scopePreset: undefined,
    approvalPreset: undefined
  }
}

/** 从配置读取安全模式；缺省 auto_review */
export function resolveWorkspaceSecurityMode(
  config: BaishouAgentGateConfig | null | undefined
): AgentWorkspaceSecurityMode {
  const mode = config?.securityMode
  if (mode === 'full_access' || mode === 'auto_review' || mode === 'allow_list') {
    return mode
  }
  // 兼容旧 approvalPreset（仅在 securityMode 缺失时）
  if (config?.approvalPreset === 'never_ask' || (config != null && hasCatchAllAllowRule(config))) {
    return 'full_access'
  }
  if (config?.approvalPreset === 'dangerous_only') {
    return 'auto_review'
  }
  if (config?.approvalPreset === 'always_ask') {
    return 'allow_list'
  }
  // 兼容：无 securityMode 时用编辑规则推断
  const rules = config?.permissionRules ?? []
  const editActions = ['workspace_write', 'workspace_patch', 'workspace_rename'] as const
  const editAllowed = editActions.every((action) =>
    rules.some(
      (rule) =>
        rule.action === action && !rule.pattern && rule.effect === AgentGateEffect.Allow
    )
  )
  if (editAllowed) return 'auto_review'
  return 'auto_review'
}

/**
 * 命令是否命中黑名单（用户配置模式 + 内置危险命令检测）。
 */
export function matchesCommandBlacklist(
  command: string,
  blacklist: readonly string[] | undefined
): boolean {
  const normalized = command.replace(/\s+/g, ' ').trim()
  if (!normalized) return false
  if (isDangerousShellCommand(normalized)) return true

  const patterns = blacklist?.length ? blacklist : DEFAULT_WORKSPACE_COMMAND_BLACKLIST
  const haystack = normalized.toLowerCase()
  return patterns.some((raw) => {
    const pattern = raw.trim().toLowerCase()
    if (!pattern) return false
    if (!pattern.includes('*')) {
      return haystack.includes(pattern)
    }
    // 简单 glob：`*` → .*
    const escaped = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
    try {
      return new RegExp(escaped, 'i').test(normalized)
    } catch {
      return haystack.includes(pattern.replace(/\*/g, ''))
    }
  })
}

/** @deprecated 使用 applyWorkspaceSecurityModeToConfig */
export function applyWorkspacePresetsToConfig(
  config: BaishouAgentGateConfig,
  presets: { scopePreset: string; approvalPreset: string },
  _trustedDirs: readonly string[] = []
): BaishouAgentGateConfig {
  const mode =
    presets.approvalPreset === 'never_ask'
      ? 'full_access'
      : presets.approvalPreset === 'always_ask'
        ? 'allow_list'
        : 'auto_review'
  return applyWorkspaceSecurityModeToConfig(config, mode)
}

/** @deprecated 使用 resolveWorkspaceSecurityMode */
export function inferWorkspacePresets(config: BaishouAgentGateConfig): {
  scopePreset: 'workspace_write' | 'custom'
  approvalPreset: 'always_ask' | 'dangerous_only' | 'never_ask' | 'custom'
  trustedExternalDirs: string[]
} {
  const mode = resolveWorkspaceSecurityMode(config)
  return {
    scopePreset: 'workspace_write',
    approvalPreset:
      mode === 'full_access'
        ? 'never_ask'
        : mode === 'allow_list'
          ? 'always_ask'
          : 'dangerous_only',
    trustedExternalDirs: []
  }
}

/** @deprecated */
export function markWorkspacePresetsCustom(config: BaishouAgentGateConfig): BaishouAgentGateConfig {
  return { ...config }
}

export { CATCH_ALL_ALLOW_RULE } from './agent-gate-migrate.util'

/** 稳定排序：无 pattern 在前、有 pattern 在后 */
export function sortPermissionRulesForLastMatch<T extends { pattern?: string }>(
  rules: readonly T[]
): T[] {
  return [...rules].sort((a, b) => {
    const ap = a.pattern ? 1 : 0
    const bp = b.pattern ? 1 : 0
    return ap - bp
  })
}
