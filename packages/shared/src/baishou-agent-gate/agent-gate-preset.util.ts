import { AgentGateEffect } from './agent-gate.enums'
import type {
  AgentGateApprovalPreset,
  AgentGatePermissionRule,
  AgentGateScopePreset,
  BaishouAgentGateConfig
} from './agent-gate.types'
import {
  CATCH_ALL_ALLOW_RULE,
  EXTERNAL_DIRECTORY_ACTION,
  hasCatchAllAllowRule,
  setCatchAllAllowRule
} from './agent-gate-migrate.util'
import {
  applyCapabilityStateToConfig,
  capabilityStateFromConfig
} from './agent-gate-capability.util'

export type { AgentGateScopePreset, AgentGateApprovalPreset }

export interface WorkspaceGatePresets {
  scopePreset: AgentGateScopePreset
  approvalPreset: AgentGateApprovalPreset
}

function normalizeTrustedDir(dir: string): string | null {
  const trimmed = dir.trim().replace(/\\/g, '/')
  if (!trimmed) return null
  if (trimmed === '*' || trimmed === '**' || trimmed === '**/*') return null
  if (!trimmed.includes('*')) return `${trimmed.replace(/\/+$/, '')}/**`
  return trimmed
}

/**
 * 将两维预设展开为能力矩阵状态，再交给 capability 编译器写回 permissionRules。
 * trustedDirs 仅在 scope=with_trusted_dirs 时使用。
 */
export function applyWorkspacePresetsToConfig(
  config: BaishouAgentGateConfig,
  presets: WorkspaceGatePresets,
  trustedDirs: readonly string[] = []
): BaishouAgentGateConfig {
  if (presets.scopePreset === 'custom' || presets.approvalPreset === 'custom') {
    return {
      ...config,
      scopePreset: presets.scopePreset,
      approvalPreset: presets.approvalPreset
    }
  }

  const dirs =
    presets.scopePreset === 'with_trusted_dirs'
      ? trustedDirs.map(normalizeTrustedDir).filter((item): item is string => !!item)
      : []

  const readonly = presets.scopePreset === 'readonly'
  const alwaysAsk = presets.approvalPreset === 'always_ask'
  const neverAsk = presets.approvalPreset === 'never_ask'
  // 含可信目录但尚未登记目录：区外保持默认 Ask，不要写裸 Allow（否则反推会漂成 custom）
  const externalEffect =
    presets.scopePreset === 'with_trusted_dirs'
      ? dirs.length > 0
        ? AgentGateEffect.Allow
        : AgentGateEffect.Ask
      : AgentGateEffect.Deny

  const effects = {
    browse: AgentGateEffect.Allow,
    edit: readonly ? AgentGateEffect.Deny : alwaysAsk ? AgentGateEffect.Ask : AgentGateEffect.Allow,
    delete: AgentGateEffect.Ask,
    command: readonly ? AgentGateEffect.Deny : AgentGateEffect.Ask,
    external: externalEffect,
    diary_write: AgentGateEffect.Ask,
    diary_delete: AgentGateEffect.Ask,
    memory_store: AgentGateEffect.Ask,
    memory_delete: AgentGateEffect.Ask
  }

  let next = applyCapabilityStateToConfig(config, 'workspace', {
    effects,
    trustedExternalDirs: dirs
  })

  // never_ask：追加 `*: allow` 垫底（红线仍由钳制层压回 Ask）
  next = setCatchAllAllowRule(next, neverAsk)

  return {
    ...next,
    scopePreset: presets.scopePreset,
    approvalPreset: presets.approvalPreset
  }
}

/** 从现有配置反推预设；无法精确匹配则 custom */
export function inferWorkspacePresets(
  config: BaishouAgentGateConfig
): WorkspaceGatePresets & { trustedExternalDirs: string[] } {
  const state = capabilityStateFromConfig(config, 'workspace')
  const storedScope =
    config.scopePreset && config.scopePreset !== 'custom' ? config.scopePreset : undefined
  const storedApproval =
    config.approvalPreset && config.approvalPreset !== 'custom' ? config.approvalPreset : undefined

  // 任一维仍有明确预设时优先信任落盘标签，避免规则反推把「含可信目录」漂成 custom
  if (storedScope && storedApproval) {
    return {
      scopePreset: storedScope,
      approvalPreset: storedApproval,
      trustedExternalDirs: state.trustedExternalDirs
    }
  }

  const hasTrusted = state.trustedExternalDirs.length > 0
  const externalDeny = state.effects.external === AgentGateEffect.Deny
  const externalAllow = state.effects.external === AgentGateEffect.Allow
  const editDeny = state.effects.edit === AgentGateEffect.Deny
  const editAllow = state.effects.edit === AgentGateEffect.Allow
  const commandDeny = state.effects.command === AgentGateEffect.Deny
  const catchAll = hasCatchAllAllowRule(config)

  let scopePreset: AgentGateScopePreset = storedScope ?? 'custom'
  if (!storedScope) {
    if (editDeny && commandDeny && externalDeny) {
      scopePreset = 'readonly'
    } else if (hasTrusted || (externalAllow && !externalDeny)) {
      // 有可信目录，或（兼容旧数据）裸 external Allow → 含可信目录
      scopePreset = 'with_trusted_dirs'
    } else if (externalDeny && !editDeny) {
      scopePreset = 'workspace_write'
    }
  }

  let approvalPreset: AgentGateApprovalPreset = storedApproval ?? 'custom'
  if (!storedApproval) {
    if (scopePreset === 'readonly') {
      approvalPreset = 'always_ask'
    } else if (catchAll || editAllow) {
      approvalPreset = catchAll ? 'never_ask' : 'dangerous_only'
    } else if (state.effects.edit === AgentGateEffect.Ask) {
      approvalPreset = 'always_ask'
    }
  }

  const managedActions = new Set([
    'workspace_list',
    'workspace_read',
    'workspace_write',
    'workspace_patch',
    'workspace_rename',
    'workspace_delete',
    'workspace_run',
    EXTERNAL_DIRECTORY_ACTION,
    CATCH_ALL_ALLOW_RULE.action
  ])
  const extra = (config.permissionRules ?? []).some((rule) => {
    if (rule.action === '*' && !rule.pattern) return false
    if (!managedActions.has(rule.action) && rule.action !== '*') return true
    if (rule.pattern && rule.action !== EXTERNAL_DIRECTORY_ACTION) return true
    return false
  })
  if (extra && !storedScope && !storedApproval) {
    return {
      scopePreset: 'custom',
      approvalPreset: 'custom',
      trustedExternalDirs: state.trustedExternalDirs
    }
  }

  return {
    scopePreset,
    approvalPreset,
    trustedExternalDirs: state.trustedExternalDirs
  }
}

/** 用户改了细项后把预设推到 custom */
export function markWorkspacePresetsCustom(config: BaishouAgentGateConfig): BaishouAgentGateConfig {
  return {
    ...config,
    scopePreset: 'custom',
    approvalPreset: 'custom'
  }
}

/** 稳定排序：无 pattern 在前、有 pattern 在后（迁移到最后匹配赢时保持等价） */
export function sortPermissionRulesForLastMatch(
  rules: readonly AgentGatePermissionRule[]
): AgentGatePermissionRule[] {
  return [...rules].sort((a, b) => {
    const ap = a.pattern ? 1 : 0
    const bp = b.pattern ? 1 : 0
    return ap - bp
  })
}
