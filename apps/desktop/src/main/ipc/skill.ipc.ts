import type { AgentSkillWriteInput, PromptShortcut } from '@baishou/shared'
import {
  createAgentSkill,
  getAiSkillsRoot,
  listAgentSkills,
  listAgentSkillsAsShortcuts,
  removeAgentSkill,
  updateAgentSkill
} from '../services/agent-skills.service'
import { tracedIpcHandle } from './ipc-trace.util'

export function registerSkillIPC() {
  tracedIpcHandle('skills:list', async () => {
    return await listAgentSkills()
  })

  tracedIpcHandle('skills:list-as-shortcuts', async () => {
    return await listAgentSkillsAsShortcuts()
  })

  tracedIpcHandle('skills:get-root', async () => {
    return await getAiSkillsRoot()
  })

  tracedIpcHandle('skills:create', async (_, input: AgentSkillWriteInput) => {
    return await createAgentSkill(input)
  })

  tracedIpcHandle('skills:update', async (_, input: AgentSkillWriteInput) => {
    return await updateAgentSkill(input)
  })

  tracedIpcHandle('skills:remove', async (_, name: string) => {
    await removeAgentSkill(name)
  })

  /** 兼容旧快捷指令 API：读盘 Skill，写盘仍走 Skill */
  tracedIpcHandle('shortcuts:get-all', async () => {
    return await listAgentSkillsAsShortcuts()
  })

  tracedIpcHandle('shortcuts:save-all', async (_, list: PromptShortcut[]) => {
    const existing = await listAgentSkills()
    const existingNames = new Set(existing.map((s) => s.name))
    const nextNames = new Set<string>()

    for (const item of list) {
      const name = (item.command || item.id || '').trim()
      const description = (item.description || item.name || item.tag || name).trim()
      const content = item.content || ''
      if (!name) continue
      nextNames.add(name)
      if (existingNames.has(name)) {
        await updateAgentSkill({ name, description, content, previousName: name })
      } else {
        await createAgentSkill({ name, description, content })
      }
    }

    for (const skill of existing) {
      if (!nextNames.has(skill.name)) {
        await removeAgentSkill(skill.name)
      }
    }
    return true
  })

  tracedIpcHandle('shortcuts:add', async (_, sc: Omit<PromptShortcut, 'id'>) => {
    const skill = await createAgentSkill({
      name: sc.command || sc.name || 'skill',
      description: sc.description || sc.name || sc.tag || '',
      content: sc.content
    })
    return {
      id: skill.name,
      name: skill.description,
      command: skill.name,
      description: skill.description,
      content: skill.content,
      tag: skill.description
    } satisfies PromptShortcut
  })

  tracedIpcHandle(
    'shortcuts:update',
    async (_, id: string, payload: Partial<PromptShortcut>) => {
      const current = (await listAgentSkills()).find((s) => s.name === id)
      if (!current) return
      await updateAgentSkill({
        previousName: id,
        name: payload.command || id,
        description: payload.description || payload.name || payload.tag || current.description,
        content: payload.content ?? current.content
      })
    }
  )

  tracedIpcHandle('shortcuts:delete', async (_, id: string) => {
    await removeAgentSkill(id)
  })
}
