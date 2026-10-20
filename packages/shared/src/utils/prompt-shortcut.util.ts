import type { TFunction } from 'i18next'
import {
  DIARY_APPEND_SKILL_DESCRIPTION,
  DIARY_APPEND_SKILL_NAME,
  LEGACY_DIARY_APPEND_SKILL_DESCRIPTION,
  LEGACY_SUMMARY_WRITE_SKILL_DESCRIPTION,
  SUMMARY_REPAIR_SKILL_DESCRIPTION,
  SUMMARY_REPAIR_SKILL_NAME,
  SUMMARY_WRITE_SKILL_DESCRIPTION,
  SUMMARY_WRITE_SKILL_NAME
} from '../constants/builtin-skills'
import type { PromptShortcut } from '../types/prompt-shortcut.types'
import {
  BUILTIN_PROTECTED_SKILL_COMMANDS,
  CREATE_SKILL_MANAGER_ID,
  CREATE_SKILL_SLASH_COMMAND,
  isProtectedSkill
} from './create-skill-guide.util'

export type ShortcutLike = PromptShortcut & { command?: string; tag?: string }

/** 用于匹配与展示的快捷短语（不含前导 `/`） */
export function getShortcutCommand(shortcut: ShortcutLike): string {
  if (shortcut.command?.trim()) return shortcut.command.trim()
  if (shortcut.id.startsWith('default-')) {
    return shortcut.id.replace('default-', '')
  }
  if (shortcut.tag?.trim()) return shortcut.tag.trim()
  if (shortcut.name?.trim()) return shortcut.name.trim()
  return shortcut.id
}

export function getShortcutQuery(text: string): string {
  return text.startsWith('/') ? text.slice(1) : ''
}

export function isShortcutSlashInput(text: string): boolean {
  return text.startsWith('/')
}

/**
 * 仅在输入框原本为空时输入 `/` 才进入快捷指令会话。
 * 若已有正文再输入 `/`（如 `hello/`），不进入快捷指令模式。
 */
export function shouldStartShortcutSession(prevText: string, nextText: string): boolean {
  return prevText === '' && nextText.startsWith('/')
}

export function filterShortcutsByQuery(shortcuts: ShortcutLike[], query: string): ShortcutLike[] {
  const q = query.trim().toLowerCase()
  if (!q) return shortcuts
  return shortcuts.filter((shortcut) => {
    const command = getShortcutCommand(shortcut).toLowerCase()
    const name = (shortcut.name || shortcut.tag || '').toLowerCase()
    const description = (shortcut.description || '').toLowerCase()
    return command.includes(q) || name.includes(q) || description.includes(q)
  })
}

export function formatShortcutInsertText(content: string): string {
  const trimmed = content.trimEnd()
  return trimmed.endsWith('\n') ? trimmed : `${trimmed}\n`
}

/** 将快捷指令正文追加到已有输入；空输入时等同于 formatShortcutInsertText */
export function appendShortcutInsertText(existing: string, content: string): string {
  const formatted = formatShortcutInsertText(content)
  if (!existing) return formatted
  return `${existing}\n${formatted}`
}

/** 按快捷短语置顶官方内置 Skill（create-skill、diary-append、summary-write、summary-repair） */
export function sortBuiltinShortcutsFirst<T extends ShortcutLike>(list: readonly T[]): T[] {
  const rankMap = new Map<string, number>(
    BUILTIN_PROTECTED_SKILL_COMMANDS.map((cmd, idx) => [cmd, idx])
  )
  const builtins: Array<{ item: T; rank: number }> = []
  const others: T[] = []

  for (const item of list) {
    if (item.source !== 'workspace' && isProtectedSkill(item)) {
      const cmd = getShortcutCommand(item).toLowerCase()
      const rank = rankMap.get(cmd) ?? BUILTIN_PROTECTED_SKILL_COMMANDS.length
      builtins.push({ item, rank })
    } else {
      others.push(item)
    }
  }

  builtins.sort((a, b) => a.rank - b.rank)
  return [...builtins.map((entry) => entry.item), ...others]
}

/** 按 id 与快捷短语去重，保留列表中较早出现的项，并将官方内置 Skill 排在最前 */
export function dedupePromptShortcuts(list: ShortcutLike[]): PromptShortcut[] {
  const seenIds = new Set<string>()
  const seenCommands = new Set<string>()
  const result: PromptShortcut[] = []

  for (const item of list) {
    if (seenIds.has(item.id)) continue
    const commandKey = getShortcutCommand(item).toLowerCase()
    if (seenCommands.has(commandKey)) continue
    seenIds.add(item.id)
    seenCommands.add(commandKey)
    result.push(item)
  }

  return sortBuiltinShortcutsFirst(result)
}

