import { isWorkbenchTemplateSkillName, WRITER_SKILL_NAME } from '../constants/writer-skill'
import type { AgentSkill } from '../types/agent-skill.types'
import type { PromptShortcut } from '../types/prompt-shortcut.types'
import {
  CREATE_SKILL_GUIDE_PROMPT,
  CREATE_SKILL_SLASH_COMMAND
} from './create-skill-guide.util'

const SKILL_NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const SKILL_PROPERTY_LINE_RE = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/
const SKILL_YAML_HEADER_RE = /^---\n([\s\S]*?)\n---[ \t]*(?:\n([\s\S]*)|\s*$)/

export function isValidSkillName(name: string): boolean {
  return SKILL_NAME_RE.test(name) && name.length >= 1 && name.length <= 64
}

/** 路径是否为 SKILL.md（大小写不敏感） */
export function isSkillMarkdownPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase()
  return normalized.endsWith('/skill.md') || normalized === 'skill.md'
}

export type SkillMarkdownMeta = {
  kind: 'yaml' | 'properties'
  /** 元信息块结束偏移（不含正文；含末条 properties 行后的换行） */
  headerEnd: number
  fields: Record<string, string>
  content: string
}

function normalizeSkillMarkdown(markdown: string): string {
  return markdown.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
}

function unquoteSkillScalar(value: string): string {
  let next = value.trim()
  if (
    (next.startsWith('"') && next.endsWith('"')) ||
    (next.startsWith("'") && next.endsWith("'"))
  ) {
    next = next.slice(1, -1)
  }
  return next
}

function parseSkillFieldLines(block: string): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const line of block.split('\n')) {
    const match = line.match(SKILL_PROPERTY_LINE_RE)
    if (!match) continue
    fields[match[1]!] = unquoteSkillScalar(match[2] || '')
  }
  return fields
}

/**
 * 拆出 SKILL.md 顶部元信息。优先读旧版 `---` YAML；否则读文件开头连续的 `key: value` properties。
 * 不把 `---` 当作正文分割线。
 */
export function splitSkillMarkdownMeta(markdown: string): SkillMarkdownMeta | null {
  const text = normalizeSkillMarkdown(markdown)
  const yaml = text.match(SKILL_YAML_HEADER_RE)
  if (yaml) {
    const inner = yaml[1] || ''
    const headerCore = `---\n${inner}\n---`
    const after = text.slice(headerCore.length)
    const headerEnd = headerCore.length + (after.startsWith('\n') ? 1 : 0)
    return {
      kind: 'yaml',
      headerEnd,
      fields: parseSkillFieldLines(inner),
      content: (yaml[2] || '').trim()
    }
  }

  if (text.startsWith('---')) return null

  const lines = text.split('\n')
  let count = 0
  while (count < lines.length) {
    const line = lines[count]!
    if (line.trim() === '' || !SKILL_PROPERTY_LINE_RE.test(line)) break
    count += 1
  }
  if (count === 0) return null

  let headerEnd = 0
  for (let index = 0; index < count; index += 1) {
    headerEnd += lines[index]!.length
    if (index < lines.length - 1) headerEnd += 1
  }
  return {
    kind: 'properties',
    headerEnd,
    fields: parseSkillFieldLines(lines.slice(0, count).join('\n')),
    content: text.slice(headerEnd).replace(/^\n/, '').trim()
  }
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
  const body = normalizeSkillMarkdown(skill.content)
  return `name: ${skill.name}\ndescription: ${escapeYamlScalar(description)}\n\n${body.trimEnd()}\n`
}

function escapeYamlScalar(value: string): string {
  if (/[:#{}[\],&*?|>!%@`]/.test(value) || value.includes('\n') || value.includes('"')) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  return value
}

export function parseSkillMarkdown(
  markdown: string,
  location: string,
  options?: { fallbackName?: string }
): AgentSkill | null {
  const text = normalizeSkillMarkdown(markdown)
  const fallback =
    options?.fallbackName && isValidSkillName(options.fallbackName) ? options.fallbackName : ''
  const meta = splitSkillMarkdownMeta(text)
  if (!meta) {
    if (!fallback) return null
    const content = text.trim()
    if (!content) return null
    return { name: fallback, description: fallback, content, location }
  }
  const fieldName = meta.fields.name
  const name = fallback || (fieldName && isValidSkillName(fieldName) ? fieldName : '')
  if (!name) return null
  const description = meta.fields.description?.trim() || name
  return { name, description, content: meta.content, location }
}

/** Skill → 输入框 `/` 与管理 UI 复用的 PromptShortcut 形态 */
export function skillToPromptShortcut(skill: AgentSkill): PromptShortcut {
  const source = skill.source === 'workspace' ? 'workspace' : 'software'
  const name = skill.name
  return {
    id: source === 'workspace' ? `workspace:${name}` : name,
    name: skill.description || name,
    command: name,
    description: skill.description,
    content: skill.content,
    tag: skill.description || name,
    source
  }
}

export function mergeSkillCatalogEntries(
  software: Array<{ name: string; description?: string }>,
  workspace: Array<{ name: string; description?: string }>
): Array<{ name: string; description?: string }> {
  const map = new Map<string, { name: string; description?: string }>()
  for (const item of software) {
    if (!item.name) continue
    map.set(item.name, item)
  }
  for (const item of workspace) {
    if (!item.name) continue
    map.set(item.name, item)
  }
  return [...map.values()]
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
    name: CREATE_SKILL_SLASH_COMMAND,
    description: CREATE_SKILL_SLASH_COMMAND,
    content: CREATE_SKILL_GUIDE_PROMPT
  }
]

/** 曾随软件分发、现已退出官方技能列表的名称 */
export const RETIRED_OFFICIAL_SKILL_NAMES = ['translate', 'summarize'] as const

export function isRetiredOfficialSkillName(name: string): boolean {
  return (RETIRED_OFFICIAL_SKILL_NAMES as readonly string[]).includes(name)
}

/** 安装目录里不再作为日常官方技能列出：写作模板 + 已退役的总结/翻译 */
export function isHiddenBundledSoftwareSkill(skill: {
  name: string
  source?: string
}): boolean {
  if (skill.source === 'workspace' || skill.source === 'user') return false
  return isWorkbenchTemplateSkillName(skill.name) || isRetiredOfficialSkillName(skill.name)
}

/** 安装目录中保留、但不作为日常官方技能列出的名称（如写作模板） */
export const BUNDLED_RESERVED_SKILL_NAMES: readonly string[] = [
  ...DEFAULT_AGENT_SKILLS.map((skill) => skill.name),
  WRITER_SKILL_NAME
]

export function isOfficialAgentSkillName(name: string): boolean {
  return DEFAULT_AGENT_SKILLS.some((skill) => skill.name === name)
}

export function isBundledReservedSkillName(name: string): boolean {
  return BUNDLED_RESERVED_SKILL_NAMES.includes(name)
}

export type OfficialSkillRelocationAction = 'move' | 'remove-official'

export function listSkillNamesToRelocateFromOfficial(names: string[]): string[] {
  return names.filter((name) => isValidSkillName(name) && !isBundledReservedSkillName(name))
}

export function planOfficialSkillRelocations(
  bundledNames: string[],
  destExistingNames: ReadonlySet<string>
): Array<{ name: string; action: OfficialSkillRelocationAction }> {
  return listSkillNamesToRelocateFromOfficial(bundledNames).map((name) => ({
    name,
    action: destExistingNames.has(name) ? 'remove-official' : 'move'
  }))
}
