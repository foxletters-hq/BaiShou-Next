import React from 'react'
import { useTranslation } from 'react-i18next'
import type { MockChatMessage } from '@baishou/shared'
import panelStyles from './ContextChainPanel.module.css'
import type { CallChainFlatEntry, CallChainRoundGroup } from './call-chain-panel.types'
import { useRoundRevealSequence } from './useRoundRevealSequence'

export type { CallChainFlatEntry, CallChainRoundGroup }

export type ContextChainTab = 'context' | 'compressed' | 'prompt'

/** 左侧列表选中「对话压缩」块时使用的虚拟 key */
export const COMPRESSION_SUMMARY_SELECTION_KEY = '__compression-summary__'

export interface CallChainPanelMeta {
  nextRequest?: {
    /** 下次请求预计上下文 token（系统提示词 + 历史） */
    estimatedInputTokens: number
    contextRoundLimit: number
    contextRoundCount: number
  }
  roundUsage?: {
    inputTokens: number
    outputTokens: number
    costMicros: number
  } | null
  activeRoundIndex?: number
}

export interface UseContextChainViewParams {
  message: MockChatMessage
  flatEntries: CallChainFlatEntry[]
  meta?: CallChainPanelMeta
  compressedContent?: string
  systemPrompt?: string
  isOpen: boolean
}

