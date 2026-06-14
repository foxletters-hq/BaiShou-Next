import { shouldWrapRoleForModel, type ModelMetadataRole } from './constants'
import { wrapMessageBodyForModel } from './formatter'

export type ModelMetadataTextPart = { type: string; text?: string; [key: string]: unknown }

export type ModelMetadataContent = string | ModelMetadataTextPart[]

export interface ToolResultTextOutput {
  type: 'tool-result'
  toolCallId: string
  toolName: string
  output: { type?: string; value?: unknown; [key: string]: unknown }
  [key: string]: unknown
}

function wrapIfRole(body: string, role: string, createdAt?: Date | number | null): string {
  if (!shouldWrapRoleForModel(role)) return body
  return wrapMessageBodyForModel(body, createdAt)
}

/** 为单条消息的文本正文注入元数据（user / system / assistant 纯文本） */
export function injectModelMetadata(
  content: ModelMetadataContent,
  role: ModelMetadataRole | string,
  createdAt?: Date | number | null
): ModelMetadataContent {
  if (!shouldWrapRoleForModel(role)) {
    return content
  }

  if (typeof content === 'string') {
    return wrapMessageBodyForModel(content, createdAt)
  }

  if (!Array.isArray(content) || content.length === 0) {
    return [{ type: 'text', text: wrapMessageBodyForModel('', createdAt) }]
  }

  const copy = content.map((part) => ({ ...part }))
  const firstTextIdx = copy.findIndex((p) => p.type === 'text' && typeof p.text === 'string')
  if (firstTextIdx >= 0) {
    const part = copy[firstTextIdx]!
    copy[firstTextIdx] = {
      ...part,
      text: wrapMessageBodyForModel(part.text ?? '', createdAt)
    }
  } else {
    copy.unshift({ type: 'text', text: wrapMessageBodyForModel('', createdAt) })
  }
  return copy
}

/**
 * assistant 多 part：仅包裹首个可见 text（跳过 reasoning）；tool-call 保持原样。
 */
export function injectModelMetadataIntoAssistantParts(
  parts: ModelMetadataTextPart[],
  createdAt?: Date | number | null
): ModelMetadataTextPart[] {
  const copy = parts.map((p) => ({ ...p }))
  const firstVisibleTextIdx = copy.findIndex((p) => p.type === 'text' && typeof p.text === 'string')
  if (firstVisibleTextIdx >= 0) {
    const part = copy[firstVisibleTextIdx]!
    copy[firstVisibleTextIdx] = {
      ...part,
      text: wrapIfRole(part.text ?? '', 'assistant', createdAt)
    }
    return copy
  }
  if (shouldWrapRoleForModel('assistant')) {
    copy.unshift({ type: 'text', text: wrapMessageBodyForModel('', createdAt) })
  }
  return copy
}

/** tool-result 的首个 text output 注入元数据 */
export function injectModelMetadataIntoToolResults<T extends ToolResultTextOutput>(
  parts: T[],
  createdAt?: Date | number | null
): T[] {
  if (!shouldWrapRoleForModel('tool') || parts.length === 0) return parts

  let stamped = false
  return parts.map((part) => {
    if (stamped) return part
    const output = part.output
    if (output?.type === 'text' && typeof output.value === 'string') {
      stamped = true
      return {
        ...part,
        output: {
          ...output,
          value: wrapMessageBodyForModel(output.value, createdAt)
        }
      }
    }
    return part
  })
}
