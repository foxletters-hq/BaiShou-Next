import { AgentGateEffect, AgentGateProfileId } from './agent-gate.enums'
import type {
  AgentGatePermissionRule,
  BaishouAgentGateConfig,
  WorkspaceGatePolicyV2,
  WorkspaceToolManagementConfig
} from './agent-gate.types'
import { migrateLegacyExternalPathFields, migrateLegacyTrustMode } from './agent-gate-migrate.util'
import { DEFAULT_WORKSPACE_COMMAND_BLACKLIST } from './agent-gate-shell-match.util'

export const DEFAULT_AGENT_GATE_EXCLUSION_LIST = ['diary_delete', 'memory_delete'] as const

/** 工作区场景默认不可「始终允许」的操作（删除可始终允许，故默认为空） */
export const DEFAULT_WORKSPACE_AGENT_GATE_EXCLUSION_LIST = [] as const

export const AGENT_GATE_REQUEST_ID_PREFIX = 'bag_'
export const AGENT_GATE_ALLOWLIST_ENTRY_ID_PREFIX = 'bagal_'
export const BAISHOU_AGENT_GATE_CONFIG_KEY = 'baishou_agent_gate_config'
/** 工作台全局门控（不再按 workspaceId 拆分） */
export const BAISHOU_WORKSPACE_AGENT_GATE_CONFIG_KEY = 'baishou_workspace_agent_gate_config'

/** userData 下工作区策略文件名（非 Vault settings） */
export const AGENT_WORKSPACE_POLICY_STORE_FILE = 'agent-workspace-policy.json'

export const AGENT_GATE_LIFECYCLE_COMPRESSION_SAVE_DIARY = 'lifecycle_compression_save_diary'

/** Default consecutive same-fingerprint asserts before forcing Ask */
export const DEFAULT_AGENT_GATE_REPEAT_ASSERT_ASK_THRESHOLD = 3

/** Prefix for reject-with-feedback messages returned to the model */
export const AGENT_GATE_CORRECTED_FEEDBACK_PREFIX = '[用户纠正]'

/**
 * Scene default rules (stacked under user permissionRules).
 * Layered evaluation: later rules win (findLast).
 */
export const AGENT_GATE_PROFILE_DEFAULT_RULES: Record<
  AgentGateProfileId,
  readonly AgentGatePermissionRule[]
> = {
  [AgentGateProfileId.Companion]: [{ action: 'workspace_*', effect: AgentGateEffect.Deny }],
  [AgentGateProfileId.Workspace]: [
    { action: 'diary_*', effect: AgentGateEffect.Deny },
    { action: 'memory_*', effect: AgentGateEffect.Deny },
    { action: 'graph_upsert', effect: AgentGateEffect.Deny },
    // G3.2: in-workspace read-only tools default Allow (external_directory still Ask later)
    { action: 'workspace_list', effect: AgentGateEffect.Allow },
    { action: 'workspace_read', effect: AgentGateEffect.Allow }
  ]
}

/** 伙伴会话默认门控（Vault 级；旧配置迁移到此） */
export const DEFAULT_BAISHOU_AGENT_GATE_CONFIG: BaishouAgentGateConfig = {
  exclusionList: [...DEFAULT_AGENT_GATE_EXCLUSION_LIST],
  allowlist: [],
  repeatAssertAskThreshold: DEFAULT_AGENT_GATE_REPEAT_ASSERT_ASK_THRESHOLD,
  hideDeniedTools: true
}

/**
 * 工作区默认门控：auto_review + 默认命令黑名单。
 * 具体 permissionRules 由 applyWorkspaceSecurityModeToConfig 在写入时展开。
 */
export const DEFAULT_WORKSPACE_AGENT_GATE_CONFIG: BaishouAgentGateConfig = {
  exclusionList: [...DEFAULT_WORKSPACE_AGENT_GATE_EXCLUSION_LIST],
  allowlist: [],
  commandBlacklist: [...DEFAULT_WORKSPACE_COMMAND_BLACKLIST],
  repeatAssertAskThreshold: DEFAULT_AGENT_GATE_REPEAT_ASSERT_ASK_THRESHOLD,
  hideDeniedTools: true,
  securityMode: 'auto_review'
}

