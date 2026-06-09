import React from 'react'
import { CollapsibleHeight } from './CollapsibleHeight'
import type { CollapsibleHeightAnimation } from './CollapsibleHeight'

export interface AnimatedCollapseProps {
  expanded: boolean
  children: React.ReactNode
  animation?: CollapsibleHeightAnimation
  durationMs?: number
}

/** MCP 开关等：局部高度展开，对齐 ThinkingBlock 的 ease 动画 */
export const AnimatedCollapse: React.FC<AnimatedCollapseProps> = ({
  animation = 'ease',
  durationMs = 300,
  ...props
}) => <CollapsibleHeight animation={animation} durationMs={durationMs} {...props} />
