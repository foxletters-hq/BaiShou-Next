import * as path from 'path'

/** 软件级 AI 资源根目录名（规范 / skills 等） */
export const AI_ROOT_DIR_NAME = 'AI'
export const AI_SKILLS_DIR_NAME = 'skills'
export const SKILL_FILE_NAME = 'SKILL.md'

export const PROMPT_SHORTCUTS_MIGRATED_FLAG_KEY = 'prompt_shortcuts_migrated_to_skills_v1'

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

export function resolveSkillDir(skillsRoot: string, skillName: string): string {
  return path.join(skillsRoot, skillName)
}

export function resolveSkillFile(skillsRoot: string, skillName: string): string {
  return path.join(resolveSkillDir(skillsRoot, skillName), SKILL_FILE_NAME)
}
