import type { ModelMessage } from 'ai'
import {
  buildCompressionPreviousSummaryBlock,
  shouldWrapRoleForModel,
  wrapMessageBodyForModel
} from '@baishou/shared'
import type { MessageWithParts } from './message.adapter'
import { TOOL_OUTPUT_MAX_CHARS } from './compression.constants'
import { estimateTextTokens } from './call-chain-view-model.builder'

const COMPRESSION_ROLE_LABELS: Record<string, string> = {
  user: '用户',
  assistant: '助手',
  tool: '工具',
  system: '系统'
}

export function extractMessageText(msg: MessageWithParts): string {
  if (!msg.parts?.length) return ''
  const chunks: string[] = []
  for (const p of msg.parts) {
    if (p.type === 'text') {
      const data = p.data as { text?: string } | string | undefined
      const text = typeof data === 'string' ? data : data?.text
      if (text) chunks.push(text)
    } else if (p.type === 'tool') {
      const data = p.data as {
        result?: unknown
        arguments?: unknown
        name?: string
      } | null
      if (!data) continue
      if (data.result !== undefined) {
        chunks.push(typeof data.result === 'string' ? data.result : JSON.stringify(data.result))
      } else if (data.arguments !== undefined) {
        chunks.push(JSON.stringify(data.arguments))
      }
    } else if (p.type === 'context_snapshot') {
      const snaps = (p.data as { snapshots?: Array<{ title?: string; content?: string }> })
        ?.snapshots
      if (Array.isArray(snaps)) {
        for (const s of snaps) {
          chunks.push(`${s.title ?? 'Context'}\n${s.content ?? ''}`)
        }
      }
    } else if (p.type === 'image') {
      const att = p.data as { name?: string; fileName?: string } | null | undefined
      chunks.push(`[图片附件 ${att?.name || att?.fileName || ''}]`)
    } else if (p.type === 'attachment') {
      const att = p.data as
        | { textContent?: string; name?: string; fileName?: string }
        | null
        | undefined
      if (att?.textContent) {
        chunks.push(`[附件 ${att.name || att.fileName || ''}]\n${att.textContent}`)
      }
    }
  }
  return chunks.join('\n')
}

