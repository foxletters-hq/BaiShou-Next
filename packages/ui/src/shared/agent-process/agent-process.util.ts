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
 * 将整个回合的工作过程（所有思考、工具调用、权限确认记录，以及工具/思考结束前的中间过渡文字）
 * 统一收拢为顶部的单个 process 项，仅保留最后的 AI 输出正文作为内容部分，实现「工作过程 + 最终内容」两段式展示。
 */
export function coalesceTimelineItemsForDisplay(
  items: readonly AssistantDisplayTimelineItem[]
): CoalescedTimelineItem[] {
  if (items.length === 0) return []

  // 找到最后一个含可见正文的 text 索引，以及在此之前的最后一个工作过程（思考、工具调用或内嵌 <think>）索引。
  // 仅当后续确实产出了新的可见正文时，才将工作过程之前的 text 归入工作过程；
  // 若尾部工作过程之后尚无新的可见正文（如正文中途或末尾调用工具、续轮仅产出思考、或流式中途因网络异常中断），
  // 必须保留最后一段可见正文在 finalTextItems 中展示，防止已输出到气泡的正文被收回折叠进工作过程栏。
  let lastVisibleTextIndex = -1
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!
    if (item.kind === 'text') {
      const parsed = parseRedactedThinking(item.text)
      const visibleText = parsed.cleanContent || (!parsed.cleanReasoning ? item.text : '')
      if (visibleText.trim()) {
        lastVisibleTextIndex = i
      }
    }
  }

  let lastActiveWorkIndex = -1
  const workSearchBound = lastVisibleTextIndex >= 0 ? lastVisibleTextIndex : items.length
  for (let i = 0; i < workSearchBound; i++) {
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
