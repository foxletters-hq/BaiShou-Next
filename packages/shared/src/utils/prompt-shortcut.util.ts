import type { TFunction } from 'i18next'
import type { PromptShortcut } from '../types/prompt-shortcut.types'

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
    return command.includes(q) || name.includes(q)
  })
}

export function formatShortcutInsertText(content: string): string {
  const trimmed = content.trimEnd()
  return trimmed.endsWith('\n') ? trimmed : `${trimmed}\n`
}

/** 按 id 与快捷短语去重，保留列表中较早出现的项 */
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

  return result
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
    )
  }
}

/** 将内置默认快捷指令的名称与正文替换为当前语言 */
export function localizePromptShortcut<T extends ShortcutLike>(
  shortcut: T,
  labels: LocalizedShortcutLabels
): T {
  if (shortcut.id === 'default-translate') {
    return {
      ...shortcut,
      name: labels.translateName,
      content: labels.translateContent,
      command: shortcut.command || 'translate'
    }
  }
  if (shortcut.id === 'default-summarize') {
    return {
      ...shortcut,
      name: labels.summarizeName,
      content: labels.summarizeContent,
      command: shortcut.command || 'summarize'
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
