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
  /**
   * false 表示不自动进入 `skills_catalog`，只有用户 `/` 显式调用时才会加载。
   * 缺省 true。
   */
  autoinvoke?: boolean
  /**
   * 内置技能写入时的正文指纹。仅官方默认技能带此标记；
   * 文件上仍有该标记且与当前内置正文指纹不同，说明是未改动的旧版内置副本，可安全覆盖升级。
   * 用户自己保存/编辑过的技能不带此标记，升级时不会被覆盖。
   */
  bundledHash?: string
}

export interface AgentSkillWriteInput {
  name: string
  description: string
  content: string
  /** 重命名时的原 name */
  previousName?: string
}
