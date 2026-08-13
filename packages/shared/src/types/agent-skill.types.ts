/**
 * 软件级 Agent Skill（磁盘 SKILL.md）
 */
export interface AgentSkill {
  /** kebab-case，与目录名一致，供 `/` 匹配 */
  name: string
  description: string
  /** SKILL.md 正文（不含 frontmatter） */
  content: string
  /** SKILL.md 绝对路径 */
  location: string
}

export interface AgentSkillWriteInput {
  name: string
  description: string
  content: string
  /** 重命名时的原 name */
  previousName?: string
}
