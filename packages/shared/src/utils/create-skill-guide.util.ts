import {
  DIARY_APPEND_SKILL_NAME,
  SUMMARY_REPAIR_SKILL_NAME,
  SUMMARY_WRITE_SKILL_NAME
} from '../constants/builtin-skills'
import type { FallbackTranslateFn } from '../i18n/i18n.types'

/**
 * 「创建 Skill」入口注入的引导提示：让 Agent 按问答方式帮用户写 SKILL.md，
 * 并用 skill_write 落盘到当前范围的 `.agents/skills/`。
 */
export type CreateSkillGuideScope = 'software' | 'workspace'

export const CREATE_SKILL_GUIDE_PROMPT = `Guide me to create a software-level Skill (a reusable AI workflow pack).

Requirements:
- Communicate with me in my current language (matching my message language or App UI locale)
- Ask only 1–2 key questions at a time, then continue based on my answers; do not dump a full questionnaire at once
- Confirm purpose and trigger scenarios first, then decide the name and description, and finally write the body together
- The name must be kebab-case (lowercase letters, numbers, hyphens, e.g. code-review) and match the directory name
- The description should be in third person and state both what it does and when to use it so the Agent can select it later
- Keep the body concise: only include domain knowledge and workflow steps the Agent would not already know

When the information is sufficient:
1. Show me a full SKILL.md preview first: start the file with properties metadata (name: and description: lines), and do not wrap them with ---
2. After I agree, call the skill_write tool to save it as .agents/skills/<name>/SKILL.md in the user home directory (do not use workspace file write tools, and do not write to AI/skills)
`

export const CREATE_SKILL_GUIDE_PROMPT_WORKSPACE = `Guide me to create a project-level Skill (a reusable AI workflow pack scoped to the current workspace).

Requirements:
- Communicate with me in my current language (matching my message language or App UI locale)
- Ask only 1–2 key questions at a time, then continue based on my answers; do not dump a full questionnaire at once
- Confirm purpose and trigger scenarios first, then decide the name and description, and finally write the body together
- The name must be kebab-case (lowercase letters, numbers, hyphens, e.g. code-review) and match the directory name
- The description should be in third person and state both what it does and when to use it so the Agent can select it later
- Keep the body concise: only include domain knowledge and workflow steps the Agent would not already know

When the information is sufficient:
1. Show me a full SKILL.md preview first: start the file with properties metadata (name: and description: lines), and do not wrap them with ---
2. After I agree, call the skill_write tool to save it as .agents/skills/<name>/SKILL.md in the current workspace (do not use workspace file write tools, and do not write to AI/skills)
`

export const CREATE_SKILL_SLASH_COMMAND = 'create-skill'
export const CREATE_SKILL_MANAGER_ID = '__create-skill__'

export const BUILTIN_PROTECTED_SKILL_COMMANDS = [
  CREATE_SKILL_SLASH_COMMAND,
  DIARY_APPEND_SKILL_NAME,
  SUMMARY_WRITE_SKILL_NAME,
  SUMMARY_REPAIR_SKILL_NAME
] as const

const PROTECTED_SKILL_COMMAND_SET = new Set<string>(BUILTIN_PROTECTED_SKILL_COMMANDS)

export function isProtectedSkill(shortcut: {
  id?: string
  command?: string
  name?: string
}): boolean {
  const id = (shortcut.id || '').trim().replace(/^\//, '').toLowerCase()
  const command = (shortcut.command || shortcut.name || '').trim().replace(/^\//, '').toLowerCase()
  return (
    id === CREATE_SKILL_MANAGER_ID ||
    PROTECTED_SKILL_COMMAND_SET.has(id) ||
    PROTECTED_SKILL_COMMAND_SET.has(command)
  )
}

export function getCreateSkillGuidePrompt(
  _t?: FallbackTranslateFn,
  scope: CreateSkillGuideScope = 'software'
): string {
  if (scope === 'workspace') {
    return CREATE_SKILL_GUIDE_PROMPT_WORKSPACE
  }
  return CREATE_SKILL_GUIDE_PROMPT
}
