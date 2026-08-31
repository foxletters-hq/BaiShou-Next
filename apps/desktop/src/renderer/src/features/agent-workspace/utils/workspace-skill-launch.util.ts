import {
  CREATE_SKILL_SLASH_COMMAND,
  buildSkillSendText,
  isHiddenBundledSoftwareSkill,
  isOfficialAgentSkillName,
  type AgentSkillSource
} from '@baishou/shared'

export type WorkspaceSkillSendMeta = {
  text: string
  displayText: string
  skillRefs: Array<{ command: string; content: string }>
}

/** 与输入框选中技能后立即发送相同：气泡显示 /name，正文发给模型去执行 */
export function buildSkillSendMeta(skill: {
  name: string
  content: string
}): WorkspaceSkillSendMeta {
  const command = skill.name.trim()
  const content = skill.content.trim()
  return {
    text: buildSkillSendText([{ command, content }]),
    displayText: `/${command}`,
    skillRefs: [{ command, content }]
  }
}

export function matchesWorkbenchSkillSearch(
  query: string,
  skill: { name: string; title: string; description: string }
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [skill.name, skill.title, skill.description].some((value) =>
    value.toLowerCase().includes(q)
  )
}

export type WorkbenchSkillSectionId = 'official' | 'user' | 'project'

export function resolveWorkbenchSkillSection(
  source?: AgentSkillSource,
  name?: string
): WorkbenchSkillSectionId {
  if (source === 'workspace') return 'project'
  if (name && isOfficialAgentSkillName(name)) return 'official'
  if (source === 'user') return 'user'
  return 'official'
}

export function ensureOfficialCreateSkill<T extends { name: string; description?: string }>(
  official: T[],
  fallback: T
): T[] {
  const normalized = official.map((item) =>
    item.name === CREATE_SKILL_SLASH_COMMAND
      ? { ...item, description: CREATE_SKILL_SLASH_COMMAND }
      : item
  )
  if (normalized.some((item) => item.name === CREATE_SKILL_SLASH_COMMAND)) return normalized
  return [fallback, ...normalized]
}

export function partitionWorkbenchSkills<T extends { name?: string; source?: AgentSkillSource }>(
  skills: T[]
): { official: T[]; user: T[]; project: T[] } {
  const official: T[] = []
  const user: T[] = []
  const project: T[] = []
  for (const skill of skills) {
    const section = resolveWorkbenchSkillSection(skill.source, skill.name)
    if (section === 'project') project.push(skill)
    else if (section === 'user') user.push(skill)
    else official.push(skill)
  }
  return { official, user, project }
}

export function resolveSkillEditScope(source?: AgentSkillSource): 'user' | 'workspace' {
  return source === 'workspace' ? 'workspace' : 'user'
}

export function isSkillNameLockedForEdit(source?: AgentSkillSource): boolean {
  return source !== 'user' && source !== 'workspace'
}

export function orderSkillLaunchWorkspaces<T extends { id: string }>(
  workspaces: T[],
  preferredId?: string | null
): T[] {
  const preferred = preferredId
    ? workspaces.find((item) => item.id === preferredId)
    : undefined
  if (!preferred) return workspaces
  return [preferred, ...workspaces.filter((item) => item.id !== preferred.id)]
}

export function resolveScopedWorkbenchSkills<T extends { source?: AgentSkillSource }>(params: {
  scope: 'global' | 'project'
  userSkills: T[]
  projectSkills: T[]
}): T[] {
  if (params.scope === 'global') return params.userSkills
  return params.projectSkills.filter((skill) => skill.source === 'workspace')
}

export type WorkbenchSkillsPageTab = 'skill' | 'template' | 'mcp'

export function resolveWorkbenchSkillsPageTab(raw: string | null): WorkbenchSkillsPageTab {
  if (raw === 'mcp' || raw === 'template') return raw
  return 'skill'
}

export function isHiddenBundledTemplateSkill(skill: {
  name: string
  source?: AgentSkillSource
}): boolean {
  return isHiddenBundledSoftwareSkill(skill)
}

export function omitHiddenBundledTemplateSkills<T extends { name: string; source?: AgentSkillSource }>(
  skills: T[]
): T[] {
  return skills.filter((skill) => !isHiddenBundledTemplateSkill(skill))
}