export function findShortcutCommandConflict(
  list: ShortcutLike[],
  shortcut: ShortcutLike,
  excludeId?: string
): PromptShortcut | undefined {
  const commandKey = getShortcutCommand(shortcut).toLowerCase()
  return list.find(
    (item) => item.id !== excludeId && getShortcutCommand(item).toLowerCase() === commandKey
  )
}

export type LocalizedShortcutLabels = {
  translateName: string
  translateContent: string
  summarizeName: string
  summarizeContent: string
  createSkillName?: string
  createSkillDescription?: string
  diaryAppendName?: string
  diaryAppendDescription?: string
  summaryWriteName?: string
  summaryWriteDescription?: string
  summaryRepairName?: string
  summaryRepairDescription?: string
}

export function getDefaultShortcutLabelsFromT(t: TFunction): LocalizedShortcutLabels {
  return {
    translateName: t('agent.tools.shortcuts.translate_name', '翻译'),
    translateContent: t(
      'agent.tools.shortcuts.translate_content',
      '请把下面这段话信达雅地翻译为中文（含专业术语解释）：\n\n'
    ),
    summarizeName: t('agent.tools.shortcuts.summarize_name', '总结'),
    summarizeContent: t(
      'agent.tools.shortcuts.summarize_content',
      '请总结以下内容背后的核心要义：\n\n'
    ),
    createSkillName: t('shortcut.builtin.create_skill_name', '创建技能'),
    createSkillDescription: t(
      'shortcut.builtin.create_skill_desc',
      '通过问答引导创建可复用的 SKILL.md 工作流技能。'
    ),
    diaryAppendName: t('shortcut.builtin.diary_append_name', '补充日记'),
    diaryAppendDescription: t(
      'shortcut.builtin.diary_append_desc',
      '将今天或近期与 AI 对话中的事件补充进个人日记（只增不改、不重复、按事件时间排序）。'
    ),
    summaryWriteName: t('shortcut.builtin.summary_write_name', '生成周期总结'),
    summaryWriteDescription: t(
      'shortcut.builtin.summary_write_desc',
      '检测缺失的周记、月报、季报与年度总结，经确认后读取素材并撰写保存。'
    ),
    summaryRepairName: t('shortcut.builtin.summary_repair_name', '校对与修复总结'),
    summaryRepairDescription: t(
      'shortcut.builtin.summary_repair_desc',
      '结合日记与记忆检索核对并修正已有周记、月报、季报与年度总结中的事实或角色错误。'
    )
  }
}

export function isDefaultBuiltinSkillDescription(
  command: string,
  description: string | undefined
): boolean {
  const desc = (description || '').trim()
  const cmd = command.trim().toLowerCase()
  if (!desc || desc.toLowerCase() === cmd) return true
  if (cmd === DIARY_APPEND_SKILL_NAME) {
    return desc === DIARY_APPEND_SKILL_DESCRIPTION || desc === LEGACY_DIARY_APPEND_SKILL_DESCRIPTION
  }
  if (cmd === SUMMARY_WRITE_SKILL_NAME) {
    return (
      desc === SUMMARY_WRITE_SKILL_DESCRIPTION || desc === LEGACY_SUMMARY_WRITE_SKILL_DESCRIPTION
    )
  }
  if (cmd === SUMMARY_REPAIR_SKILL_NAME) {
    return desc === SUMMARY_REPAIR_SKILL_DESCRIPTION
  }
  return false
}

