import React from 'react'
import { CollapsibleHeight } from './CollapsibleHeight'

export interface AnimatedCollapseProps {
  expanded: boolean
  children: React.ReactNode
}

/** MCP 开关等：局部滑动展开，不牵动整页布局 */
export const AnimatedCollapse: React.FC<AnimatedCollapseProps> = (props) => (
  <CollapsibleHeight {...props} />
)
