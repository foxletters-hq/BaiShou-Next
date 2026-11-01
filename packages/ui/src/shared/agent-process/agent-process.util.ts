import i18n from 'i18next'
import { resolveAgentToolActionLabel, type AssistantDisplayTimelineItem } from '@baishou/shared'
import { formatToolDurationMs } from '../agent-tool-chain/agent-tool-chain.util'
import { parseRedactedThinking } from '../chat-bubble/redacted-thinking'

export const AGENT_PROCESS_ROTATE_INTERVAL_MS = 8000

export const AGENT_PROCESS_ACTIVE_PHRASES = [
  {
    key: 'agent.chat.process_active_phrase_0',
    fallback: i18n.t('agent.chat.process_active_phrase_0', '伙伴正在喝茶…')
  },
  {
    key: 'agent.chat.process_active_phrase_1',
    fallback: i18n.t('agent.chat.process_active_phrase_1', '伙伴正在打盹…')
  },
  {
    key: 'agent.chat.process_active_phrase_2',
    fallback: i18n.t('agent.chat.process_active_phrase_2', '伙伴正在托腮沉思…')
  },
  {
    key: 'agent.chat.process_active_phrase_3',
    fallback: i18n.t('agent.chat.process_active_phrase_3', '伙伴正在翻阅记忆…')
  },
  {
    key: 'agent.chat.process_active_phrase_4',
    fallback: i18n.t('agent.chat.process_active_phrase_4', '伙伴正在伸懒腰…')
  },
  {
    key: 'agent.chat.process_active_phrase_5',
    fallback: i18n.t('agent.chat.process_active_phrase_5', '伙伴正在整理思绪…')
  },
  {
    key: 'agent.chat.process_active_phrase_6',
    fallback: i18n.t('agent.chat.process_active_phrase_6', '伙伴正在翻小本本…')
  },
  {
    key: 'agent.chat.process_active_phrase_7',
    fallback: i18n.t('agent.chat.process_active_phrase_7', '伙伴正在揉眼睛…')
  },
  {
    key: 'agent.chat.process_active_phrase_8',
    fallback: i18n.t('agent.chat.process_active_phrase_8', '伙伴正在慢悠悠泡茶…')
  },
  {
    key: 'agent.chat.process_active_phrase_9',
    fallback: i18n.t('agent.chat.process_active_phrase_9', '伙伴正在歪头思考…')
  },
  {
    key: 'agent.chat.process_active_phrase_10',
    fallback: i18n.t('agent.chat.process_active_phrase_10', '伙伴正在轻敲桌面…')
  },
  {
    key: 'agent.chat.process_active_phrase_11',
    fallback: i18n.t('agent.chat.process_active_phrase_11', '伙伴正在组织语言…')
  },
  {
    key: 'agent.chat.process_active_phrase_12',
    fallback: i18n.t('agent.chat.process_active_phrase_12', '伙伴正在睡觉…')
  },
  {
    key: 'agent.chat.process_active_phrase_13',
    fallback: i18n.t('agent.chat.process_active_phrase_13', '伙伴正在转笔发呆…')
  },
  {
    key: 'agent.chat.process_active_phrase_14',
    fallback: i18n.t('agent.chat.process_active_phrase_14', '伙伴正在晒太阳…')
  },
  {
    key: 'agent.chat.process_active_phrase_15',
    fallback: i18n.t('agent.chat.process_active_phrase_15', '伙伴正在吹凉热茶…')
  },
  {
    key: 'agent.chat.process_active_phrase_16',
    fallback: i18n.t('agent.chat.process_active_phrase_16', '伙伴正在翻箱倒柜找灵感…')
  },
  {
    key: 'agent.chat.process_active_phrase_17',
    fallback: i18n.t('agent.chat.process_active_phrase_17', '伙伴正在趴桌小憩…')
  },
  {
    key: 'agent.chat.process_active_phrase_18',
    fallback: i18n.t('agent.chat.process_active_phrase_18', '伙伴正在认真记笔记…')
  },
  {
    key: 'agent.chat.process_active_phrase_19',
    fallback: i18n.t('agent.chat.process_active_phrase_19', '伙伴正在数星星…')
  },
  {
    key: 'agent.chat.process_active_phrase_20',
    fallback: i18n.t('agent.chat.process_active_phrase_20', '伙伴正在挠头苦想…')
  },
  {
    key: 'agent.chat.process_active_phrase_21',
    fallback: i18n.t('agent.chat.process_active_phrase_21', '伙伴正在擦拭眼镜…')
  },
  {
    key: 'agent.chat.process_active_phrase_22',
    fallback: i18n.t('agent.chat.process_active_phrase_22', '伙伴正在哼着小曲思考…')
  },
  {
    key: 'agent.chat.process_active_phrase_23',
    fallback: i18n.t('agent.chat.process_active_phrase_23', '伙伴正在捧着茶杯发呆…')
  },
  {
    key: 'agent.chat.process_active_phrase_24',
    fallback: i18n.t('agent.chat.process_active_phrase_24', '伙伴正在脑海里画地图…')
  },
  {
    key: 'agent.chat.process_active_phrase_25',
    fallback: i18n.t('agent.chat.process_active_phrase_25', '伙伴正在拍拍脸颊打起精神…')
  },
  {
    key: 'agent.chat.process_active_phrase_26',
    fallback: i18n.t('agent.chat.process_active_phrase_26', '伙伴正在翻找旧时光…')
  },
  {
    key: 'agent.chat.process_active_phrase_27',
    fallback: i18n.t('agent.chat.process_active_phrase_27', '伙伴正在小声嘀咕着什么…')
  }
] as const

