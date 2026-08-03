import { AgentGateEffect } from './agent-gate.enums'
import type {
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
import { EXTERNAL_DIRECTORY_ACTION, hasCatchAllAllowRule } from './agent-gate-migrate.util'

export { EXTERNAL_DIRECTORY_ACTION }
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
  /** 区外目录能力：管理 external_directory 规则 */
  external?: boolean
}

export interface AgentGateCapabilityState {
  effects: Record<AgentGateCapabilityId, AgentGateCapabilityEffect>
  /** 工作台：可信区外目录（glob / 绝对路径前缀）→ 编译为 external_directory Allow */
  trustedExternalDirs: string[]
}

const WORKSPACE_BROWSE_ACTIONS = ['workspace_list', 'workspace_read'] as const
const WORKSPACE_EDIT_ACTIONS = ['workspace_write', 'workspace_patch', 'workspace_rename'] as const
const WORKSPACE_DELETE_ACTIONS = ['workspace_delete'] as const
const WORKSPACE_COMMAND_ACTIONS = ['workspace_run'] as const

export const WORKSPACE_GATE_CAPABILITIES: readonly AgentGateCapabilityDef[] = [
  { id: 'browse', actions: WORKSPACE_BROWSE_ACTIONS },
  { id: 'edit', actions: WORKSPACE_EDIT_ACTIONS },
  { id: 'delete', actions: WORKSPACE_DELETE_ACTIONS, lockedToAsk: true },
  { id: 'command', actions: WORKSPACE_COMMAND_ACTIONS, disallowAllow: true },
  { id: 'external', actions: [EXTERNAL_DIRECTORY_ACTION], external: true }
]

export const COMPANION_GATE_CAPABILITIES: readonly AgentGateCapabilityDef[] = [
  { id: 'diary_write', actions: ['diary_write'] },
  { id: 'diary_delete', actions: ['diary_delete'], lockedToAsk: true },
  { id: 'memory_store', actions: ['memory_store'] },
  { id: 'memory_delete', actions: ['memory_delete'], lockedToAsk: true }
]

