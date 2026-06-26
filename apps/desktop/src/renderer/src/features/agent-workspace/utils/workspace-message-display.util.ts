import type { AgentPart } from '@baishou/shared'
import type { WorkspaceChatMessage } from '../hooks/useWorkspaceChatMessages'

export function getWorkspaceUserText(message: WorkspaceChatMessage): string {
  if (message.content?.trim()) return message.content
  return extractTextFromParts(message.parts, false)
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
    .filter((part) => Boolean(part.data?.isReasoning) === reasoningOnly)
    .map((part) => String(part.data?.text ?? part.data ?? ''))
    .join('\n')
    .trim()
}