function truncateForCompression(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars)}\n…[已截断]`
}

/** 压缩专用文本提取（tool 输出限长） */
export function extractMessageTextForCompression(msg: MessageWithParts): string {
  if (!msg.parts?.length) return ''
  const chunks: string[] = []
  for (const p of msg.parts) {
    if (p.type === 'text') {
      const data = p.data as { text?: string } | string | undefined
      const text = typeof data === 'string' ? data : data?.text
      if (text) chunks.push(text)
    } else if (p.type === 'tool') {
      const data = p.data as { result?: unknown; arguments?: unknown } | null
      if (!data) continue
      if (data.result !== undefined) {
        const raw = typeof data.result === 'string' ? data.result : JSON.stringify(data.result)
        chunks.push(truncateForCompression(raw, TOOL_OUTPUT_MAX_CHARS))
      } else if (data.arguments !== undefined) {
        chunks.push(JSON.stringify(data.arguments))
      }
    } else if (p.type === 'context_snapshot') {
      const snaps = (p.data as { snapshots?: Array<{ title?: string; content?: string }> })
        ?.snapshots
      if (Array.isArray(snaps)) {
        for (const s of snaps) {
          chunks.push(`${s.title ?? 'Context'}\n${s.content ?? ''}`)
        }
      }
    } else if (p.type === 'image') {
      const att = p.data as { name?: string; fileName?: string } | null | undefined
      chunks.push(`[图片附件 ${att?.name || att?.fileName || ''}]`)
    } else if (p.type === 'attachment') {
      const att = p.data as
        | { textContent?: string; name?: string; fileName?: string }
        | null
        | undefined
      if (att?.textContent) {
        chunks.push(`[附件 ${att.name || att.fileName || ''}]\n${att.textContent}`)
      }
    }
  }
  return chunks.join('\n')
}

export function estimateMessagesTokens(
  messages: MessageWithParts[],
  forCompression = false
): number {
  return messages.reduce(
    (sum, m) =>
      sum +
      estimateTextTokens(
        forCompression ? extractMessageTextForCompression(m) : extractMessageText(m)
      ),
    0
  )
}

/**
 * 压缩摘要专用：将历史消息压平为纯文本 user/assistant 轮次。
 * 避免 thinking 模式 + tool-call 结构在压缩请求中触发 400。
 */
export function toFlatTextModelMessages(messages: MessageWithParts[]): ModelMessage[] {
  const result: ModelMessage[] = []
  for (const msg of messages) {
    if (msg.role !== 'user' && msg.role !== 'assistant' && msg.role !== 'tool') {
      continue
    }
    const text = extractMessageTextForCompression(msg).trim()
    if (!text) continue

    if (msg.role === 'tool') {
      result.push({ role: 'user', content: `[工具输出]\n${text}` })
      continue
    }
    result.push({ role: msg.role, content: text })
  }
  return result
}

/** 送入摘要模型前截断超长 tool part（不修改库内原文） */
export function cloneMessagesForCompressionModel(messages: MessageWithParts[]): MessageWithParts[] {
  return messages.map((msg) => {
    if (!msg.parts?.length) return msg
    const parts = msg.parts.map((p) => {
      if (p.type !== 'tool') return p
      const data = p.data as { result?: unknown; arguments?: unknown; name?: string }
      if (typeof data?.result === 'string' && data.result.length > TOOL_OUTPUT_MAX_CHARS) {
        return {
          ...p,
          data: {
            ...data,
            result: truncateForCompression(data.result, TOOL_OUTPUT_MAX_CHARS)
          }
        }
      }
      return p
    })
    return { ...msg, parts }
  })
}

/** 将待压缩消息格式化为带角色标记的原文，避免模型只看见助手尾句 */
export function formatMessagesAsCompressionTranscript(
  messages: MessageWithParts[],
  options?: { wrapMessageTime?: boolean }
): string {
  const wrapMessageTime = options?.wrapMessageTime !== false
  const blocks: string[] = []
  for (const msg of messages) {
    const text = extractMessageText(msg).trim()
    if (!text) continue
    const label = COMPRESSION_ROLE_LABELS[msg.role] ?? msg.role
    const bodyBlock =
      wrapMessageTime && shouldWrapRoleForModel(msg.role)
        ? wrapMessageBodyForModel(text, msg.createdAt)
        : text
    blocks.push(`【${label}】\n${bodyBlock}`)
  }
  return blocks.join('\n\n---\n\n')
}

/**
 * 构建送入压缩模型的单条 user 消息：<previous-summary> 在前，带角色标记的对话 transcript 在后。
 */
export function buildCompressionUserMessageContent(
  messages: MessageWithParts[],
  priorSummaryText?: string | null,
  options?: { wrapMessageTime?: boolean }
): string | null {
  const transcript = formatMessagesAsCompressionTranscript(
    cloneMessagesForCompressionModel(messages),
    options
  ).trim()
  if (!transcript) return null

  const previousSummaryBlock = buildCompressionPreviousSummaryBlock(
    priorSummaryText?.trim() || undefined
  )
  return previousSummaryBlock ? `${previousSummaryBlock}\n\n${transcript}` : transcript
}

export function hasUserContentInCompressionBatch(messages: MessageWithParts[]): boolean {
  return messages.some((m) => m.role === 'user' && extractMessageText(m).trim().length > 0)
}

export function hasEnoughMessagesForRecompress(messages: MessageWithParts[]): boolean {
  const withText = messages.filter((m) => extractMessageText(m).trim().length > 0)
  if (withText.length >= 2) return true
  return withText.some((m) => m.role === 'user')
}
