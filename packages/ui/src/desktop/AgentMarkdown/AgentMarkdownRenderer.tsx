import React, { useMemo } from 'react'
import XMarkdown from '@ant-design/x-markdown'
import '@ant-design/x-markdown/es/XMarkdown/index.css'
import '@ant-design/x-markdown/themes/light.css'
import '@ant-design/x-markdown/themes/dark.css'
import 'highlight.js/styles/github.css'
import { agentMarkedConfig, buildAgentStreamingOptions } from './agent-markdown.config'
import styles from './AgentMarkdownRenderer.module.css'
import { useAgentMarkdownComponents } from './useAgentMarkdownComponents'
import { useAgentMarkdownThemeClass } from './useAgentMarkdownThemeClass'

export interface AgentMarkdownRendererProps {
  content: string
  /** 流式进行中：启用 XMarkdown streaming 模式 */
  isStreaming?: boolean
  /** 纯文本展示（如系统提示词），不做 Markdown 解析 */
  plainText?: boolean
  className?: string
  /** ancillary：思考块等附属内容 */
  variant?: 'chat' | 'ancillary'
}

/**
 * Agent 对话专用 Markdown 渲染（XMarkdown）。
 * 流式配置与占位组件对齐官方 Playground 模式。
 */
export const AgentMarkdownRenderer: React.FC<AgentMarkdownRendererProps> = ({
  content,
  isStreaming = false,
  plainText = false,
  className,
  variant = 'chat'
}) => {
  const themeClass = useAgentMarkdownThemeClass()
  const components = useAgentMarkdownComponents()
  const streaming = useMemo(() => buildAgentStreamingOptions(isStreaming), [isStreaming])

  if (plainText) {
    return <div className={`${styles.plainText} ${className ?? ''}`}>{content}</div>
  }

  const variantClass = variant === 'ancillary' ? styles.ancillary : styles.root

  return (
    <XMarkdown
      content={content}
      config={agentMarkedConfig}
      className={`x-markdown ${themeClass} ${variantClass} ${className ?? ''}`}
      escapeRawHtml
      openLinksInNewTab
      protectCustomTagNewlines
      streaming={streaming}
      components={components}
    />
  )
}
