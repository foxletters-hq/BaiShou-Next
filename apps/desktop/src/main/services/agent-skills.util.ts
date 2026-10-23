import * as path from 'path'

/** 软件级 AI 资源根目录名（规范 / skills 等） */
export const AI_ROOT_DIR_NAME = 'AI'
export const AI_SKILLS_DIR_NAME = 'skills'
export const SKILL_FILE_NAME = 'SKILL.md'
/** 用户创建的技能写入此隐藏目录（跨客户端约定，不写入 AI/skills） */
export const AGENTS_DIR_NAME = '.agents'
export const AGENTS_SKILLS_DIR_NAME = 'skills'
/** 工作区根目录下只扫这些相对路径（不向上级目录查找）；后者覆盖前者 */
export const WORKSPACE_SKILL_RELATIVE_DIRS: readonly string[][] = [
  ['skill'],
  ['skills'],
  [AGENTS_DIR_NAME, AGENTS_SKILLS_DIR_NAME]
]
/** @deprecated 使用 WORKSPACE_SKILL_RELATIVE_DIRS */
export const WORKSPACE_SKILL_FOLDER_NAMES = ['skill', 'skills'] as const

export const PROMPT_SHORTCUTS_MIGRATED_FLAG_KEY = 'prompt_shortcuts_migrated_to_skills_v1'
/** 把误写入 AI/skills 的非官方技能迁到用户 `.agents/skills` */
export const NON_OFFICIAL_SKILLS_RELOCATED_FLAG_KEY = 'non_official_skills_relocated_to_agents_v1'
/** 删除旧官方 writer 技能目录，只保留 story-init 模板 */
export const LEGACY_WRITER_SKILL_REMOVED_FLAG_KEY = 'legacy_writer_skill_removed_v1'
/** 从官方 AI/skills 删除已退役的 summarize / translate */
export const RETIRED_OFFICIAL_SKILLS_REMOVED_FLAG_KEY = 'retired_official_skills_removed_v1'

/**
 * 解析软件级 AI/skills 目录。
 * 优先 installRoot/AI/skills；installRoot 不可用时回退 userDataRoot/AI/skills。
 */
export function resolveAiSkillsRoot(params: {
  installRoot: string | null | undefined
  userDataRoot: string
}): string {
  const base =
    typeof params.installRoot === 'string' && params.installRoot.trim()
      ? params.installRoot.trim()
      : params.userDataRoot
  return path.join(base, AI_ROOT_DIR_NAME, AI_SKILLS_DIR_NAME)
}

/** 用户主目录或工作区根下的 `.agents/skills` */
export function resolveAgentsSkillsRoot(baseDir: string): string {
  const base = baseDir.trim()
  if (!base) return ''
  return path.join(base, AGENTS_DIR_NAME, AGENTS_SKILLS_DIR_NAME)
}

export function resolveSkillDir(skillsRoot: string, skillName: string): string {
  return path.join(skillsRoot, skillName)
}

export function resolveSkillFile(skillsRoot: string, skillName: string): string {
  return path.join(resolveSkillDir(skillsRoot, skillName), SKILL_FILE_NAME)
}
