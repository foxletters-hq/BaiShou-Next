import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

/** Think 标题 / 展开态，桌面 Ant Design X 与移动端 AgentThinkSection 共用 */
export function useAgentThinkPresentation(isStreaming: boolean) {
  const { t } = useTranslation()

  const title = isStreaming
    ? t('agent.chat.thinking_active', '深度思考中…')
    : t('agent.chat.thought_process', '思考过程')
  const loading = isStreaming
  const prevIsStreamingRef = useRef(isStreaming)
  const userTouchedRef = useRef(false)
  /** 默认折叠；流式期间也不自动展开 */
  const [expanded, setExpandedState] = useState(false)

  const setExpanded = (next: boolean | ((prev: boolean) => boolean)) => {
    userTouchedRef.current = true
    setExpandedState(next)
  }

  useEffect(() => {
    const wasStreaming = prevIsStreamingRef.current
    if (wasStreaming === isStreaming) return
    prevIsStreamingRef.current = isStreaming

    // 仅在用户未手动展开/折叠时，于思考结束收起；避免等待态→真思考或阶段切换打断用户
    if (wasStreaming && !isStreaming && !userTouchedRef.current) {
      setExpandedState(false)
    }
    if (!isStreaming) {
      userTouchedRef.current = false
    }
  }, [isStreaming])

  return { title, loading, expanded, setExpanded }
}