export function useContextChainView({
  message,
  flatEntries,
  meta,
  compressedContent,
  systemPrompt,
  isOpen
}: UseContextChainViewParams) {
  const { t } = useTranslation()
  const [selectedMessageKey, setSelectedMessageKey] = React.useState<string | null>(null)
  const [activeTab, setActiveTab] = React.useState<ContextChainTab>('context')
  const roundIndices = React.useMemo(
    () =>
      flatEntries
        .filter(
          (e): e is CallChainFlatEntry & { kind: 'round-header'; roundIndex: number } =>
            e.kind === 'round-header' && e.roundIndex != null
        )
        .map((e) => e.roundIndex),
    [flatEntries]
  )

  const selectableEntries = React.useMemo(
    () =>
      flatEntries.filter(
        (
          e
        ): e is CallChainFlatEntry & {
          kind: 'message' | 'system-prompt'
          item: MockChatMessage & { label?: string }
        } => (e.kind === 'message' || e.kind === 'system-prompt') && Boolean(e.item)
      ),
    [flatEntries]
  )

  const messageEntries = selectableEntries

  const resolveDefaultActiveRound = React.useCallback(() => {
    if (meta?.activeRoundIndex && meta.activeRoundIndex > 0) {
      return meta.activeRoundIndex
    }
    return roundIndices[roundIndices.length - 1] ?? 1
  }, [meta?.activeRoundIndex, roundIndices])

  const getChainRoleLabel = (role: string) => {
    switch (role) {
      case 'system':
        return '系统'
      case 'user':
        return '用户'
      case 'assistant':
        return 'AI 助手'
      case 'tool':
        return '工具'
      default:
        return role
    }
  }

  const getMessageLabel = (msg: MockChatMessage & { label?: string }) =>
    msg.label || getChainRoleLabel(msg.role)

  const getLabelBadgeClass = (label?: string) => {
    switch (label) {
      case '系统提示词':
        return panelStyles.roleSystem
      case '用户':
        return panelStyles.roleUser
      case 'AI 思考':
        return panelStyles.roleThinking
      case 'AI 输出':
        return panelStyles.roleAssistant
      case '工具调用':
        return panelStyles.roleTool
      case '对话压缩':
        return panelStyles.roleCompaction
      default:
        return panelStyles.roleDefault
    }
  }

  const systemPromptEntry = React.useMemo(
    () => flatEntries.find((e) => e.kind === 'system-prompt' && e.item),
    [flatEntries]
  )

  const compressionSummaryEntry = React.useMemo(
    () => flatEntries.find((e) => e.kind === 'compression-summary'),
    [flatEntries]
  )

  const roundGroups = React.useMemo(() => {
    const groups: CallChainRoundGroup[] = []
    let current: CallChainRoundGroup | null = null

    for (const entry of flatEntries) {
      if (entry.kind === 'round-header' && entry.roundIndex != null) {
        current = { roundIndex: entry.roundIndex, messages: [] }
        groups.push(current)
        continue
      }
      if (entry.kind === 'message' && entry.item && current) {
        current.messages.push(entry as CallChainRoundGroup['messages'][number])
      }
    }

    return groups
  }, [flatEntries])

  const roundRevealApi = useRoundRevealSequence(roundGroups)

  const selectDefaultInRound = React.useCallback(
    (roundIndex: number) => {
      const inRound = selectableEntries.filter(
        (e) => e.kind === 'message' && e.roundIndex === roundIndex
      )
      const userInRound = inRound.find((e) => e.item?.role === 'user')
      const pick = userInRound ?? inRound[0]
      if (pick?.item?.id) {
        setSelectedMessageKey(pick.item.id)
        return
      }
      const systemEntry = selectableEntries.find((e) => e.kind === 'system-prompt')
      const first = systemEntry ?? selectableEntries[0]
      setSelectedMessageKey(first?.item?.id ?? null)
    },
    [selectableEntries]
  )

  const expandSequenceRef = React.useRef(roundRevealApi.expandRoundWithSequence)
  expandSequenceRef.current = roundRevealApi.expandRoundWithSequence
  const collapseAllRef = React.useRef(roundRevealApi.collapseAll)
  collapseAllRef.current = roundRevealApi.collapseAll
  const selectDefaultInRoundRef = React.useRef(selectDefaultInRound)
  selectDefaultInRoundRef.current = selectDefaultInRound
  const resolveActiveRoundRef = React.useRef(resolveDefaultActiveRound)
  resolveActiveRoundRef.current = resolveDefaultActiveRound

  React.useLayoutEffect(() => {
    if (!isOpen) return

    setActiveTab('context')
    const activeRound = resolveActiveRoundRef.current()
    selectDefaultInRoundRef.current(activeRound)
    expandSequenceRef.current(activeRound)

    return () => {
      collapseAllRef.current()
    }
  }, [isOpen])

  const toggleRound = React.useCallback(
    (roundIndex: number) => {
      if (roundRevealApi.isRoundExpanded(roundIndex)) {
        roundRevealApi.collapseRound(roundIndex)
        return
      }
      selectDefaultInRound(roundIndex)
      roundRevealApi.expandRoundWithSequence(roundIndex)
    },
    [roundRevealApi, selectDefaultInRound]
  )

  const systemPromptInChain = flatEntries.some(
    (e) => e.kind === 'system-prompt' || e.item?.label === '系统提示词'
  )

  const getRoleColorClass = (role: string) => {
    switch (role) {
      case 'user':
        return panelStyles.roleUser
      case 'assistant':
        return panelStyles.roleAssistant
      case 'system':
        return panelStyles.roleSystem
      case 'tool':
        return panelStyles.roleTool
      default:
        return panelStyles.roleDefault
    }
  }

  const compressionInChain = Boolean(compressionSummaryEntry?.summaryText)

  const tabs: { key: ContextChainTab; label: string }[] = [
    { key: 'context', label: t('agent.chat.tab_call_chain', '调用链') },
    ...(compressedContent && !compressionInChain
      ? [{ key: 'compressed' as const, label: t('agent.chat.tab_compressed', '压缩摘要') }]
      : []),
    ...(systemPrompt && !systemPromptInChain
      ? [{ key: 'prompt' as const, label: t('agent.chat.tab_prompt', '系统提示词') }]
      : [])
  ]

  const roundUsage = meta?.roundUsage
  const costText =
    roundUsage && roundUsage.costMicros > 0
      ? `$${(roundUsage.costMicros / 1_000_000).toFixed(4)}`
      : null

  const formatPreview = (content?: string) => {
    if (!content) return ''
    return content.length > 120 ? `${content.slice(0, 120)}…` : content
  }

  const formatToolPreview = (content?: string) => {
    if (!content) return ''
    const titleMatch = content.match(/^###\s+(.+)$/m)
    if (titleMatch?.[1]) {
      return titleMatch[1]
    }
    return formatPreview(content)
  }

  const selectedEntry = messageEntries.find((e) => e.item?.id === selectedMessageKey)
  const selected = selectedEntry?.item
  const compressionSelected =
    selectedMessageKey === COMPRESSION_SUMMARY_SELECTION_KEY &&
    Boolean(compressionSummaryEntry?.summaryText?.trim())

  const formatRoundLimit = (limit: number) =>
    limit <= 0 ? t('agent.chat.context_rounds_unlimited', '不限') : String(limit)

  return {
    t,
    selectedMessageKey,
    setSelectedMessageKey,
    activeTab,
    setActiveTab,
    getMessageLabel,
    getLabelBadgeClass,
    systemPromptEntry,
    compressionSummaryEntry,
    roundGroups,
    getRoleColorClass,
    tabs,
    messageEntries,
    flatEntries,
    selected,
    compressionSelected,
    compressionSummaryText: compressionSummaryEntry?.summaryText?.trim() ?? '',
    compressionReasoningText: compressionSummaryEntry?.reasoningText?.trim() ?? '',
    formatPreview,
    formatToolPreview,
    compressedContent,
    systemPrompt,
    meta,
    costText,
    roundUsage,
    formatRoundLimit,
    isRoundExpanded: roundRevealApi.isRoundExpanded,
    getVisibleMessages: roundRevealApi.getVisibleMessages,
    isRevealing: roundRevealApi.isRevealing,
    toggleRound,
    resolveDefaultActiveRound
  }
}
