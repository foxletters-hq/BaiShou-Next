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
  | 'diary_read'
  | 'diary_write'
  | 'diary_edit'
  | 'diary_delete'
  | 'diary_list'
  | 'diary_search'
  | 'summary_read'
  | 'message_search'
  | 'vector_search'
  | 'memory_store'
  | 'memory_delete'
  | 'recall_relations'
  | 'graph_upsert'
  | 'web_search'
  | 'url_read'
  | 'current_time'

export type AgentGateCapabilityEffect = AgentGateEffect

export interface AgentGateCapabilityDef {
  id: AgentGateCapabilityId
  /** 该能力管理的 action（支持写入 permissionRules） */
  actions: readonly string[]
  /** 无用户规则时的默认效果（只读工具 Allow，写入/删除 Ask） */
  defaultEffect?: AgentGateCapabilityEffect
  /** 删除等：UI 锁定为询问，不能改为允许/拒绝 */
  lockedToAsk?: boolean
  /** 命令等：不可整项允许，仅可询问/拒绝（或通过始终允许前缀） */
  disallowAllow?: boolean
  /** 区外目录能力：管理 external_directory 规则 */
  external?: boolean
}

export interface AgentGateCapabilityState {
  effects: Partial<Record<AgentGateCapabilityId, AgentGateCapabilityEffect>>
  /** 工作台：可信区外目录（glob / 绝对路径前缀）→ 编译为 external_directory Allow */
  trustedExternalDirs: string[]
}

const WORKSPACE_BROWSE_ACTIONS = ['workspace_list', 'workspace_read'] as const
const WORKSPACE_EDIT_ACTIONS = ['workspace_write', 'workspace_patch', 'workspace_rename'] as const
const WORKSPACE_DELETE_ACTIONS = ['workspace_delete'] as const
const WORKSPACE_COMMAND_ACTIONS = ['workspace_run'] as const

export const WORKSPACE_GATE_CAPABILITIES: readonly AgentGateCapabilityDef[] = [
  { id: 'browse', actions: WORKSPACE_BROWSE_ACTIONS, defaultEffect: AgentGateEffect.Allow },
  { id: 'edit', actions: WORKSPACE_EDIT_ACTIONS, defaultEffect: AgentGateEffect.Ask },
  { id: 'delete', actions: WORKSPACE_DELETE_ACTIONS, defaultEffect: AgentGateEffect.Ask },
  {
    id: 'command',
    actions: WORKSPACE_COMMAND_ACTIONS,
    defaultEffect: AgentGateEffect.Ask,
    disallowAllow: true
  },
  {
    id: 'external',
    actions: [EXTERNAL_DIRECTORY_ACTION],
    defaultEffect: AgentGateEffect.Ask,
    external: true
  }
]

export const COMPANION_GATE_CAPABILITIES: readonly AgentGateCapabilityDef[] = [
  { id: 'diary_read', actions: ['diary_read'], defaultEffect: AgentGateEffect.Allow },
  { id: 'diary_write', actions: ['diary_write'], defaultEffect: AgentGateEffect.Ask },
  { id: 'diary_edit', actions: ['diary_edit'], defaultEffect: AgentGateEffect.Ask },
  { id: 'diary_delete', actions: ['diary_delete'], defaultEffect: AgentGateEffect.Ask },
  { id: 'diary_list', actions: ['diary_list'], defaultEffect: AgentGateEffect.Allow },
  { id: 'diary_search', actions: ['diary_search'], defaultEffect: AgentGateEffect.Allow },
  { id: 'summary_read', actions: ['summary_read'], defaultEffect: AgentGateEffect.Allow },
  { id: 'message_search', actions: ['message_search'], defaultEffect: AgentGateEffect.Allow },
  { id: 'vector_search', actions: ['vector_search'], defaultEffect: AgentGateEffect.Allow },
  { id: 'memory_store', actions: ['memory_store'], defaultEffect: AgentGateEffect.Ask },
  { id: 'memory_delete', actions: ['memory_delete'], defaultEffect: AgentGateEffect.Ask },
  { id: 'recall_relations', actions: ['recall_relations'], defaultEffect: AgentGateEffect.Allow },
  { id: 'graph_upsert', actions: ['graph_upsert'], defaultEffect: AgentGateEffect.Ask },
  { id: 'web_search', actions: ['web_search'], defaultEffect: AgentGateEffect.Allow },
  { id: 'url_read', actions: ['url_read'], defaultEffect: AgentGateEffect.Allow },
  { id: 'current_time', actions: ['current_time'], defaultEffect: AgentGateEffect.Allow }
]

