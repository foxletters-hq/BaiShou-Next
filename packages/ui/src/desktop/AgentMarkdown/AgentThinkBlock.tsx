import React from 'react'
import { Think } from '@ant-design/x'
import type { ComponentProps as XMarkdownComponentProps } from '@ant-design/x-markdown'
import { useAgentThinkPresentation } from '../../shared/agent-think'
import styles from './AgentThinkBlock.module.css'

/** 正文内嵌 think 标签时由 XMarkdown components 映射（需 escapeRawHtml=false） */
export const AgentThinkBlock = React.memo(function AgentThinkBlock(props: XMarkdownComponentProps) {
  const { streamStatus, children } = props
  const isStreaming = streamStatus === 'loading'
  const { title, loading, expanded, setExpanded } = useAgentThinkPresentation(isStreaming)

  return (
    <Think
      className={styles.root}
      title={title}
      loading={loading}
      expanded={expanded}
      blink={isStreaming}
      onExpand={setExpanded}
    >
      {children}
    </Think>
  )
})
