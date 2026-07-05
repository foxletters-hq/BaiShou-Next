import React, { useMemo } from 'react'
import XMarkdown from '@ant-design/x-markdown'
import { XProvider } from '@ant-design/x'
import { theme } from 'antd'
import '@ant-design/x-markdown/es/XMarkdown/index.css'
import '@ant-design/x-markdown/themes/light.css'
import '@ant-design/x-markdown/themes/dark.css'
import 'highlight.js/styles/github.css'
import { useTheme } from '../../hooks/useTheme'
import { agentMarkedConfig, buildAgentStreamingOptions } from './agent-markdown.config'
import styles from './AgentMarkdownRenderer.module.css'
import { useAgentMarkdownComponents } from './useAgentMarkdownComponents'
import { useAgentMarkdownThemeClass } from './useAgentMarkdownThemeClass'

const CUSTOM_THINK_TAG_PATTERN = /<(redacted_thinking|think|thinking)(?:\s|>)/i

export interface AgentMarkdownRendererProps {
  content: string
  /** 流式进行中：启用 XMarkdown streaming 模式 */
  isStreaming?: boolean
  /** 纯文本展示（如系统提示词），不做 Markdown 解析 */
  plainText?: boolean
  className?: string
  /** ancillary：思考块等附属内容 */
  variant?: 'chat' | 'ancillary'
  /** 外层已有 XProvider 时设为 false */
  wrapXProvider?: boolean
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
  variant = 'chat',
  wrapXProvider = true
}) => {
  const { isDark } = useTheme()
  const themeClass = useAgentMarkdownThemeClass()
  const components = useAgentMarkdownComponents()
  const streaming = useMemo(() => buildAgentStreamingOptions(isStreaming), [isStreaming])
  const escapeRawHtml = useMemo(() => !CUSTOM_THINK_TAG_PATTERN.test(content), [content])
  const xProviderTheme = useMemo(
    () => ({
      algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm
    }),
    [isDark]
  )

  if (plainText) {
    return <div className={`${styles.plainText} ${className ?? ''}`}>{content}</div>
  }

  const variantClass = variant === 'ancillary' ? styles.ancillary : styles.root

  const markdown = (
    <XMarkdown
      content={content}
      config={agentMarkedConfig}
      className={`x-markdown ${themeClass} ${variantClass} ${className ?? ''}`}
      escapeRawHtml={escapeRawHtml}
      openLinksInNewTab
      protectCustomTagNewlines
      paragraphTag="div"
      streaming={streaming}
      components={components}
    />
  )

  if (!wrapXProvider) {
    return markdown
  }

  return <XProvider theme={xProviderTheme}>{markdown}</XProvider>
}
