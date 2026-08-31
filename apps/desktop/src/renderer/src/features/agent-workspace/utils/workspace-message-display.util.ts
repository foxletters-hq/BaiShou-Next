import type { AgentPart, MockChatAttachment } from '@baishou/shared'
import {
  buildSkillSendText,
  composerExtraPlain,
  mapAttachmentsFromParts,
  normalizePartData
} from '@baishou/shared'
import type { WorkspaceChatMessage } from '../hooks/useWorkspaceChatMessages'

export function normalizeWorkspaceSendAttachments(
  attachments?: unknown[]
): unknown[] | undefined {
  return Array.isArray(attachments) && attachments.length > 0 ? attachments : undefined
}

export function hasWorkspaceComposerPayload(params: {
  text: string
  attachments?: unknown[]
  skillRefs?: unknown[]
}): boolean {
  return Boolean(
    params.text.trim() ||
      normalizeWorkspaceSendAttachments(params.attachments) ||
      (Array.isArray(params.skillRefs) && params.skillRefs.length > 0)
  )
}

export function getWorkspaceUserAttachments(
  message: WorkspaceChatMessage
): MockChatAttachment[] {
  if (message.attachments?.length) return message.attachments
  return mapAttachmentsFromParts(message.parts) ?? []
}

export function getWorkspaceUserText(message: WorkspaceChatMessage): string {
  if (message.content?.trim()) return message.content
  return extractTextFromParts(message.parts, false)
}

export function getWorkspaceUserSkillRefs(
  message: WorkspaceChatMessage
): Array<{ command: string; content: string }> | undefined {
  if (message.skillRefs?.length) return message.skillRefs
  if (!message.parts?.length) return undefined
  for (const part of message.parts) {
    if (part.type !== 'text') continue
    const refs = part.data?.skillRefs
    if (Array.isArray(refs) && refs.length > 0) {
      return refs
        .map((ref: { command?: string; content?: string }) => ({
          command: String(ref?.command ?? '')
            .trim()
            .replace(/^\//, ''),
          content: typeof ref?.content === 'string' ? ref.content : ''
        }))
        .filter((ref: { command: string }) => Boolean(ref.command))
    }
  }
  return undefined
}

/** 与 InputBar 一致：skill 正文 + 用户 plain，供 LLM turn 使用 */
export function buildWorkspaceModelText(
  plainText: string,
  skillRefs?: Array<{ command: string; content: string }>
): string {
  const trimmedPlain = plainText.trim()
  if (!skillRefs?.length) return trimmedPlain
  return buildSkillSendText(skillRefs, composerExtraPlain(trimmedPlain, skillRefs))
}

export function getWorkspaceAssistantText(message: WorkspaceChatMessage): string {
  if (message.content?.trim()) return message.content
  return extractTextFromParts(message.parts, false)
}

export function getWorkspaceAssistantReasoning(message: WorkspaceChatMessage): string {
  if (message.reasoning?.trim()) return message.reasoning
  return extractTextFromParts(message.parts, true)
}

function extractTextFromParts(parts: AgentPart[] | undefined, reasoningOnly: boolean): string {
  if (!parts?.length) return ''
  return parts
    .filter((part) => part.type === 'text')
    .filter((part) => Boolean(normalizePartData(part.data).isReasoning) === reasoningOnly)
    .map((part) => {
      const data = normalizePartData(part.data)
      const display =
        typeof data.displayText === 'string' && data.displayText.trim() ? data.displayText : null
      return String(display ?? data.text ?? '')
    })
    .join('\n')
    .trim()
}
