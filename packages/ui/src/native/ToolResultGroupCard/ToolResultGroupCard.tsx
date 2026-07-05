import React from 'react'
import { AgentToolChainSection } from '../AgentToolChain'
import type { AgentToolChainStreamingTool } from '../../shared/agent-tool-chain'
import type { ToolInvocationLike } from '../../shared/tool-result.util'

export interface ToolResultGroupCardProps {
  invocations?: ToolInvocationLike[]
  completedTools?: AgentToolChainStreamingTool[]
  activeToolName?: string | null
  defaultExpanded?: boolean
}

/** @deprecated 使用 AgentToolChainSection；保留导出名以兼容现有引用 */
export const ToolResultGroupCard: React.FC<ToolResultGroupCardProps> = ({
  invocations = [],
  completedTools = [],
  activeToolName = null,
  defaultExpanded = false
}) => {
  return (
    <AgentToolChainSection
      invocations={invocations}
      completedTools={completedTools}
      activeToolName={activeToolName}
      isStreaming={Boolean(activeToolName)}
      defaultExpanded={defaultExpanded}
    />
  )
}
