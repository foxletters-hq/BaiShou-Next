import type {
  AgentGateEffect,
  AgentGateKind,
  AgentGateProfileId,
  AgentGateReply,
  AgentGateRequestStatus,
  AgentGateRiskLevel
} from './agent-gate.enums'
import type { AgentGatePreview } from './agent-gate-preview.types'

export interface AgentGateOption {
  id: string
  label: string
  description?: string
}

/** Resource kinds that permission patterns can target */
export type AgentGateResourceKind =
  | 'file_path'
  | 'workspace_path'
  | 'external_path'
  | 'shell_command'

export interface AgentGateAllowlistEntry {
  id: string
  action: string
  createdAt: number
  /** Optional resource pattern (e.g. shell prefix `git status *` or path glob). */
  pattern?: string
  /** Resource kind the pattern applies to; defaults to shell_command when pattern looks like a command. */
  resourceKind?: AgentGateResourceKind
  sourceSessionId?: string
  sourceRequestId?: string
}

export interface AgentGateResourceRef {
  kind: AgentGateResourceKind
  value: string
}

export interface AgentGatePermissionRule {
  action: string
  pattern?: string
  effect: AgentGateEffect
}

/** G4：活动范围预设（工作台 UI） */
export type AgentGateScopePreset = 'readonly' | 'workspace_write' | 'with_trusted_dirs' | 'custom'

/** G4：审批时机预设（工作台 UI） */
export type AgentGateApprovalPreset = 'always_ask' | 'dangerous_only' | 'never_ask' | 'custom'

export interface BaishouAgentGateConfig {
  exclusionList: string[]
  /**
   * 记忆层（G4 设计稿中的 remembered）。
   * 运行时字段名仍为 allowlist，便于兼容已有 IPC / 存储。
   */
  allowlist: AgentGateAllowlistEntry[]
  /** @deprecated legacy；求值时并入 permissionRules */
  actionRules?: Partial<Record<string, AgentGateEffect>>
  /**
   * 有序规则表（G4 设计稿中的 rules）；顺序即优先级（最后匹配赢）。
   */
  permissionRules?: AgentGatePermissionRule[]
  /**
   * Consecutive same-fingerprint asserts in one session that force Ask.
   * Default 3; set 0 to disable.
   */
  repeatAssertAskThreshold?: number
  /**
   * When true (default), tools whose action evaluates to Deny (with no resources)
   * are omitted from the model tool list.
   */
  hideDeniedTools?: boolean
  /** G4：活动范围预设（工作台 UI）；custom 表示用户改过细项 */
  scopePreset?: AgentGateScopePreset
  /** G4：审批时机预设（工作台 UI） */
  approvalPreset?: AgentGateApprovalPreset
}

/**
 * G4 工作区门控策略 v2 视图。
 * 落盘仍使用 AgentWorkspacePolicy.gateConfig（BaishouAgentGateConfig），
 * rules ↔ permissionRules、remembered ↔ allowlist。
 */
export interface WorkspaceGatePolicyV2 {
  version: 2
  scopePreset: AgentGateScopePreset
  approvalPreset: AgentGateApprovalPreset
  rules: AgentGatePermissionRule[]
  remembered: AgentGateAllowlistEntry[]
  exclusionList: string[]
  hideDeniedTools: boolean
  repeatAssertAskThreshold: number
}

/** 分层求值命中来源（写入权限卡 metadata，供 UI 展示） */
export type AgentGateDecisionLayer = 'profile' | 'user' | 'remembered' | 'session' | 'default'

export interface AgentGateDecisionSource {
  layer: AgentGateDecisionLayer
  action: string
  pattern?: string
  effect: AgentGateEffect
  /** 钳制前效果；有值表示被红线从 Allow 压回 Ask */
  clampedFrom?: AgentGateEffect
}

/** 伙伴（Vault）或单个工作区的门控作用域 */
export type AgentGateConfigScope =
  | { kind: 'companion' }
  | { kind: 'workspace'; workspaceId: string }

/** 单个工作区的工具开关（不含表情包等伙伴专属配置） */
export interface WorkspaceToolManagementConfig {
  disabledToolIds: string[]
  customConfigs: Record<string, Record<string, unknown>>
}

/** 按 workspaceId 持久化的工作区策略（权限 + 工具） */
export interface AgentWorkspacePolicy {
  workspaceId: string
  gateConfig: BaishouAgentGateConfig
  toolManagement: WorkspaceToolManagementConfig
  updatedAt: string
}