export function getGateCapabilitiesForScene(
  scene: AgentToolScene
): readonly AgentGateCapabilityDef[] {
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
  if (trimmed === '*' || trimmed === '**' || trimmed === '**/*') return null
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

function isManagedExternalDirectoryRule(rule: AgentGatePermissionRule): boolean {
  return rule.action === EXTERNAL_DIRECTORY_ACTION
}

function readTrustedExternalDirsFromRules(
  rules: readonly AgentGatePermissionRule[]
): string[] {
  return rules
    .filter(
      (rule) =>
        rule.action === EXTERNAL_DIRECTORY_ACTION &&
        rule.effect === AgentGateEffect.Allow &&
        !!rule.pattern
    )
    .map((rule) => normalizeTrustedDir(rule.pattern!))
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

  // 旧 FullTrust 等价：`*: allow` 垫底时，未显式 Deny 的能力显示为允许
  if (hasCatchAllAllowRule(config)) {
    const hasDeny = actions.some((action) =>
      actionOnly.some((rule) => rule.action === action && rule.effect === AgentGateEffect.Deny)
    )
    if (!hasDeny) return AgentGateEffect.Allow
  }

  return defaults
}

function effectForExternalDirectory(
  config: BaishouAgentGateConfig
): AgentGateCapabilityEffect {
  const rules = config.permissionRules ?? []
  const actionOnly = rules.filter(
    (rule) => rule.action === EXTERNAL_DIRECTORY_ACTION && !rule.pattern
  )
  if (actionOnly.some((rule) => rule.effect === AgentGateEffect.Deny)) {
    return AgentGateEffect.Deny
  }
  if (actionOnly.some((rule) => rule.effect === AgentGateEffect.Allow)) {
    return AgentGateEffect.Allow
  }
  // 仅有带 pattern 的 Allow（可信目录）时，UI 仍显示 Allow（配合目录列表）
  if (readTrustedExternalDirsFromRules(rules).length > 0) {
    return AgentGateEffect.Allow
  }
  return AgentGateEffect.Ask
}

/** 从现有配置反推能力矩阵状态 */
export function capabilityStateFromConfig(
  config: BaishouAgentGateConfig,
  scene: AgentToolScene
): AgentGateCapabilityState {
  const trustedExternalDirs = readTrustedExternalDirsFromRules(config.permissionRules ?? [])
  const effects = {} as Record<AgentGateCapabilityId, AgentGateCapabilityEffect>

  if (scene === 'workspace') {
    effects.browse = effectForActions(config, WORKSPACE_BROWSE_ACTIONS, AgentGateEffect.Allow)
    effects.edit = effectForActions(config, WORKSPACE_EDIT_ACTIONS, AgentGateEffect.Ask)
    effects.delete = AgentGateEffect.Ask
    effects.command = effectForActions(config, WORKSPACE_COMMAND_ACTIONS, AgentGateEffect.Ask)
    effects.external = effectForExternalDirectory(config)
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
  if (effect === AgentGateEffect.Allow && actions.includes('workspace_run')) {
    return actions
      .filter((action) => action !== 'workspace_run')
      .map((action) => ({ action, effect }))
  }
  return actions.map((action) => ({ action, effect }))
}

function buildExternalDirectoryRules(
  externalEffect: AgentGateCapabilityEffect,
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

  // Ask 或 Allow+可信目录：只写带 pattern 的 Allow；未匹配默认 Ask
  return normalizedDirs.map((pattern) => ({
    action: EXTERNAL_DIRECTORY_ACTION,
    pattern,
    effect: AgentGateEffect.Allow
  }))
}

/**
 * 区外路径是否命中可信目录规则（external_directory Allow + pattern）。
 * 两道门模型下主要用于 UI / 诊断；求值走普通规则表。
 */
export function matchesTrustedExternalDirs(
  config: Pick<BaishouAgentGateConfig, 'permissionRules'>,
  resources: readonly AgentGateResourceRef[]
): boolean {
  const patterns = readTrustedExternalDirsFromRules(config.permissionRules ?? [])
  if (patterns.length === 0) return false
  const externalPaths = resources
    .filter((resource) => resource.kind === 'external_path')
    .map((resource) => resource.value.replace(/\\/g, '/'))
  if (externalPaths.length === 0) return false
  return externalPaths.some((path) => patterns.some((pattern) => agentGateGlobMatch(pattern, path)))
}

export interface ApplyCapabilityPatch {
  capabilityId: AgentGateCapabilityId
  effect: AgentGateCapabilityEffect
  trustedExternalDirs?: string[]
}

function rebuildManagedRules(
  config: BaishouAgentGateConfig,
  scene: AgentToolScene,
  state: AgentGateCapabilityState
): BaishouAgentGateConfig {
  const caps = getGateCapabilitiesForScene(scene)
  const managedActions = managedActionSet(scene)
  const nextTrusted = state.trustedExternalDirs
    .map(normalizeTrustedDir)
    .filter((item): item is string => !!item)

  const existingRules = config.permissionRules ?? []
  const preserved = existingRules.filter((rule) => {
    if (isManagedExternalDirectoryRule(rule)) return false
    if (isManagedActionOnlyRule(rule, managedActions)) return false
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

  if (scene === 'workspace') {
    nextRules.push(
      ...buildExternalDirectoryRules(state.effects.external ?? AgentGateEffect.Ask, nextTrusted)
    )
  }

  const next: BaishouAgentGateConfig = {
    ...config,
    permissionRules: nextRules
  }

  if (scene === 'workspace') {
    const exclusion = new Set(
      config.exclusionList ?? [...DEFAULT_WORKSPACE_AGENT_GATE_EXCLUSION_LIST]
    )
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

/**
 * 将能力矩阵变更写回配置。
 * - 只替换该能力管理的 action-only 规则与 external_directory 托管规则
 * - 保留用户自定义（带 pattern 且非区外托管）的高级规则
 */
export function applyCapabilityToConfig(
  config: BaishouAgentGateConfig,
  scene: AgentToolScene,
  patch: ApplyCapabilityPatch
): BaishouAgentGateConfig {
  const caps = getGateCapabilitiesForScene(scene)
  const def = caps.find((item) => item.id === patch.capabilityId)
  if (!def) return config

  const effect = def.lockedToAsk
    ? AgentGateEffect.Ask
    : def.disallowAllow && patch.effect === AgentGateEffect.Allow
      ? AgentGateEffect.Ask
      : patch.effect

  const state = capabilityStateFromConfig(config, scene)
  state.effects[patch.capabilityId] = effect
  if (patch.trustedExternalDirs) {
    state.trustedExternalDirs = patch.trustedExternalDirs
      .map(normalizeTrustedDir)
      .filter((item): item is string => !!item)
  }

  return rebuildManagedRules(config, scene, state)
}

/** 一次性用完整矩阵状态覆盖托管规则（设置页批量保存） */
export function applyCapabilityStateToConfig(
  config: BaishouAgentGateConfig,
  scene: AgentToolScene,
  state: AgentGateCapabilityState
): BaishouAgentGateConfig {
  return rebuildManagedRules(config, scene, {
    effects: { ...state.effects },
    trustedExternalDirs: state.trustedExternalDirs
      .map(normalizeTrustedDir)
      .filter((item): item is string => !!item)
  })
}