/** 将内置默认快捷指令与官方内置技能的展示名称、描述替换为当前语言 */
export function localizePromptShortcut<T extends ShortcutLike>(
  shortcut: T,
  labels: LocalizedShortcutLabels
): T {
  const command = getShortcutCommand(shortcut).toLowerCase()
  const isTranslate =
    shortcut.id === 'default-translate' || command === 'translate' || shortcut.id === 'translate'
  const isSummarize =
    shortcut.id === 'default-summarize' || command === 'summarize' || shortcut.id === 'summarize'

  if (isTranslate) {
    return {
      ...shortcut,
      name: labels.translateName,
      content: labels.translateContent,
      command: shortcut.command || 'translate'
    }
  }
  if (isSummarize) {
    return {
      ...shortcut,
      name: labels.summarizeName,
      content: labels.summarizeContent,
      command: shortcut.command || 'summarize'
    }
  }

  if (shortcut.source !== 'workspace') {
    const isCreateSkill =
      command === CREATE_SKILL_SLASH_COMMAND ||
      shortcut.id === CREATE_SKILL_MANAGER_ID ||
      shortcut.id === CREATE_SKILL_SLASH_COMMAND
    if (
      isCreateSkill &&
      (labels.createSkillName || labels.createSkillDescription) &&
      isDefaultBuiltinSkillDescription(CREATE_SKILL_SLASH_COMMAND, shortcut.description)
    ) {
      return {
        ...shortcut,
        name: labels.createSkillName || shortcut.name,
        description: labels.createSkillDescription || shortcut.description,
        tag: labels.createSkillName || shortcut.tag,
        command: shortcut.command || CREATE_SKILL_SLASH_COMMAND
      }
    }

    const isDiaryAppend =
      command === DIARY_APPEND_SKILL_NAME || shortcut.id === DIARY_APPEND_SKILL_NAME
    if (
      isDiaryAppend &&
      (labels.diaryAppendName || labels.diaryAppendDescription) &&
      isDefaultBuiltinSkillDescription(DIARY_APPEND_SKILL_NAME, shortcut.description)
    ) {
      return {
        ...shortcut,
        name: labels.diaryAppendName || shortcut.name,
        description: labels.diaryAppendDescription || shortcut.description,
        tag: labels.diaryAppendName || shortcut.tag,
        command: shortcut.command || DIARY_APPEND_SKILL_NAME
      }
    }

    const isSummaryWrite =
      command === SUMMARY_WRITE_SKILL_NAME || shortcut.id === SUMMARY_WRITE_SKILL_NAME
    if (
      isSummaryWrite &&
      (labels.summaryWriteName || labels.summaryWriteDescription) &&
      isDefaultBuiltinSkillDescription(SUMMARY_WRITE_SKILL_NAME, shortcut.description)
    ) {
      return {
        ...shortcut,
        name: labels.summaryWriteName || shortcut.name,
        description: labels.summaryWriteDescription || shortcut.description,
        tag: labels.summaryWriteName || shortcut.tag,
        command: shortcut.command || SUMMARY_WRITE_SKILL_NAME
      }
    }

    const isSummaryRepair =
      command === SUMMARY_REPAIR_SKILL_NAME || shortcut.id === SUMMARY_REPAIR_SKILL_NAME
    if (
      isSummaryRepair &&
      (labels.summaryRepairName || labels.summaryRepairDescription) &&
      isDefaultBuiltinSkillDescription(SUMMARY_REPAIR_SKILL_NAME, shortcut.description)
    ) {
      return {
        ...shortcut,
        name: labels.summaryRepairName || shortcut.name,
        description: labels.summaryRepairDescription || shortcut.description,
        tag: labels.summaryRepairName || shortcut.tag,
        command: shortcut.command || SUMMARY_REPAIR_SKILL_NAME
      }
    }
  }

  return shortcut
}

export function localizePromptShortcuts<T extends ShortcutLike>(
  shortcuts: T[],
  labels: LocalizedShortcutLabels
): T[] {
  return shortcuts.map((item) => localizePromptShortcut(item, labels))
}

/** 将官方内置 AgentSkill 的展示描述替换为当前语言（保留英文 SKILL.md 正文不变） */
export function localizeAgentSkill<
  T extends { name: string; description?: string; source?: string }
>(skill: T, labels: LocalizedShortcutLabels): T {
  if (skill.source === 'workspace') return skill
  const cmd = skill.name.trim().toLowerCase()
  if (
    cmd === CREATE_SKILL_SLASH_COMMAND &&
    labels.createSkillDescription &&
    isDefaultBuiltinSkillDescription(CREATE_SKILL_SLASH_COMMAND, skill.description)
  ) {
    return { ...skill, description: labels.createSkillDescription }
  }
  if (
    cmd === DIARY_APPEND_SKILL_NAME &&
    labels.diaryAppendDescription &&
    isDefaultBuiltinSkillDescription(DIARY_APPEND_SKILL_NAME, skill.description)
  ) {
    return { ...skill, description: labels.diaryAppendDescription }
  }
  if (
    cmd === SUMMARY_WRITE_SKILL_NAME &&
    labels.summaryWriteDescription &&
    isDefaultBuiltinSkillDescription(SUMMARY_WRITE_SKILL_NAME, skill.description)
  ) {
    return { ...skill, description: labels.summaryWriteDescription }
  }
  if (
    cmd === SUMMARY_REPAIR_SKILL_NAME &&
    labels.summaryRepairDescription &&
    isDefaultBuiltinSkillDescription(SUMMARY_REPAIR_SKILL_NAME, skill.description)
  ) {
    return { ...skill, description: labels.summaryRepairDescription }
  }
  return skill
}

export function localizeAgentSkills<
  T extends { name: string; description?: string; source?: string }
>(skills: T[], labels: LocalizedShortcutLabels): T[] {
  return skills.map((item) => localizeAgentSkill(item, labels))
}
