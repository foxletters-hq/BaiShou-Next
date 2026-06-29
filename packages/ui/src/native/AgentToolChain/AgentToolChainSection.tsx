import React, { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import {
  buildAgentToolChainItems,
  type AgentToolChainStreamingTool
} from '../../shared/agent-tool-chain'
import { isToolResultError, type ToolInvocationLike } from '../../shared/tool-result.util'
import { AgentToolThinkItem } from './AgentToolThinkItem'

export interface AgentToolChainSectionProps {
  invocations?: ToolInvocationLike[]
  completedTools?: AgentToolChainStreamingTool[]
  activeToolName?: string | null
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

  if (models.length === 0) return null

  return (
    <View style={styles.root}>
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
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    marginBottom: 8,
    gap: 2
  }
})
