import React from 'react'
import type { MockToolInvocation } from '@baishou/shared'
import { AgentToolChainSection } from '../AgentToolChain'

export interface ToolResultGroupProps {
  invocations: MockToolInvocation[]
}

/** @deprecated 使用 AgentToolChainSection；保留导出名以兼容现有引用 */
export const ToolResultGroup: React.FC<ToolResultGroupProps> = ({ invocations }) => {
  if (!invocations?.length) return null
  return <AgentToolChainSection invocations={invocations} />
}
