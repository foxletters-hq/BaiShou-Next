import { AgentGateEffect, type AgentGateProfileId } from '@baishou/shared'
import type { IBaishouAgentGate } from '../baishou-agent-gate/baishou-agent-gate.service'

/**
 * 按 `skill_read` 的资源规则过滤技能目录：
 * 命中 `agentGatePermissionRule` 中 `action: skill_read` + `pattern: <skill-name>` 的 Deny 项不会进入目录。
 * 没有 gate（或 probe 抛错）时保持原样，保证降级可用。
 */
export function filterSkillsCatalogByGate<T extends { name: string }>(
  catalog: T[],
  options: {
    agentGate?: IBaishouAgentGate
    profileId?: AgentGateProfileId
  }
): T[] {
  const gate = options.agentGate
  if (!gate?.probeEffect) return catalog
  return catalog.filter((entry) => {
    try {
      const effect = gate.probeEffect({
        action: 'skill_read',
        resources: [{ kind: 'skill', value: entry.name }],
        ...(options.profileId ? { profileId: options.profileId } : {})
      })
      return effect !== AgentGateEffect.Deny
    } catch {
      return true
    }
  })
}
