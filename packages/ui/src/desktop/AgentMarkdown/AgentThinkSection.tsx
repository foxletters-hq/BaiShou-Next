import React, { useMemo } from 'react'
import { Think } from '@ant-design/x'
import { XProvider } from '@ant-design/x'
import { theme } from 'antd'
import { useTheme } from '../../hooks/useTheme'
import { AgentMarkdownRenderer } from './AgentMarkdownRenderer'
import { useAgentThinkPresentation } from '../../shared/agent-think'
import styles from './AgentThinkBlock.module.css'

export interface AgentThinkSectionProps {
  content: string
  isStreaming?: boolean
}

/**
 * 直接渲染 Ant Design X Think（不经 XMarkdown 包 think 标签）。
 * escapeRawHtml 会把自定义标签转义成纯文本，因此 reasoning 不能走标签再解析。
 */
export const AgentThinkSection: React.FC<AgentThinkSectionProps> = ({
  content,
  isStreaming = false
}) => {
  const { isDark } = useTheme()
  const body = content.trim()
  const { title, loading, expanded, setExpanded } = useAgentThinkPresentation(isStreaming)

  const xProviderTheme = useMemo(
    () => ({
      algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm
    }),
    [isDark]
  )

  if (!isStreaming && !body) return null

  return (
    <XProvider theme={xProviderTheme}>
      <Think
        className={styles.root}
        title={title}
        loading={loading}
        expanded={expanded}
        blink={isStreaming}
        onExpand={setExpanded}
      >
        {body ? (
          <AgentMarkdownRenderer
            content={body}
            variant="ancillary"
            isStreaming={isStreaming}
            wrapXProvider={false}
          />
        ) : null}
      </Think>
    </XProvider>
  )
}
