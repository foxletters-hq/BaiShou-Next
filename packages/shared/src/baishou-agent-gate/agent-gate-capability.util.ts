import { AgentGateEffect, AgentGateTrustMode } from './agent-gate.enums'
import type {
  AgentGateExternalPathEffect,
  AgentGatePermissionRule,
  AgentGateResourceRef,
  BaishouAgentGateConfig
} from './agent-gate.types'
import type { AgentToolScene } from '../constants/agent-tools-ui.constants'
import {
  DEFAULT_AGENT_GATE_EXCLUSION_LIST,
  DEFAULT_WORKSPACE_AGENT_GATE_EXCLUSION_LIST
} from './agent-gate.defaults'
import { agentGateGlobMatch } from './agent-gate-ruleset.util'

export type { AgentGateExternalPathEffect }

/** 面向设置页的能力行 */
export type AgentGateCapabilityId =
  | 'browse'
  | 'edit'
  | 'delete'
  | 'command'
  | 'external'
  | 'diary_write'
  | 'diary_delete'
  | 'memory_store'
  | 'memory_delete'

export type AgentGateCapabilityEffect = AgentGateEffect

export interface AgentGateCapabilityDef {
  id: AgentGateCapabilityId
  /** 该能力管理的 action（支持写入 permissionRules） */
  actions: readonly string[]
  /** 删除等：UI 锁定为询问，不能改为允许/拒绝 */
  lockedToAsk?: boolean
  /** 命令等：不可整项允许，仅可询问/拒绝（或通过始终允许前缀） */
  disallowAllow?: boolean
  /** 区外路径能力：不写 action 规则，走 externalPathEffect */
  external?: boolean
}

export interface AgentGateCapabilityState {
  effects: Record<AgentGateCapabilityId, AgentGateCapabilityEffect>
  /** 工作台：可信区外目录（glob / 绝对路径前缀） */
  trustedExternalDirs: string[]
}

const WORKSPACE_BROWSE_ACTIONS = ['workspace_list', 'workspace_read'] as const
const WORKSPACE_EDIT_ACTIONS = ['workspace_write', 'workspace_patch', 'workspace_rename'] as const
const WORKSPACE_DELETE_ACTIONS = ['workspace_delete'] as const
const WORKSPACE_COMMAND_ACTIONS = ['workspace_run'] as const

const ALL_WORKSPACE_FILE_ACTIONS = [
  ...WORKSPACE_BROWSE_ACTIONS,
  ...WORKSPACE_EDIT_ACTIONS,
  ...WORKSPACE_DELETE_ACTIONS
] as const

export const WORKSPACE_GATE_CAPABILITIES: readonly AgentGateCapabilityDef[] = [
  { id: 'browse', actions: WORKSPACE_BROWSE_ACTIONS },
  { id: 'edit', actions: WORKSPACE_EDIT_ACTIONS },
  { id: 'delete', actions: WORKSPACE_DELETE_ACTIONS, lockedToAsk: true },
  { id: 'command', actions: WORKSPACE_COMMAND_ACTIONS, disallowAllow: true },
  { id: 'external', actions: [], external: true }
]

export const COMPANION_GATE_CAPABILITIES: readonly AgentGateCapabilityDef[] = [
  { id: 'diary_write', actions: ['diary_write'] },
  { id: 'diary_delete', actions: ['diary_delete'], lockedToAsk: true },
  { id: 'memory_store', actions: ['memory_store'] },
  { id: 'memory_delete', actions: ['memory_delete'], lockedToAsk: true }
]

export function getGateCapabilitiesForScene(scene: AgentToolScene): readonly AgentGateCapabilityDef[] {
  return scene === 'workspace' ? WORKSPACE_GATE_CAPABILITIES : COMPANION_GATE_CAPABILITIES
}

function managedActionSet(scene: AgentToolScene): Set<string> {
  const set = new Set<string>()
  for (const cap of getGateCapabilitiesForScene(scene)) {
    for (const action of cap.actions) set.add(action)
  }
  return set
}

