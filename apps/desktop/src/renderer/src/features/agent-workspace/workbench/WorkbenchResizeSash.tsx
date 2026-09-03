import React from 'react'
import styles from './WorkbenchResizeSash.module.css'

export interface WorkbenchResizeSashProps {
  onMouseDown: (event: React.MouseEvent) => void
  ariaLabel: string
  orientation?: 'vertical' | 'horizontal'
}

/** 分割条：默认竖向调宽度，horizontal 用于上下分区调高度 */
export const WorkbenchResizeSash: React.FC<WorkbenchResizeSashProps> = ({
  onMouseDown,
  ariaLabel,
  orientation = 'vertical'
}) => {
  const horizontal = orientation === 'horizontal'
  return (
    <div
      className={horizontal ? styles.sashHorizontal : styles.sash}
      role="separator"
      aria-orientation={horizontal ? 'horizontal' : 'vertical'}
      aria-label={ariaLabel}
      onMouseDown={onMouseDown}
    />
  )
}