export const AGENT_PROCESS_COMPLETED_PHRASES = [
  {
    key: 'agent.chat.process_done_phrase_0',
    fallback: i18n.t('agent.chat.process_done_phrase_0', '伙伴喝完茶回来啦')
  },
  {
    key: 'agent.chat.process_done_phrase_1',
    fallback: i18n.t('agent.chat.process_done_phrase_1', '伙伴整理好思绪啦')
  },
  {
    key: 'agent.chat.process_done_phrase_2',
    fallback: i18n.t('agent.chat.process_done_phrase_2', '伙伴合上了小本本')
  },
  {
    key: 'agent.chat.process_done_phrase_3',
    fallback: i18n.t('agent.chat.process_done_phrase_3', '伙伴伸了个懒腰，想好啦')
  },
  {
    key: 'agent.chat.process_done_phrase_4',
    fallback: i18n.t('agent.chat.process_done_phrase_4', '伙伴翻完记忆回来啦')
  },
  {
    key: 'agent.chat.process_done_phrase_5',
    fallback: i18n.t('agent.chat.process_done_phrase_5', '伙伴揉揉眼睛醒来啦')
  },
  {
    key: 'agent.chat.process_done_phrase_6',
    fallback: i18n.t('agent.chat.process_done_phrase_6', '伙伴灵光一闪')
  },
  {
    key: 'agent.chat.process_done_phrase_7',
    fallback: i18n.t('agent.chat.process_done_phrase_7', '伙伴组织好语言啦')
  },
  {
    key: 'agent.chat.process_done_phrase_8',
    fallback: i18n.t('agent.chat.process_done_phrase_8', '伙伴放下茶杯准备开口啦')
  },
  {
    key: 'agent.chat.process_done_phrase_9',
    fallback: i18n.t('agent.chat.process_done_phrase_9', '伙伴睡醒一觉，精神百倍')
  },
  {
    key: 'agent.chat.process_done_phrase_10',
    fallback: i18n.t('agent.chat.process_done_phrase_10', '伙伴找到了藏起来的灵感')
  },
  {
    key: 'agent.chat.process_done_phrase_11',
    fallback: i18n.t('agent.chat.process_done_phrase_11', '伙伴拍拍手，大功告成')
  },
  {
    key: 'agent.chat.process_done_phrase_12',
    fallback: i18n.t('agent.chat.process_done_phrase_12', '伙伴推了推眼镜，成竹在胸')
  },
  {
    key: 'agent.chat.process_done_phrase_13',
    fallback: i18n.t('agent.chat.process_done_phrase_13', '伙伴收起笔，准备和你细说')
  },
  {
    key: 'agent.chat.process_done_phrase_14',
    fallback: i18n.t('agent.chat.process_done_phrase_14', '伙伴满载记忆归来啦')
  },
  {
    key: 'agent.chat.process_done_phrase_15',
    fallback: i18n.t('agent.chat.process_done_phrase_15', '伙伴微笑着看向了你')
  }
] as const