function normalizeTrustedDir(dir: string): string | null {
  const trimmed = dir.trim().replace(/\\/g, '/')
  if (!trimmed) return null
  // Reject bare catch-alls that the engine ignores for path resources
  if (trimmed === '*' || trimmed === '**' || trimmed === '**/*') return null
  // Directory path without wildcard → prefix match under that root
  if (!trimmed.includes('*')) {
    return `${trimmed.replace(/\/+$/, '')}/**`
  }
  return trimmed
}

function isManagedActionOnlyRule(
  rule: AgentGatePermissionRule,
  managedActions: Set<string>
): boolean {
  if (rule.pattern) return false
  return managedActions.has(rule.action)
}

function isManagedExternalAllowRule(
  rule: AgentGatePermissionRule,
  trustedDirs: readonly string[]
): boolean {
  if (!rule.pattern || rule.effect !== AgentGateEffect.Allow) return false
  if (!ALL_WORKSPACE_FILE_ACTIONS.includes(rule.action as (typeof ALL_WORKSPACE_FILE_ACTIONS)[number])) {
    return false
  }
  const normalized = normalizeTrustedDir(rule.pattern)
  return normalized != null && trustedDirs.some((dir) => normalizeTrustedDir(dir) === normalized)
}

function readExternalPathEffect(config: BaishouAgentGateConfig): AgentGateExternalPathEffect {
  if (
    config.externalPathEffect === 'allow' ||
    config.externalPathEffect === 'deny' ||
    config.externalPathEffect === 'ask'
  ) {
    return config.externalPathEffect
  }
  return config.forceAskExternalPath === false ? 'allow' : 'ask'
}

function readTrustedExternalDirs(config: BaishouAgentGateConfig): string[] {
  if (!Array.isArray(config.trustedExternalDirs)) return []
  return config.trustedExternalDirs
    .filter((item): item is string => typeof item === 'string')
    .map(normalizeTrustedDir)
    .filter((item): item is string => !!item)
}

function effectForActions(
  config: BaishouAgentGateConfig,
  actions: readonly string[],
  defaults: AgentGateCapabilityEffect
): AgentGateCapabilityEffect {
  const rules = config.permissionRules ?? []
  const actionOnly = rules.filter((rule) => !rule.pattern)

  const deny = actions.every((action) =>
    actionOnly.some((rule) => rule.action === action && rule.effect === AgentGateEffect.Deny)
  )
  if (deny) return AgentGateEffect.Deny

  const allow = actions.every((action) =>
    actionOnly.some((rule) => rule.action === action && rule.effect === AgentGateEffect.Allow)
  )
  if (allow) return AgentGateEffect.Allow

  // Legacy FullTrust: treat unmanaged routine caps as Allow when no Deny rule
  if (config.trustMode === AgentGateTrustMode.FullTrust) {
    const hasDeny = actions.some((action) =>
      actionOnly.some((rule) => rule.action === action && rule.effect === AgentGateEffect.Deny)
    )
    if (!hasDeny) return AgentGateEffect.Allow
  }

  return defaults
}

/** 从现有配置反推能力矩阵状态 */
export function capabilityStateFromConfig(
  config: BaishouAgentGateConfig,
  scene: AgentToolScene
): AgentGateCapabilityState {
  const trustedExternalDirs = readTrustedExternalDirs(config)
  const effects = {} as Record<AgentGateCapabilityId, AgentGateCapabilityEffect>

  if (scene === 'workspace') {
    effects.browse = effectForActions(config, WORKSPACE_BROWSE_ACTIONS, AgentGateEffect.Allow)
    effects.edit = effectForActions(config, WORKSPACE_EDIT_ACTIONS, AgentGateEffect.Ask)
    effects.delete = AgentGateEffect.Ask
    effects.command = effectForActions(config, WORKSPACE_COMMAND_ACTIONS, AgentGateEffect.Ask)
    const external = readExternalPathEffect(config)
    effects.external =
      external === 'allow'
        ? AgentGateEffect.Allow
        : external === 'deny'
          ? AgentGateEffect.Deny
          : AgentGateEffect.Ask
  } else {
    effects.diary_write = effectForActions(config, ['diary_write'], AgentGateEffect.Ask)
    effects.diary_delete = AgentGateEffect.Ask
    effects.memory_store = effectForActions(config, ['memory_store'], AgentGateEffect.Ask)
    effects.memory_delete = AgentGateEffect.Ask
  }

  return { effects, trustedExternalDirs }
}

