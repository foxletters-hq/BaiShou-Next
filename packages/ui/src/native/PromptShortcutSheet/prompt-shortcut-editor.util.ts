import type { PromptShortcut } from '@baishou/shared'

/** 编辑页草稿：斜杠名来自 command，说明来自 description（旧数据 name 曾被当作斜杠名） */
export function resolveShortcutEditorDraft(item: PromptShortcut): {
  command: string
  description: string
  content: string
} {
  const command = (item.command || '').trim()
  const description = (item.description || '').trim()
  const name = (item.name || '').trim()
  const content = item.content || ''

  if (command) {
    const distinctName = name && name.toLowerCase() !== command.toLowerCase() ? name : ''
    return {
      command,
      description: description || distinctName,
      content
    }
  }

  return {
    command: name,
    description: description && description !== name ? description : '',
    content
  }
}

export function buildShortcutEditorPayload(
  editingItem: PromptShortcut,
  draft: { command: string; description: string; content: string },
  fallbackName: string
): PromptShortcut {
  const command = draft.command.trim()
  const description = draft.description.trim()
  const content = draft.content.trim()
  const name = description || command || fallbackName

  return {
    ...editingItem,
    command: command || name,
    description,
    name,
    tag: description || name,
    content
  }
}
