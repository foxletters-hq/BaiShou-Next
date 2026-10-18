import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatAgentProcessTitle, type AgentProcessMetaOptions } from './agent-process.util'

export interface UseAgentProcessPresentationOptions extends Omit<AgentProcessMetaOptions, 't'> {
  /** 初始展开状态覆盖（若未指定则由智能状态机决定） */
  defaultExpanded?: boolean
}

export function useAgentProcessPresentation(options: UseAgentProcessPresentationOptions) {
  const { t } = useTranslation()
  const {
    hasReasoning,
    completedToolsCount,
    totalDurationMs = 0,
    isStreaming = false,
    hasAnswerText = false,
    activeToolName = null,
    isThinkLoading = false,
    defaultExpanded
  } = options

  const prevHasAnswerTextRef = useRef(hasAnswerText)
  const prevIsStreamingRef = useRef(isStreaming)
  const userTouchedRef = useRef(false)

  // 初始状态：如果已有正文或者不在流式中，默认收起；若在流式中且尚无正文，默认展开
  const computeInitialExpanded = () => {
    if (defaultExpanded !== undefined) return defaultExpanded
    if (hasAnswerText || !isStreaming) return false
    return true
  }

  const [expanded, setExpandedState] = useState(computeInitialExpanded)

  const setExpanded = (next: boolean | ((prev: boolean) => boolean)) => {
    userTouchedRef.current = true
    setExpandedState(next)
  }

  useEffect(() => {
    const prevHasAnswer = prevHasAnswerTextRef.current
    const prevIsStreaming = prevIsStreamingRef.current
    prevHasAnswerTextRef.current = hasAnswerText
    prevIsStreamingRef.current = isStreaming

    // 当正文开始产生（hasAnswerText 从 false 变为 true）且用户未主动干预时，自动平滑收起！
    if (!prevHasAnswer && hasAnswerText && !userTouchedRef.current) {
      setExpandedState(false)
    }

    // 若流式中先产生了过渡文字，随后又发起工具/思考（hasAnswerText 变回 false），重新展开工作过程
    if (prevHasAnswer && !hasAnswerText && isStreaming && !userTouchedRef.current) {
      setExpandedState(true)
    }

    // 当流式结束（isStreaming 从 true 变为 false）且用户未主动干预时，确保收起
    if (prevIsStreaming && !isStreaming && !userTouchedRef.current) {
      setExpandedState(false)
    }
  }, [hasAnswerText, isStreaming])

  const title = formatAgentProcessTitle({
    hasReasoning,
    completedToolsCount,
    totalDurationMs,
    isStreaming,
    hasAnswerText,
    activeToolName,
    isThinkLoading,
    t: (key: string, fallback?: string, options?: Record<string, unknown>) =>
      String(fallback !== undefined ? t(key, fallback, options as any) : t(key, options as any))
  })

  const loading = Boolean(isStreaming && (activeToolName || isThinkLoading || !hasAnswerText))

  return {
    title,
    loading,
    expanded,
    setExpanded
  }
}
