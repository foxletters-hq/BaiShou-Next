import React, { useMemo } from 'react'
import { XProvider } from '@ant-design/x'
import { theme } from 'antd'
import type { MockToolInvocation } from '@baishou/shared'
import { useTheme } from '../../hooks/useTheme'
import {
  buildAgentToolChainItems,
  type AgentToolChainStreamingTool
} from '../../shared/agent-tool-chain'
import { isToolResultError } from '../../shared/tool-result.util'
import { AgentToolThinkItem } from './AgentToolThinkItem'
import styles from './AgentToolChainSection.module.css'

export interface AgentToolChainSectionProps {
  invocations?: MockToolInvocation[]
  completedTools?: AgentToolChainStreamingTool[]
  activeToolName?: string | null
  /** 流式场景：自动展开进行中的工具节点 */
  isStreaming?: boolean
  /** 流式场景：自动展开已有内容的工具节点 */
  defaultExpanded?: boolean
}

export const AgentToolChainSection: React.FC<AgentToolChainSectionProps> = ({
  invocations = [],
  completedTools = [],
  activeToolName = null,
  isStreaming = false,
  defaultExpanded = false
}) => {
  const { isDark } = useTheme()

  const models = useMemo(
    () =>
      buildAgentToolChainItems({
        invocations,
        completedTools,
        activeToolName,
        isToolError: isToolResultError
      }),
    [invocations, completedTools, activeToolName]
  )

  const xProviderTheme = useMemo(
    () => ({
      algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm
    }),
    [isDark]
  )

  if (models.length === 0) return null

  return (
    <XProvider theme={xProviderTheme}>
      <div className={styles.root}>
        {models.map((model) => (
          <AgentToolThinkItem
            key={model.key}
            model={model}
            autoExpand={
              (isStreaming && model.status === 'loading') ||
              (defaultExpanded && model.hasContent)
            }
          />
        ))}
      </div>
    </XProvider>
  )
}