function buildActionOnlyRules(
  actions: readonly string[],
  effect: AgentGateCapabilityEffect
): AgentGatePermissionRule[] {
  if (effect === AgentGateEffect.Ask) return []
  // workspace_run 禁止无 pattern 的 Allow
  if (effect === AgentGateEffect.Allow && actions.includes('workspace_run')) {
    return actions
      .filter((action) => action !== 'workspace_run')
      .map((action) => ({ action, effect }))
  }
  return actions.map((action) => ({ action, effect }))
}

/**
 * 区外路径是否命中可信目录（仅过区外门，仍需再走读取/编辑等能力矩阵）。
 * 不再把可信目录编译成 action Allow 规则，避免绕过「编辑=询问」。
 */
export function matchesTrustedExternalDirs(
  config: Pick<BaishouAgentGateConfig, 'trustedExternalDirs'>,
  resources: readonly AgentGateResourceRef[]
): boolean {
  const patterns = readTrustedExternalDirs(config as BaishouAgentGateConfig)
  if (patterns.length === 0) return false
  const externalPaths = resources
    .filter((resource) => resource.kind === 'external_path')
    .map((resource) => resource.value.replace(/\\/g, '/'))
  if (externalPaths.length === 0) return false
  return externalPaths.some((path) =>
    patterns.some((pattern) => agentGateGlobMatch(pattern, path))
  )
}

export interface ApplyCapabilityPatch {
  capabilityId: AgentGateCapabilityId
  effect: AgentGateCapabilityEffect
  trustedExternalDirs?: string[]
}

/**
 * 将能力矩阵变更写回配置。
 * - 只替换该能力管理的 action-only 规则与可信区外 Allow 规则
 * - 保留用户自定义（带 pattern 且非可信目录管理）的高级规则
 */
export function applyCapabilityToConfig(
  config: BaishouAgentGateConfig,
  scene: AgentToolScene,
  patch: ApplyCapabilityPatch
): BaishouAgentGateConfig {
  const caps = getGateCapabilitiesForScene(scene)
  const def = caps.find((item) => item.id === patch.capabilityId)
  if (!def) return config

  const managedActions = managedActionSet(scene)
  const prevTrusted = readTrustedExternalDirs(config)
  const nextTrusted = (patch.trustedExternalDirs ?? prevTrusted)
    .map(normalizeTrustedDir)
    .filter((item): item is string => !!item)

  const effect = def.lockedToAsk
    ? AgentGateEffect.Ask
    : def.disallowAllow && patch.effect === AgentGateEffect.Allow
      ? AgentGateEffect.Ask
      : patch.effect

  const existingRules = config.permissionRules ?? []
  const preserved = existingRules.filter((rule) => {
    if (isManagedActionOnlyRule(rule, managedActions)) return false
    if (isManagedExternalAllowRule(rule, prevTrusted) || isManagedExternalAllowRule(rule, nextTrusted)) {
      return false
    }
    return true
  })

  const nextRules: AgentGatePermissionRule[] = [...preserved]

  // Rebuild all managed action-only rules from full capability state for consistency
  const state = capabilityStateFromConfig(config, scene)
  state.effects[patch.capabilityId] = effect
  if (patch.trustedExternalDirs) {
    state.trustedExternalDirs = nextTrusted
  }

  for (const cap of caps) {
    if (cap.external) continue
    let capEffect = cap.lockedToAsk
      ? AgentGateEffect.Ask
      : (state.effects[cap.id] ?? AgentGateEffect.Ask)
    if (cap.disallowAllow && capEffect === AgentGateEffect.Allow) {
      capEffect = AgentGateEffect.Ask
    }
    nextRules.push(...buildActionOnlyRules(cap.actions, capEffect))
  }

  const next: BaishouAgentGateConfig = {
    ...config,
    permissionRules: nextRules,
    // Matrix replaces trustMode as primary UX
    trustMode: AgentGateTrustMode.Manual
  }

  if (scene === 'workspace') {
    applyWorkspaceExternalFields(next, state.effects.external ?? AgentGateEffect.Ask, state.trustedExternalDirs)
    const exclusion = new Set(config.exclusionList ?? [...DEFAULT_WORKSPACE_AGENT_GATE_EXCLUSION_LIST])
    exclusion.add('workspace_delete')
    next.exclusionList = [...exclusion]
  } else {
    const exclusion = new Set(config.exclusionList ?? [...DEFAULT_AGENT_GATE_EXCLUSION_LIST])
    exclusion.add('diary_delete')
    exclusion.add('memory_delete')
    next.exclusionList = [...exclusion]
  }

  return next
}