/** 随机抽取趣味文案下标；传入 previous 时自动避开上一句，保证轮播每次都有变化 */
export function pickNextAgentProcessPhraseIndex(length: number, previous?: number): number {
  if (length <= 1) return 0
  if (previous == null || previous < 0 || previous >= length) {
    return Math.floor(Math.random() * length)
  }
  const offset = 1 + Math.floor(Math.random() * (length - 1))
  return (previous + offset) % length
}

function normalizePhraseIndex(index: number | undefined, length: number): number {
  if (length <= 0) return 0
  if (index == null || !Number.isFinite(index)) return 0
  return ((Math.trunc(index) % length) + length) % length
}

export interface AgentProcessMetaOptions {
  hasReasoning: boolean
  completedToolsCount: number
  totalDurationMs?: number
  isStreaming?: boolean
  hasAnswerText?: boolean
  activeToolName?: string | null
  isThinkLoading?: boolean
  /** 是否开启趣味状态文案（默认开启 true；关闭时使用经典状态摘要） */
  playfulStatus?: boolean
  /** 趣味状态文案下标（流式时对应 AGENT_PROCESS_ACTIVE_PHRASES，完成态对应 AGENT_PROCESS_COMPLETED_PHRASES） */
  phraseIndex?: number
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
  playfulStatus = true,
  phraseIndex,
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

  if (playfulStatus !== false) {
    // 流式中且尚未输出正文：顶部展示「伙伴正在喝茶…」等趣味日常动态（内部列表已展示具体思考与工具步骤）
    if (isStreaming && !hasAnswerText) {
      const idx = normalizePhraseIndex(phraseIndex, AGENT_PROCESS_ACTIVE_PHRASES.length)
      const item = AGENT_PROCESS_ACTIVE_PHRASES[idx]!
      return translate(item.key, item.fallback)
    }

    // 已输出正文或已落盘完成态：展示温馨有趣的完成态文案
    const doneIdx = normalizePhraseIndex(phraseIndex, AGENT_PROCESS_COMPLETED_PHRASES.length)
    const doneItem = AGENT_PROCESS_COMPLETED_PHRASES[doneIdx]!
    return translate(doneItem.key, doneItem.fallback)
  }

  // 关闭趣味状态时：使用经典状态文案
  if (isStreaming && !hasAnswerText) {
    if (activeToolName) {
      const name = resolveAgentToolActionLabel(activeToolName, (key, fallback) =>
        translate(key, fallback)
      )
      return translate(
        'agent.chat.tool_running',
        i18n.t('agent.chat.tool_running', '正在执行：{{name}}…'),
        { name }
      )
    }
    if (isThinkLoading || hasReasoning) {
      return translate(
        'agent.chat.thinking_active',
        i18n.t('agent.chat.thinking_active', '深度思考中…')
      )
    }
    return translate(
      'agent.chat.process_active',
      i18n.t('agent.chat.process_active', '正在处理中…')
    )
  }

  if (hasReasoning && completedToolsCount > 0) {
    return translate(
      'agent.chat.process_thought_and_tools',
      i18n.t('agent.chat.process_thought_and_tools', '思考完成，完成{{count}}项操作'),
      {
        count: completedToolsCount
      }
    )
  }

  if (completedToolsCount > 0) {
    return translate(
      'agent.chat.process_tools_only',
      i18n.t('agent.chat.process_tools_only', '完成{{count}}项操作'),
      {
        count: completedToolsCount
      }
    )
  }

