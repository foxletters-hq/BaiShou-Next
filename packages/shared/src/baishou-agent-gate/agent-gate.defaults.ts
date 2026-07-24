import { AgentGateEffect, AgentGateProfileId, AgentGateTrustMode } from './agent-gate.enums'
import type {
  AgentGatePermissionRule,
  BaishouAgentGateConfig,
  WorkspaceToolManagementConfig
} from './agent-gate.types'

export const DEFAULT_AGENT_GATE_EXCLUSION_LIST = [
  'diary_delete',
  'memory_delete',
  'workspace_delete'
] as const

/** 工作区场景默认始终需确认的操作（不含日记/记忆删除） */
export const DEFAULT_WORKSPACE_AGENT_GATE_EXCLUSION_LIST = ['workspace_delete'] as const

export const AGENT_GATE_REQUEST_ID_PREFIX = 'bag_'
export const AGENT_GATE_ALLOWLIST_ENTRY_ID_PREFIX = 'bagal_'
export const BAISHOU_AGENT_GATE_CONFIG_KEY = 'baishou_agent_gate_config'

/** userData 下工作区策略文件名（非 Vault settings） */
export const AGENT_WORKSPACE_POLICY_STORE_FILE = 'agent-workspace-policy.json'

export const AGENT_GATE_LIFECYCLE_COMPRESSION_SAVE_DIARY = 'lifecycle_compression_save_diary'

/** Default consecutive same-fingerprint asserts before forcing Ask */
export const DEFAULT_AGENT_GATE_REPEAT_ASSERT_ASK_THRESHOLD = 3

/** Prefix for reject-with-feedback messages returned to the model */
export const AGENT_GATE_CORRECTED_FEEDBACK_PREFIX = '[用户纠正]'

/**
 * Scene default rules (stacked under user permissionRules).
 * Strongest matching effect wins (Deny > Ask > Allow).
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
    // G3.2: in-workspace read-only tools default Allow (external_path still Ask later)
    { action: 'workspace_list', effect: AgentGateEffect.Allow },
    { action: 'workspace_read', effect: AgentGateEffect.Allow }
  ]
}

/** 伙伴会话默认门控（Vault 级；旧配置迁移到此） */
export const DEFAULT_BAISHOU_AGENT_GATE_CONFIG: BaishouAgentGateConfig = {
  trustMode: AgentGateTrustMode.Manual,
  exclusionList: [...DEFAULT_AGENT_GATE_EXCLUSION_LIST],
  allowlist: [],
  forceAskExternalPath: true,
  externalPathEffect: 'ask',
  trustedExternalDirs: [],
  repeatAssertAskThreshold: DEFAULT_AGENT_GATE_REPEAT_ASSERT_ASK_THRESHOLD,
  hideDeniedTools: true
}

/**
 * 工作区默认门控：逐项确认、空 allowlist。
 * 故意不继承旧全局 FullTrust，避免扩散到所有项目。
 */
export const DEFAULT_WORKSPACE_AGENT_GATE_CONFIG: BaishouAgentGateConfig = {
  trustMode: AgentGateTrustMode.Manual,
  exclusionList: [...DEFAULT_WORKSPACE_AGENT_GATE_EXCLUSION_LIST],
  allowlist: [],
  forceAskExternalPath: true,
  externalPathEffect: 'ask',
  trustedExternalDirs: [],
  repeatAssertAskThreshold: DEFAULT_AGENT_GATE_REPEAT_ASSERT_ASK_THRESHOLD,
  hideDeniedTools: true
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

  return {
    trustMode: source.trustMode ?? base.trustMode,
    exclusionList: [...(source.exclusionList ?? base.exclusionList)],
    allowlist: (source.allowlist ?? []).map((entry) => ({ ...entry })),
    actionRules: source.actionRules ? { ...source.actionRules } : undefined,
    permissionRules: source.permissionRules?.map((rule) => ({ ...rule })),
    forceAskExternalPath: source.forceAskExternalPath ?? base.forceAskExternalPath,
    externalPathEffect: source.externalPathEffect ?? base.externalPathEffect,
    trustedExternalDirs: [...(source.trustedExternalDirs ?? base.trustedExternalDirs ?? [])],
    repeatAssertAskThreshold: source.repeatAssertAskThreshold ?? base.repeatAssertAskThreshold,
    hideDeniedTools: source.hideDeniedTools ?? base.hideDeniedTools
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
