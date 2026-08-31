/** 官方安装目录技能、用户自定义技能，或当前工作区项目内技能 */
export type AgentSkillSource = 'software' | 'user' | 'workspace'

/**
 * Agent Skill（磁盘 SKILL.md）
 */
export interface AgentSkill {
  /** kebab-case，与目录名一致，供 `/` 匹配 */
  name: string
  description: string
  /** SKILL.md 正文（不含顶部 properties / 旧版 YAML 元信息） */
  content: string
  /** SKILL.md 绝对路径 */
  location: string
  /** 缺省视为 software */
  source?: AgentSkillSource
}

export interface AgentSkillWriteInput {
  name: string
  description: string
  content: string
  /** 重命名时的原 name */
  previousName?: string
}