  return translate('agent.chat.thought_process', i18n.t('agent.chat.thought_process', '思考完成'))
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
 * 判断一段可见正文是否属于已经成型的结构化主回答（而非「让我先查一下…」之类的工具前过渡短语）。
 * 当模型在发起提问（companion_ask）或后续工具前已经输出了带多行/列表/标题或较长篇幅的汇报时，
 * 应当保留在最终回答区一并展示给用户，避免被折叠进顶部工作过程栏造成正文截断。
 */
function isSubstantialReplyText(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (trimmed.length >= 120) return true
  const nonEmptyLines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (nonEmptyLines.length >= 3) return true
  return nonEmptyLines.some((line) =>
    /^(?:#{1,6}\s|[-*+•]\s|\d+[.、]\s|[一二三四五六七八九十]+[、.．])/.test(line)
  )
}

export interface CoalesceTimelineOptions {
  /** 当前消息是否仍处于流式生成中；流式期间工具前的过渡短语保持在工作过程内，不提前兜底为最终正文 */
  isStreaming?: boolean
}

function isAskOnlyTimelineWorkItem(item: AssistantDisplayTimelineItem): boolean {
  if (item.kind === 'gate') {
    return item.data?.request?.action?.trim() === 'companion_ask'
  }
  if (item.kind === 'tools') {
    const names = [
      ...(item.invocations?.map((tool) => tool.toolName) ?? []),
      ...(item.completedTools?.map((tool) => tool.name) ?? []),
      ...(item.activeToolName ? [item.activeToolName] : [])
    ]
    return names.length > 0 && names.every((name) => name === 'companion_ask')
  }
  return false
}

function hasNonAskToolAfter(
  items: readonly AssistantDisplayTimelineItem[],
  fromIndex: number
): boolean {
  for (let i = fromIndex + 1; i < items.length; i++) {
    const item = items[i]!
    if ((item.kind === 'tools' || item.kind === 'gate') && !isAskOnlyTimelineWorkItem(item)) {
      return true
    }
  }
  return false
}

/**
 * 将整个回合的工作过程（所有思考、工具调用、权限确认记录，以及工具结束前的中间过渡短语）
 * 统一收拢为顶部的单个 process 项，保留主汇报与工具后正文作为最终内容，实现「工作过程 + 最终内容」两段式展示。
 */
export function coalesceTimelineItemsForDisplay(
  items: readonly AssistantDisplayTimelineItem[],
  options?: CoalesceTimelineOptions
): CoalescedTimelineItem[] {
  if (items.length === 0) return []

  const settled = !options?.isStreaming

  // 扫描完整时间线，定位最后一个工具调用（tools / gate）索引：
  // 1. 任何位于最后一个工具调用之前的短过渡语（i < lastToolIndex），默认归入工作过程；
  // 2. 若工具之前的某段文字本身已经是多行/结构化的实质性汇报，且其后仅有 companion_ask 提问工具，
  //    则保留在 finalTextItems 中与后续收尾一并展示；
  // 3. 仅当回合已结束（settled）且没有任何工具后正文时，才把最后一段可见文字从工作过程中兜底提出来作为最终正文，
  //    避免流式期间后续工具与深度思考仍在执行时提前把中间过渡语当成最终回答并错误收起工作过程栏。
  let lastToolIndex = -1
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!
    if (item.kind === 'tools' || item.kind === 'gate') {
      lastToolIndex = i
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

    const isPreAskSubstantialReport =
      isSubstantialReplyText(visibleText) && !hasNonAskToolAfter(items, i)

    if (i < lastToolIndex && !isPreAskSubstantialReport) {
      ensureKeyPrefix(item.key)
      steps.push(cleanTextItem)
      textItems.push(cleanTextItem)
    } else {
      finalTextItems.push(cleanTextItem)
    }
  }

  if (settled && finalTextItems.length === 0 && textItems.length > 0) {
    const rescuedText = textItems.pop()!
    const stepIndex = steps.lastIndexOf(rescuedText)
    if (stepIndex >= 0) {
      steps.splice(stepIndex, 1)
    }
    finalTextItems.push(rescuedText)
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
