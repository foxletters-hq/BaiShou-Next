import {
  buildSkillSendText,
  composerExtraPlain,
  type PromptFileRef,
  type PromptShortcut
} from '@baishou/shared'
import type { MockChatAttachment } from '@baishou/shared'
import type { ComposerSendMeta, ComposerSendSkillRef } from '../../shared/composer-draft'

export function isSkillShortcut(shortcut: PromptShortcut): boolean {
  return shortcut.source === 'software' || shortcut.source === 'workspace'
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
      displayText: input.text.trim() || modelText.trim(),
      skillRefs: input.skillRefs.length ? input.skillRefs : undefined,
      fileRefs: fileRefs.length ? fileRefs : undefined
    }
  }
}
