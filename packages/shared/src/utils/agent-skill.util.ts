import type { AgentSkill } from '../types/agent-skill.types'
import type { PromptShortcut } from '../types/prompt-shortcut.types'

const SKILL_NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

export function isValidSkillName(name: string): boolean {
  return SKILL_NAME_RE.test(name) && name.length >= 1 && name.length <= 64
}

/** 将展示名 / 旧 command 转为合法 skill name */
export function slugifySkillName(raw: string): string {
  const lowered = raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  if (lowered && isValidSkillName(lowered)) return lowered
  const fallback = `skill-${Date.now().toString(36)}`
  return isValidSkillName(fallback) ? fallback : 'skill'
}

export function serializeSkillMarkdown(skill: {
  name: string
  description: string
  content: string
}): string {
  const description = skill.description.trim() || skill.name
  const body = skill.content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  return `---\nname: ${skill.name}\ndescription: ${escapeYamlScalar(description)}\n---\n\n${body.trimEnd()}\n`
}

function escapeYamlScalar(value: string): string {
  if (/[:#{}[\],&*?|>!%@`]/.test(value) || value.includes('\n') || value.includes('"')) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  return value
}

export function parseSkillMarkdown(
  markdown: string,
  location: string
): AgentSkill | null {
  const text = markdown.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) return null
  const front = match[1] || ''
  const content = (match[2] || '').trim()
  const name = readFrontmatterField(front, 'name')
  const description = readFrontmatterField(front, 'description') || name || ''
  if (!name || !isValidSkillName(name)) return null
  return { name, description, content, location }
}

function readFrontmatterField(front: string, key: string): string {
  const re = new RegExp(`^${key}:\\s*(.*)$`, 'im')
  const m = front.match(re)
  if (!m) return ''
  let value = (m[1] || '').trim()
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1)
  }
  return value
}

/** Skill → 输入框 `/` 与管理 UI 复用的 PromptShortcut 形态 */
export function skillToPromptShortcut(skill: AgentSkill): PromptShortcut {
  return {
    id: skill.name,
    name: skill.description || skill.name,
    command: skill.name,
    description: skill.description,
    content: skill.content,
    tag: skill.description || skill.name
  }
}

export function promptShortcutToSkillInput(shortcut: PromptShortcut): {
  name: string
  description: string
  content: string
} {
  const name = slugifySkillName(
    shortcut.command?.trim() || shortcut.name?.trim() || shortcut.id || 'skill'
  )
  return {
    name,
    description: (shortcut.description || shortcut.name || shortcut.tag || name).trim(),
    content: shortcut.content || ''
  }
}

export const DEFAULT_AGENT_SKILLS: Array<{
  name: string
  description: string
  content: string
}> = [
  {
    name: 'translate',
    description: '翻译',
    content: '请把下面这段话信达雅地翻译为中文（含专业术语解释）：\n\n'
  },
  {
    name: 'summarize',
    description: '总结',
    content: '请总结以下内容背后的核心要义：\n\n'
  }
]