export interface AgentGateRequest {
  id: string
  sessionId: string
  vaultName: string
  status: AgentGateRequestStatus
  kind: AgentGateKind
  action: string
  title: string
  description?: string
  options: AgentGateOption[]
  allowCustomInput: boolean
  metadata: Record<string, unknown>
  /** 预执行结构化预览（旧请求可能缺省） */
  preview?: AgentGatePreview
  /** 伙伴 / 工作区作用域（旧请求可能缺省） */
  scope?: AgentGateConfigScope
  /** Assert fingerprint used for repeat Ask protection (UI may show truncated). */
  fingerprint?: string
  /** Consecutive same-fingerprint asserts in this session when Ask was raised. */
  repeatCount?: number
  messageId?: string
  toolCallId?: string
  createdAt: number
  resolvedAt?: number
}

export interface AgentGateReplyInput {
  requestId: string
  reply: AgentGateReply
  message?: string
  selectedOptionIds?: string[]
}

export interface AgentGateResolution {
  requestId: string
  reply: AgentGateReply
  selectedOptionIds?: string[]
  message?: string
  resolvedAt: number
}

export interface AgentGateEvaluateInput {
  action: string
  toolDisabled?: boolean
  /** Optional resource targets for pattern-based rules */
  resources?: AgentGateResourceRef[]
  preview?: AgentGatePreview
  /** Gate request metadata (forceExclusion, legacy path fields, etc.) */
  metadata?: Record<string, unknown>
  /** Scene profile for default rule matrix */
  profileId?: AgentGateProfileId
  /** G4：工作区自动接受时注入会话层 Allow */
  autoAccept?: boolean
}

export interface AgentGateAssertInput {
  sessionId: string
  vaultName: string
  kind: AgentGateKind
  action: string
  title: string
  description?: string
  options?: AgentGateOption[]
  allowCustomInput?: boolean
  metadata?: Record<string, unknown>
  /** 预执行结构化预览（会写入 pending request） */
  preview?: AgentGatePreview
  /** 伙伴 / 工作区作用域 */
  scope?: AgentGateConfigScope
  /** Structured resource targets; derived from metadata when omitted */
  resources?: AgentGateResourceRef[]
  /** Scene profile for default rule matrix */
  profileId?: AgentGateProfileId
  messageId?: string
  toolCallId?: string
}

/** 工具在 assert 前异步准备的预览与校验闭包 */
export interface AgentGatePrepareResult {
  preview: AgentGatePreview
  description?: string
  metadataPatch?: Record<string, unknown>
  /**
   * 用户批准后、执行前调用。失败时应抛错并 fail closed。
   * 文件哈希与目标内容仅保留在此闭包中，不进入 request/通知。
   */
  verifyBeforeExecute?: () => Promise<void>
  /**
   * 进程内新鲜度登记 token（不进 request/通知）。
   * 拦截器在 verify 失败或拒绝时回收，在 execute 前消费校验。
   */
  freshnessToken?: string
}

export interface AgentGatePartData {
  request: AgentGateRequest
  resolution?: AgentGateResolution
}

export interface AgentGateToolMetadata {
  action?: string
  riskLevel: AgentGateRiskLevel
  forceExclusion?: boolean
  buildTitle?: (args: unknown, ctx: unknown) => string
  buildMetadata?: (args: unknown, ctx: unknown) => Record<string, unknown>
  buildResources?: (args: unknown, ctx: unknown) => AgentGateResourceRef[]
  /**
   * 用户点「始终允许」时要记住的 pattern；缺省为 ['*']（整项放行）。
   * 返回空数组表示不允许 Always。
   */
  buildAlwaysPatterns?: (args: unknown, ctx: unknown) => string[]
  /**
   * 异步预执行准备：生成 UI 预览；校验状态留在闭包。
   * 返回 null 表示无法准备（如 patch 无匹配）——拦截器应直接失败，不弹权限卡。
   */
  prepare?: (args: unknown, ctx: unknown) => Promise<AgentGatePrepareResult | null>
}

export interface AgentGateAskedEvent {
  type: 'agent_gate.asked'
  request: AgentGateRequest
}

export interface AgentGateRepliedEvent {
  type: 'agent_gate.replied'
  sessionId: string
  requestId: string
  reply: AgentGateReply
  message?: string
  selectedOptionIds?: string[]
}

export interface AgentGateAllowlistChangedEvent {
  type: 'agent_gate.allowlist_changed'
  allowlist: AgentGateAllowlistEntry[]
  /** 伙伴 / 工作区作用域；旧事件可能缺省（视为 companion） */
  scope?: AgentGateConfigScope
}

export type AgentGateEvent =
  | AgentGateAskedEvent
  | AgentGateRepliedEvent
  | AgentGateAllowlistChangedEvent

export interface AgentGateLifecycleContext {
  sessionId: string
  vaultName: string
}