/** 工作区工具开关默认：全部开启（由运行时硬过滤决定可见工具集） */
export const DEFAULT_WORKSPACE_TOOL_MANAGEMENT_CONFIG: WorkspaceToolManagementConfig = {
  disabledToolIds: [],
  customConfigs: {}
}

export function cloneBaishouAgentGateConfig(
  source?: BaishouAgentGateConfig | null,
  defaults: BaishouAgentGateConfig = DEFAULT_BAISHOU_AGENT_GATE_CONFIG
): BaishouAgentGateConfig {
  const base: BaishouAgentGateConfig = {
    ...defaults,
    exclusionList: [...defaults.exclusionList],
    allowlist: [],
    permissionRules: defaults.permissionRules?.map((rule) => ({ ...rule }))
  }
  if (!source) return base

  const merged: BaishouAgentGateConfig = {
    exclusionList: [...(source.exclusionList ?? base.exclusionList)],
    allowlist: (source.allowlist ?? []).map((entry) => ({ ...entry })),
    actionRules: source.actionRules ? { ...source.actionRules } : undefined,
    permissionRules: source.permissionRules?.map((rule) => ({ ...rule })),
    repeatAssertAskThreshold: source.repeatAssertAskThreshold ?? base.repeatAssertAskThreshold,
    hideDeniedTools: source.hideDeniedTools ?? base.hideDeniedTools,
    scopePreset: source.scopePreset ?? base.scopePreset,
    approvalPreset: source.approvalPreset ?? base.approvalPreset,
    securityMode: source.securityMode ?? base.securityMode,
    commandBlacklist: [
      ...(source.commandBlacklist ?? base.commandBlacklist ?? DEFAULT_WORKSPACE_COMMAND_BLACKLIST)
    ]
  }

  // 兼容磁盘上仍带旧区外字段 / trustMode 的配置
  return migrateLegacyTrustMode(
    migrateLegacyExternalPathFields({
      ...merged,
      ...(source as BaishouAgentGateConfig & {
        trustMode?: string
        forceAskExternalPath?: boolean
        externalPathEffect?: 'ask' | 'allow' | 'deny'
        trustedExternalDirs?: string[]
      })
    })
  )
}

export function toWorkspaceGatePolicyV2(config: BaishouAgentGateConfig): WorkspaceGatePolicyV2 {
  return {
    version: 2,
    scopePreset: config.scopePreset ?? 'workspace_write',
    approvalPreset: config.approvalPreset ?? 'dangerous_only',
    securityMode: config.securityMode ?? 'auto_review',
    rules: (config.permissionRules ?? []).map((rule) => ({ ...rule })),
    remembered: (config.allowlist ?? []).map((entry) => ({ ...entry })),
    exclusionList: [...config.exclusionList],
    commandBlacklist: [...(config.commandBlacklist ?? DEFAULT_WORKSPACE_COMMAND_BLACKLIST)],
    hideDeniedTools: config.hideDeniedTools !== false,
    repeatAssertAskThreshold:
      config.repeatAssertAskThreshold ?? DEFAULT_AGENT_GATE_REPEAT_ASSERT_ASK_THRESHOLD
  }
}

export function fromWorkspaceGatePolicyV2(policy: WorkspaceGatePolicyV2): BaishouAgentGateConfig {
  return {
    exclusionList: [...policy.exclusionList],
    allowlist: policy.remembered.map((entry) => ({ ...entry })),
    permissionRules: policy.rules.map((rule) => ({ ...rule })),
    hideDeniedTools: policy.hideDeniedTools,
    repeatAssertAskThreshold: policy.repeatAssertAskThreshold,
    scopePreset: policy.scopePreset,
    approvalPreset: policy.approvalPreset,
    securityMode: policy.securityMode,
    commandBlacklist: [
      ...(policy.commandBlacklist ?? DEFAULT_WORKSPACE_COMMAND_BLACKLIST)
    ]
  }
}

export function cloneWorkspaceToolManagementConfig(
  source?: WorkspaceToolManagementConfig | null
): WorkspaceToolManagementConfig {
  return {
    disabledToolIds: [
      ...(source?.disabledToolIds ?? DEFAULT_WORKSPACE_TOOL_MANAGEMENT_CONFIG.disabledToolIds)
    ],
    customConfigs: Object.fromEntries(
      Object.entries(source?.customConfigs ?? {}).map(([toolId, params]) => [toolId, { ...params }])
    )
  }
}
