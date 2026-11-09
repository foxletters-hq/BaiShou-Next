import {
  buildSkillSendText,
  composerExtraPlain,
  CREATE_SKILL_SLASH_COMMAND,
  getShortcutCommand,
  type PromptFileRef,
  type PromptShortcut
} from '@baishou/shared'
import type { MockChatAttachment } from '@baishou/shared'
import type { ComposerSendMeta, ComposerSendSkillRef } from '../../shared/composer-draft'

export function isSkillShortcut(shortcut: PromptShortcut): boolean {
  return shortcut.source === 'software' || shortcut.source === 'workspace'
}

export function syncSkillRefsWithShortcuts(
  skillRefs: ComposerSendSkillRef[],
  localizedShortcuts?: PromptShortcut[]
): ComposerSendSkillRef[] {
  if (!skillRefs.length || !localizedShortcuts?.length) return skillRefs
  const contentByCommand = new Map<string, string>()
  for (const item of localizedShortcuts) {
    const cmd = getShortcutCommand(item).trim().replace(/^\/+/, '').toLowerCase()
    if (cmd) contentByCommand.set(cmd, item.content ?? '')
  }
  let changed = false
  const next = skillRefs.map((item) => {
    const cmd = item.command.trim().replace(/^\/+/, '').toLowerCase()
    if (!cmd || cmd === CREATE_SKILL_SLASH_COMMAND) return item
    const latestContent = contentByCommand.get(cmd)
    if (typeof latestContent === 'string' && latestContent !== item.content) {
      changed = true
      return { ...item, content: latestContent }
    }
    return item
  })
  return changed ? next : skillRefs
}

export function normalizeRestoredSkillRefs(
  skillRefs: Array<{ command?: unknown; content?: unknown }>
): ComposerSendSkillRef[] {
  return skillRefs
    .map((item) => ({
      command: String(item.command ?? '')
        .trim()
        .replace(/^\//, ''),
      content: typeof item.content === 'string' ? item.content : ''
    }))
    .filter((item) => Boolean(item.command))
}

export function fileRefsFromAttachments(attachments: MockChatAttachment[]): PromptFileRef[] {
  return attachments
    .filter((item) => !item.isImage)
    .map((item) => ({
      relativePath: item.relativePath || item.fileName,
      origin: item.origin ?? 'mention',
      isDirectory: item.isDirectory,
      selection: item.selection,
      comment: item.comment
    }))
    .filter((item) => item.relativePath.trim().length > 0)
}

function composerDisplayText(text: string, skillRefs: ComposerSendSkillRef[]): string {
  const extra = composerExtraPlain(text, skillRefs, [])
  const cites = skillRefs
    .map((item) => `/${item.command.replace(/^\//, '')}`)
    .filter((item) => item.length > 1)
    .join(' ')
  return [cites, extra].filter(Boolean).join(' ').trim()
}

export function buildNativeComposerSend(input: {
  text: string
  skillRefs: ComposerSendSkillRef[]
  attachments: MockChatAttachment[]
}): { modelText: string; meta?: ComposerSendMeta } {
  const fileRefs = fileRefsFromAttachments(input.attachments)
  const extra = composerExtraPlain(input.text, input.skillRefs, fileRefs)
  const modelText = buildSkillSendText(input.skillRefs, extra) || extra
  if (input.skillRefs.length === 0 && fileRefs.length === 0) {
    return { modelText: input.text.trim() }
  }
  return {
    modelText: modelText.trim() || input.text.trim(),
    meta: {
      displayText: composerDisplayText(input.text, input.skillRefs) || modelText.trim(),
      skillRefs: input.skillRefs.length ? input.skillRefs : undefined,
      fileRefs: fileRefs.length ? fileRefs : undefined
    }
  }
}