export function getGateCapabilitiesForScene(
  scene: AgentToolScene
): readonly AgentGateCapabilityDef[] {
  return scene === 'workspace' ? WORKSPACE_GATE_CAPABILITIES : COMPANION_GATE_CAPABILITIES
}

export function isCompanionGateCapabilityId(id: string): id is AgentGateCapabilityId {
  return COMPANION_GATE_CAPABILITIES.some((cap) => cap.id === id)
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

function readTrustedExternalDirsFromRules(rules: readonly AgentGatePermissionRule[]): string[] {
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

  const ask = actions.every((action) =>
    actionOnly.some((rule) => rule.action === action && rule.effect === AgentGateEffect.Ask)
  )
  if (ask) return AgentGateEffect.Ask

  // 旧 FullTrust 等价：`*: allow` 垫底时，未显式 Deny 的能力显示为允许
  if (hasCatchAllAllowRule(config)) {
    const hasDeny = actions.some((action) =>
      actionOnly.some((rule) => rule.action === action && rule.effect === AgentGateEffect.Deny)
    )
    if (!hasDeny) return AgentGateEffect.Allow
  }

  return defaults
}

function effectForExternalDirectory(config: BaishouAgentGateConfig): AgentGateCapabilityEffect {
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
  const effects: Partial<Record<AgentGateCapabilityId, AgentGateCapabilityEffect>> = {}

  for (const cap of getGateCapabilitiesForScene(scene)) {
    if (cap.lockedToAsk) {
      effects[cap.id] = AgentGateEffect.Ask
      continue
    }
    if (cap.external) {
      effects[cap.id] = effectForExternalDirectory(config)
      continue
    }
    effects[cap.id] = effectForActions(
      config,
      cap.actions,
      cap.defaultEffect ?? AgentGateEffect.Ask
    )
  }

  return { effects, trustedExternalDirs }
}

function buildActionOnlyRules(
  actions: readonly string[],
  effect: AgentGateCapabilityEffect,
  defaultEffect: AgentGateCapabilityEffect = AgentGateEffect.Ask
): AgentGatePermissionRule[] {
  if (effect === defaultEffect) return []
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
    const fallback = cap.defaultEffect ?? AgentGateEffect.Ask
    let capEffect = cap.lockedToAsk ? AgentGateEffect.Ask : (state.effects[cap.id] ?? fallback)
    if (cap.disallowAllow && capEffect === AgentGateEffect.Allow) {
      capEffect = AgentGateEffect.Ask
    }
    nextRules.push(...buildActionOnlyRules(cap.actions, capEffect, fallback))
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
    // 历史配置可能仍带 workspace_delete；删除已支持「始终允许」，加载时剥掉
    exclusion.delete('workspace_delete')
    next.exclusionList = [...exclusion]
  } else {
    const exclusion = new Set(config.exclusionList ?? [...DEFAULT_AGENT_GATE_EXCLUSION_LIST])
    exclusion.delete('workspace_delete')
    for (const action of ['diary_delete', 'memory_delete'] as const) {
      const effect = state.effects[action] ?? AgentGateEffect.Ask
      if (effect === AgentGateEffect.Ask) exclusion.add(action)
      else exclusion.delete(action)
    }
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
