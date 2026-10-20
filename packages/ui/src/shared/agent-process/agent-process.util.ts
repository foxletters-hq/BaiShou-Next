import { resolveAgentToolActionLabel, type AssistantDisplayTimelineItem } from '@baishou/shared'
import { formatToolDurationMs } from '../agent-tool-chain/agent-tool-chain.util'
import { parseRedactedThinking } from '../chat-bubble/redacted-thinking'

export interface AgentProcessMetaOptions {
  hasReasoning: boolean
  completedToolsCount: number
  totalDurationMs?: number
  isStreaming?: boolean
  hasAnswerText?: boolean
  activeToolName?: string | null
  isThinkLoading?: boolean
  t?: (key: string, fallback?: string, options?: Record<string, unknown>) => string
}

function interpolate(template: string, vars?: Record<string, unknown>): string {
  if (!vars) return template
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => String(vars[key] ?? ''))
}

export function formatAgentProcessTitle({
  hasReasoning,
  completedToolsCount,
  totalDurationMs = 0,
  isStreaming = false,
  hasAnswerText = false,
  activeToolName = null,
  isThinkLoading = false,
  t
}: AgentProcessMetaOptions): string {
  const translate = (key: string, fallback: string, options?: Record<string, unknown>) => {
    if (t) {
      const res = t(key, fallback, options)
      return interpolate(res, options)
    }
    return interpolate(fallback, options)
  }

  const _formattedDuration = totalDurationMs > 0 ? formatToolDurationMs(totalDurationMs) : null
  void _formattedDuration

  // 流式中且尚未输出正文：展示当前正在进行的实时步骤
  if (isStreaming && !hasAnswerText) {
    if (activeToolName) {
      // 工具名按 i18n 显示（未知工具回退原始编号；已本地化的名称保持不变）
      const name = resolveAgentToolActionLabel(activeToolName, (key, fallback) =>
        translate(key, fallback)
      )
      return translate('agent.chat.tool_running', '正在执行：{{name}}…', { name })
    }
    if (isThinkLoading || hasReasoning) {
      return translate('agent.chat.thinking_active', '深度思考中…')
    }
    return translate('agent.chat.process_active', '正在处理中…')
  }

  // 已输出正文或已落盘完成态：展示紧凑收拢的摘要（不拼耗时，避免小屏换行或挤占）
  if (hasReasoning && completedToolsCount > 0) {
    return translate('agent.chat.process_thought_and_tools', '思考完成，完成{{count}}项操作', {
      count: completedToolsCount
    })
  }

  if (completedToolsCount > 0) {
    return translate('agent.chat.process_tools_only', '完成{{count}}项操作', {
      count: completedToolsCount
    })
  }

  return translate('agent.chat.thought_process', '思考完成')
}

export type CoalescedProcessStep =
  | Extract<AssistantDisplayTimelineItem, { kind: 'reasoning' }>
  | Extract<AssistantDisplayTimelineItem, { kind: 'tools' }>
  | Extract<AssistantDisplayTimelineItem, { kind: 'gate' }>
  | Extract<AssistantDisplayTimelineItem, { kind: 'text' }>

export type CoalescedTimelineItem =
  | {
      kind: 'process'
      key: string
      steps: CoalescedProcessStep[]
      reasoningItems: Array<Extract<AssistantDisplayTimelineItem, { kind: 'reasoning' }>>
      toolsItems: Array<Extract<AssistantDisplayTimelineItem, { kind: 'tools' }>>
      gateItems: Array<Extract<AssistantDisplayTimelineItem, { kind: 'gate' }>>
      textItems: Array<Extract<AssistantDisplayTimelineItem, { kind: 'text' }>>
      hasSubsequentText: boolean
      hasPrecedingText: boolean
    }
  | Extract<AssistantDisplayTimelineItem, { kind: 'gate' }>
  | Extract<AssistantDisplayTimelineItem, { kind: 'text' }>

