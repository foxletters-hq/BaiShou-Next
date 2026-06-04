import type { ModelMessage } from 'ai'
import type { MessageWithParts } from './message.adapter'

export interface DisplayContextMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  /** 调用链中的展示标签，如「系统提示词」「AI 输出」 */
  label?: string
}

export function formatToolInvocationCard(
  toolName: string,
  args: unknown,
  result?: unknown
): string {
  const argsStr = typeof args === 'string' ? args : JSON.stringify(args ?? {}, null, 2)
  const lines = [`### ${toolName}`, '', '```json', argsStr, '```']

  if (result !== undefined) {
    const resultStr = typeof result === 'string' ? result : JSON.stringify(result, null, 2)
    lines.push('', '### 结果', '', resultStr)
  }

  return lines.join('\n')
}

function extractToolResultValue(part: Record<string, unknown>): string {
  const output = part.output as { value?: unknown } | undefined
  const val = output?.value ?? part.result ?? ''
  return typeof val === 'string' ? val : JSON.stringify(val, null, 2)
}

function buildToolResultMap(toolMsg: ModelMessage | undefined): Map<string, string> {
  const map = new Map<string, string>()
  if (!toolMsg || toolMsg.role !== 'tool' || !Array.isArray(toolMsg.content)) {
    return map
  }

  for (const part of toolMsg.content as Record<string, unknown>[]) {
    if (part.type === 'tool-result' && typeof part.toolCallId === 'string') {
      map.set(part.toolCallId, extractToolResultValue(part))
    }
  }
  return map
}

function formatContentPart(part: Record<string, unknown>): string {
  switch (part.type) {
    case 'text':
      return String(part.text ?? '')
    case 'reasoning':
      return String(part.text ?? '')
    case 'tool-call': {
      const args = part.args ?? part.input ?? {}
      const argsStr = typeof args === 'string' ? args : JSON.stringify(args, null, 2)
      return `[工具调用: ${String(part.toolName ?? 'unknown')}]\n${argsStr}`
    }
    case 'tool-result': {
      return extractToolResultValue(part)
    }
    case 'image':
      return '[图片附件]'
    case 'file':
      return `[文件附件: ${String(part.mediaType ?? 'unknown')}]`
    default:
      return `[${String(part.type ?? 'unknown')}]`
  }
}

function formatModelMessageContent(msg: ModelMessage): string {
  if (typeof msg.content === 'string') {
    return msg.content
  }
  if (!Array.isArray(msg.content)) {
    return ''
  }
  return msg.content
    .map((part) => formatContentPart(part as Record<string, unknown>))
    .filter((s) => s.length > 0)
    .join('\n\n')
}

function orderAssistantDisplayItems(items: DisplayContextMessage[]): DisplayContextMessage[] {
  const thinking = items.filter((i) => i.label === 'AI 思考')
  const output = items.filter((i) => i.label === 'AI 输出')
  const tools = items.filter((i) => i.label === '工具调用')
  const other = items.filter(
    (i) => i.label !== 'AI 思考' && i.label !== 'AI 输出' && i.label !== '工具调用'
  )
  return [...thinking, ...tools, ...output, ...other]
}

function formatAssistantParts(msg: ModelMessage, toolMsg?: ModelMessage): DisplayContextMessage[] {
  if (typeof msg.content === 'string') {
    return [{ role: 'assistant', content: msg.content, label: 'AI 输出' }]
  }
  if (!Array.isArray(msg.content)) {
    return []
  }

  const items: DisplayContextMessage[] = []
  const resultMap = buildToolResultMap(toolMsg)
  let reasoningBuffer = ''
  let textBuffer = ''

  const flushText = () => {
    if (!textBuffer.trim()) return
    items.push({ role: 'assistant', content: textBuffer.trim(), label: 'AI 输出' })
    textBuffer = ''
  }

  const flushReasoning = () => {
    if (!reasoningBuffer.trim()) return
    items.push({ role: 'assistant', content: reasoningBuffer.trim(), label: 'AI 思考' })
    reasoningBuffer = ''
  }

  for (const raw of msg.content as Record<string, unknown>[]) {
    if (raw.type === 'reasoning') {
      flushText()
      reasoningBuffer += (reasoningBuffer ? '\n\n' : '') + String(raw.text ?? '')
      continue
    }
    if (raw.type === 'text') {
      flushReasoning()
      textBuffer += (textBuffer ? '\n\n' : '') + String(raw.text ?? '')
      continue
    }
    if (raw.type === 'tool-call') {
      flushReasoning()
      flushText()
      const callId = String(raw.toolCallId ?? '')
      const toolName = String(raw.toolName ?? 'unknown')
      const args = raw.args ?? raw.input ?? {}
      items.push({
        role: 'assistant',
        label: '工具调用',
        content: formatToolInvocationCard(toolName, args, resultMap.get(callId))
      })
    }
  }

  flushReasoning()
  flushText()
  return orderAssistantDisplayItems(items)
}