function applyWorkspaceExternalFields(
  next: BaishouAgentGateConfig,
  externalEffect: AgentGateCapabilityEffect,
  trustedDirs: readonly string[]
): void {
  next.trustedExternalDirs = [...trustedDirs]
  if (externalEffect === AgentGateEffect.Deny) {
    next.externalPathEffect = 'deny'
    next.forceAskExternalPath = true
    return
  }
  if (externalEffect === AgentGateEffect.Allow) {
    next.externalPathEffect = 'allow'
    // 有可信目录时：未匹配路径仍询问；无可信目录时：关闭强制询问（仍受编辑/命令能力约束）
    next.forceAskExternalPath = trustedDirs.length > 0
    return
  }
  next.externalPathEffect = 'ask'
  next.forceAskExternalPath = true
}

/** 一次性用完整矩阵状态覆盖托管规则（设置页批量保存） */
export function applyCapabilityStateToConfig(
  config: BaishouAgentGateConfig,
  scene: AgentToolScene,
  state: AgentGateCapabilityState
): BaishouAgentGateConfig {
  const caps = getGateCapabilitiesForScene(scene)
  const managedActions = managedActionSet(scene)
  const prevTrusted = readTrustedExternalDirs(config)
  const nextTrusted = state.trustedExternalDirs
    .map(normalizeTrustedDir)
    .filter((item): item is string => !!item)

  const existingRules = config.permissionRules ?? []
  const preserved = existingRules.filter((rule) => {
    if (isManagedActionOnlyRule(rule, managedActions)) return false
    if (isManagedExternalAllowRule(rule, prevTrusted) || isManagedExternalAllowRule(rule, nextTrusted)) {
      return false
    }
    return true
  })

  const nextRules: AgentGatePermissionRule[] = [...preserved]
  for (const cap of caps) {
    if (cap.external) continue
    let capEffect = cap.lockedToAsk
      ? AgentGateEffect.Ask
      : (state.effects[cap.id] ?? AgentGateEffect.Ask)
    if (cap.disallowAllow && capEffect === AgentGateEffect.Allow) {
      capEffect = AgentGateEffect.Ask
    }
    nextRules.push(...buildActionOnlyRules(cap.actions, capEffect))
  }
  const next: BaishouAgentGateConfig = {
    ...config,
    permissionRules: nextRules,
    trustMode: AgentGateTrustMode.Manual
  }

  if (scene === 'workspace') {
    applyWorkspaceExternalFields(
      next,
      state.effects.external ?? AgentGateEffect.Ask,
      nextTrusted
    )
    const exclusion = new Set(config.exclusionList ?? [...DEFAULT_WORKSPACE_AGENT_GATE_EXCLUSION_LIST])
    exclusion.add('workspace_delete')
    next.exclusionList = [...exclusion]
  } else {
    const exclusion = new Set(config.exclusionList ?? [...DEFAULT_AGENT_GATE_EXCLUSION_LIST])
    exclusion.add('diary_delete')
    exclusion.add('memory_delete')
    next.exclusionList = [...exclusion]
  }

  return next
}
