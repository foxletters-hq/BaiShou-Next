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
  /** 默认折叠；流式期间也不自动展开 */
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const wasStreaming = prevIsStreamingRef.current
    if (wasStreaming === isStreaming) return
    prevIsStreamingRef.current = isStreaming

    if (!isStreaming) setExpanded(false)
  }, [isStreaming])

  return { title, loading, expanded, setExpanded }
}
