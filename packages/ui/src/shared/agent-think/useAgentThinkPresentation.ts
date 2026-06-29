import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

/** Think 标题 / 展开态，桌面 Ant Design X 与移动端 AgentThinkSection 共用 */
export function useAgentThinkPresentation(isStreaming: boolean) {
  const { t } = useTranslation()

  const [title, setTitle] = useState(() =>
    isStreaming
      ? t('agent.chat.thinking_active', '深度思考中…')
      : t('agent.chat.thought_process', '思考过程')
  )
  const [loading, setLoading] = useState(isStreaming)
  const [expanded, setExpanded] = useState(isStreaming)

  useEffect(() => {
    if (isStreaming) {
      setTitle(t('agent.chat.thinking_active', '深度思考中…'))
      setLoading(true)
      setExpanded(true)
      return
    }

    setTitle(t('agent.chat.thought_process', '思考过程'))
    setLoading(false)
    setExpanded(false)
  }, [isStreaming, t])

  return { title, loading, expanded, setExpanded }
}