export function formatModelMessagesForDisplay(messages: ModelMessage[]): DisplayContextMessage[] {
  const result: DisplayContextMessage[] = []

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!

    if (msg.role === 'tool') {
      continue
    }

    if (msg.role === 'assistant') {
      const next = messages[i + 1]
      const toolMsg = next?.role === 'tool' ? next : undefined
      const hasToolCall =
        Array.isArray(msg.content) &&
        (msg.content as Record<string, unknown>[]).some((p) => p.type === 'tool-call')

      if (hasToolCall || (Array.isArray(msg.content) && msg.content.length > 1)) {
        result.push(...formatAssistantParts(msg, toolMsg))
        if (toolMsg) i++
        continue
      }
    }

    const content = formatModelMessageContent(msg)
    if (!content && msg.role !== 'system') continue

    let label: string | undefined
    if (msg.role === 'system') {
      label = content.includes('[往期对话摘要压缩]') ? undefined : '系统'
    }

    result.push({
      role: msg.role as DisplayContextMessage['role'],
      content,
      label
    })
  }

  return result
}

export function formatMessageWithPartsForChain(msg: MessageWithParts): DisplayContextMessage[] {
  const items: DisplayContextMessage[] = []
  if (!msg.parts?.length) return items

  const textParts = msg.parts.filter((p) => p.type === 'text')
  const toolParts = msg.parts.filter((p) => p.type === 'tool')

  if (msg.role === 'user') {
    const text = textParts
      .map((p) => (p.data as { text?: string })?.text)
      .filter(Boolean)
      .join('\n')
    if (text) {
      items.push({ role: 'user', content: text, label: '用户' })
    }
    return items
  }

  if (msg.role === 'tool') {
    for (const p of toolParts) {
      const data = p.data as { name?: string; arguments?: unknown; result?: unknown }
      if (!data?.name) continue
      items.push({
        role: 'tool',
        label: '工具',
        content: formatToolInvocationCard(data.name, data.arguments, data.result)
      })
    }
    return items
  }

  for (const p of textParts) {
    const data = p.data as { text?: string; isReasoning?: boolean }
    if (!data?.text) continue
    if (data.isReasoning) {
      items.push({
        role: 'assistant',
        content: data.text,
        label: 'AI 思考'
      })
    }
  }

  for (const p of toolParts) {
    const data = p.data as {
      name?: string
      arguments?: unknown
      result?: unknown
    }
    if (!data?.name) continue

    items.push({
      role: 'assistant',
      label: '工具调用',
      content: formatToolInvocationCard(data.name, data.arguments, data.result)
    })
  }

  for (const p of textParts) {
    const data = p.data as { text?: string; isReasoning?: boolean }
    if (!data?.text || data.isReasoning) continue
    items.push({
      role: 'assistant',
      content: data.text,
      label: 'AI 输出'
    })
  }

  return items
}

export function extractCompactionSummary(msg: MessageWithParts): string | undefined {
  const compPart = msg.parts?.find((p) => p.type === 'compaction')
  const summary = (compPart?.data as { summary?: string } | undefined)?.summary
  return typeof summary === 'string' && summary.trim().length > 0 ? summary : undefined
}
