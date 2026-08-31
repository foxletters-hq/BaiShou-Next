import React, { useMemo } from 'react'
import type { MockToolInvocation } from '@baishou/shared'
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
  activeToolArgs?: unknown
  isStreaming?: boolean
  /** 是否默认展开有内容的工具节点（默认否） */
  defaultExpanded?: boolean
}

export const AgentToolChainSection: React.FC<AgentToolChainSectionProps> = ({
  invocations = [],
  completedTools = [],
  activeToolName = null,
  activeToolArgs,
  isStreaming: _isStreaming = false,
  defaultExpanded = false
}) => {
  const models = useMemo(
    () =>
      buildAgentToolChainItems({
        invocations,
        completedTools,
        activeToolName,
        activeToolArgs,
        isToolError: isToolResultError
      }),
    [invocations, completedTools, activeToolName, activeToolArgs]
  )

  if (models.length === 0) return null

  return (
    <div className={styles.root}>
      {models.map((model) => (
        <AgentToolThinkItem
          key={model.key}
          model={model}
          autoExpand={defaultExpanded && model.hasContent}
        />
      ))}
    </div>
  )
}