/**
 * 将整个回合的工作过程（所有思考、工具调用、权限确认记录，以及工具/思考结束前的中间过渡文字）
 * 统一收拢为顶部的单个 process 项，仅保留最后的 AI 输出正文作为内容部分，实现「工作过程 + 最终内容」两段式展示。
 */
export function coalesceTimelineItemsForDisplay(
  items: readonly AssistantDisplayTimelineItem[]
): CoalescedTimelineItem[] {
  if (items.length === 0) return []

  // 找到最后一个代表仍在执行工作过程（思考或工具调用，或内嵌 <think> 的文本）的索引；
  // 在此索引之前的 text 均视为中间过渡文字并归入工作过程，在此索引之后的 text 为最终输出正文。
  // 所有 gate（权限确认记录）始终归入工作过程。
  let lastActiveWorkIndex = -1
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!
    if (item.kind === 'reasoning' && item.text.trim()) {
      lastActiveWorkIndex = i
    } else if (item.kind === 'tools') {
      lastActiveWorkIndex = i
    } else if (item.kind === 'text') {
      const parsed = parseRedactedThinking(item.text)
      if (parsed.cleanReasoning.trim()) {
        lastActiveWorkIndex = i
      }
    }
  }

  const steps: CoalescedProcessStep[] = []
  const reasoningItems: Array<Extract<AssistantDisplayTimelineItem, { kind: 'reasoning' }>> = []
  const toolsItems: Array<Extract<AssistantDisplayTimelineItem, { kind: 'tools' }>> = []
  const gateItems: Array<Extract<AssistantDisplayTimelineItem, { kind: 'gate' }>> = []
  const textItems: Array<Extract<AssistantDisplayTimelineItem, { kind: 'text' }>> = []
  const finalTextItems: Array<Extract<AssistantDisplayTimelineItem, { kind: 'text' }>> = []
  let groupKeyPrefix = ''

  const ensureKeyPrefix = (key: string) => {
    if (!groupKeyPrefix) {
      groupKeyPrefix = `proc-${key}`
    }
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!

    if (item.kind === 'reasoning') {
      if (!item.text.trim()) continue
      ensureKeyPrefix(item.key)
      steps.push(item)
      reasoningItems.push(item)
      continue
    }

    if (item.kind === 'tools') {
      ensureKeyPrefix(item.key)
      steps.push(item)
      toolsItems.push(item)
      continue
    }

    if (item.kind === 'gate') {
      ensureKeyPrefix(item.key)
      steps.push(item)
      gateItems.push(item)
      continue
    }

    // item.kind === 'text'
    const parsed = parseRedactedThinking(item.text)
    if (parsed.cleanReasoning.trim()) {
      ensureKeyPrefix(item.key)
      const reasoningStep: Extract<AssistantDisplayTimelineItem, { kind: 'reasoning' }> = {
        kind: 'reasoning',
        key: `${item.key}:reasoning`,
        text: parsed.cleanReasoning
      }
      steps.push(reasoningStep)
      reasoningItems.push(reasoningStep)
    }

    const visibleText = parsed.cleanContent || (!parsed.cleanReasoning ? item.text : '')
    if (!visibleText.trim()) continue

    const cleanTextItem: Extract<AssistantDisplayTimelineItem, { kind: 'text' }> = {
      kind: 'text',
      key: item.key,
      text: visibleText
    }

    if (i < lastActiveWorkIndex) {
      ensureKeyPrefix(item.key)
      steps.push(cleanTextItem)
      textItems.push(cleanTextItem)
    } else {
      finalTextItems.push(cleanTextItem)
    }
  }

  const result: CoalescedTimelineItem[] = []
  if (steps.length > 0) {
    result.push({
      kind: 'process',
      key: groupKeyPrefix || 'process:0',
      steps,
      reasoningItems,
      toolsItems,
      gateItems,
      textItems,
      hasSubsequentText: finalTextItems.length > 0,
      hasPrecedingText: false
    })
  }

  result.push(...finalTextItems)
  return result
}
