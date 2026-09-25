import {
  AgentGateEffect,
  DEFAULT_AGENT_GATE_EXCLUSION_LIST,
  DEFAULT_WORKSPACE_AGENT_GATE_EXCLUSION_LIST,
  DEFAULT_WORKSPACE_COMMAND_BLACKLIST,
  type AgentGateCapabilityId,
  type AgentGateConfigScope,
  type AgentGatePermissionRule,
  type AgentToolScene,
  type BaishouAgentGateConfig
} from '@baishou/shared'

export type AgentGateSettingsTranslate = (
  key: string,
  fallback: string,
  options?: Record<string, unknown>
) => string

export function scopesMatch(a?: AgentGateConfigScope, b?: AgentGateConfigScope): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  if (a.kind !== b.kind) return false
  if (a.kind === 'workspace' && b.kind === 'workspace') {
    return a.workspaceId === b.workspaceId
  }
  return true
}

export function capabilityTitle(id: AgentGateCapabilityId, t: AgentGateSettingsTranslate): string {
  switch (id) {
    case 'browse':
      return t('settings.agent_gate_cap_browse', '读取')
    case 'edit':
      return t('settings.agent_gate_cap_edit', '编辑')
    case 'delete':
      return t('settings.agent_gate_cap_delete', '删除')
    case 'command':
      return t('settings.agent_gate_cap_command', '运行命令')
    case 'external':
      return t('settings.agent_gate_cap_external', '区外路径')
    case 'diary_write':
      return t('settings.agent_gate_cap_diary_write', '写入日记')
    case 'diary_delete':
      return t('settings.agent_gate_cap_diary_delete', '删除日记')
    case 'memory_store':
      return t('settings.agent_gate_cap_memory_store', '写入记忆')
    case 'memory_delete':
      return t('settings.agent_gate_cap_memory_delete', '删除记忆')
    case 'skill_write':
      return t('settings.agent_gate_cap_skill_write', '保存技能')
    default:
      return id
  }
}

export function capabilityHint(id: AgentGateCapabilityId, t: AgentGateSettingsTranslate): string {
  switch (id) {
    case 'browse':
      return t('settings.agent_gate_cap_browse_hint', '列出与读取工作区内文件')
    case 'edit':
      return t('settings.agent_gate_cap_edit_hint', '写入、补丁与重命名')
    case 'delete':
      return t('settings.agent_gate_cap_delete_hint', '删除工作区内文件；可设为允许、询问或拒绝')
    case 'command':
      return t(
        'settings.agent_gate_cap_command_hint',
        '在主机执行命令；不可整项允许，仅可记住安全前缀'
      )
    case 'external':
      return t(
        'settings.agent_gate_cap_external_hint',
        '触及工作区外路径时的默认策略；可添加可信目录'
      )
    case 'diary_write':
      return t('settings.agent_gate_cap_diary_write_hint', '创建或修改日记')
    case 'diary_delete':
      return t('settings.agent_gate_cap_diary_delete_hint', '删除日记始终需要确认')
    case 'memory_store':
      return t('settings.agent_gate_cap_memory_store_hint', '写入长期记忆')
    case 'memory_delete':
      return t('settings.agent_gate_cap_memory_delete_hint', '删除记忆始终需要确认')
    case 'skill_write':
      return t('settings.agent_gate_cap_skill_write_hint', '创建或更新软件级技能说明')
    default:
      return ''
  }
}

export function capabilityEffectOptions(cap: {
  lockedToAsk?: boolean
  disallowAllow?: boolean
}): AgentGateEffect[] {
  if (cap.lockedToAsk) return [AgentGateEffect.Ask]
  if (cap.disallowAllow) return [AgentGateEffect.Ask, AgentGateEffect.Deny]
  return [AgentGateEffect.Allow, AgentGateEffect.Ask, AgentGateEffect.Deny]
}

export function effectLabel(effect: AgentGateEffect, t: AgentGateSettingsTranslate): string {
  if (effect === AgentGateEffect.Allow) return t('settings.agent_gate_effect_allow', '允许')
  if (effect === AgentGateEffect.Deny) return t('settings.agent_gate_effect_deny', '拒绝')
  return t('settings.agent_gate_effect_ask', '询问')
}

export function resolveCommandBlacklist(
  config: Pick<BaishouAgentGateConfig, 'commandBlacklist'>
): string[] {
  return Array.isArray(config.commandBlacklist)
    ? [...config.commandBlacklist]
    : [...DEFAULT_WORKSPACE_COMMAND_BLACKLIST]
}

export function isDefaultCommandBlacklist(list: readonly string[]): boolean {
  if (list.length !== DEFAULT_WORKSPACE_COMMAND_BLACKLIST.length) return false
  const left = [...list].sort()
  const right = [...DEFAULT_WORKSPACE_COMMAND_BLACKLIST].sort()
  return left.every((item, index) => item === right[index])
}

export function resolveExclusionList(
  config: { exclusionList?: string[] },
  scene: AgentToolScene
): string[] {
  const fallback =
    scene === 'workspace'
      ? [...DEFAULT_WORKSPACE_AGENT_GATE_EXCLUSION_LIST]
      : [...DEFAULT_AGENT_GATE_EXCLUSION_LIST]
  return config.exclusionList ?? fallback
}

export function nextExclusionList(
  current: string[],
  draft: string
): string[] | 'empty' | 'duplicate' {
  const action = draft.trim()
  if (!action) return 'empty'
  if (current.includes(action)) return 'duplicate'
  return [...current, action]
}

export function normalizeTrustedDirDraft(draft: string): string | null {
  const dir = draft.trim().replace(/\\/g, '/')
  if (!dir || dir === '*' || dir === '**' || dir === '**/*') return null
  return dir
}

export function nextTrustedDirs(
  current: string[],
  draft: string
): string[] | 'invalid' | 'duplicate' {
  const dir = normalizeTrustedDirDraft(draft)
  if (!dir) return 'invalid'
  if (current.includes(dir)) return 'duplicate'
  return [...current, dir]
}

export function buildPermissionRule(
  actionDraft: string,
  effect: AgentGateEffect,
  patternDraft: string
): AgentGatePermissionRule | null {
  const action = actionDraft.trim()
  if (!action) return null
  return {
    action,
    effect,
    ...(patternDraft.trim() ? { pattern: patternDraft.trim() } : {})
  }
}

export function movePermissionRule(
  rules: AgentGatePermissionRule[],
  index: number,
  delta: number
): AgentGatePermissionRule[] | null {
  const target = index + delta
  if (target < 0 || target >= rules.length) return null
  const next = [...rules]
  const [item] = next.splice(index, 1)
  if (!item) return null
  next.splice(target, 0, item)
  return next
}

export function workspaceCustomPresetPatch(
  scene: AgentToolScene
): { scopePreset: 'custom'; approvalPreset: 'custom' } | Record<string, never> {
  return scene === 'workspace' ? { scopePreset: 'custom', approvalPreset: 'custom' } : {}
}

export function clampRepeatAssertAskThreshold(value: number): number | null {
  if (!Number.isFinite(value)) return null
  return Math.max(0, Math.min(20, Math.floor(value)))
}
