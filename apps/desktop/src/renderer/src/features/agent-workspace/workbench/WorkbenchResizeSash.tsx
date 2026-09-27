import React from 'react'
import styles from './WorkbenchResizeSash.module.css'

export type WorkbenchSashLimit = 'free' | 'min' | 'max' | 'locked'

export interface WorkbenchResizeSashProps {
  onMouseDown: (event: React.MouseEvent) => void
  ariaLabel: string
  orientation?: 'vertical' | 'horizontal'
  /** 面板变宽的方向。到最大宽度时只允许往反方向拖。 */
  growDirection?: 'right' | 'left'
  limit?: WorkbenchSashLimit
}

/** 分割条：默认竖向调宽度，horizontal 用于上下分区调高度 */
export const WorkbenchResizeSash: React.FC<WorkbenchResizeSashProps> = ({
  onMouseDown,
  ariaLabel,
  orientation = 'vertical',
  growDirection = 'right',
  limit = 'free'
}) => {
  const horizontal = orientation === 'horizontal'
  const limitClass =
    limit === 'locked'
      ? styles.sashLocked
      : limit === 'max'
        ? growDirection === 'left'
          ? styles.sashAtMaxLeft
          : styles.sashAtMaxRight
        : limit === 'min'
          ? growDirection === 'left'
            ? styles.sashAtMinLeft
            : styles.sashAtMinRight
          : ''
  return (
    <div
      className={`${horizontal ? styles.sashHorizontal : styles.sash} ${limitClass}`}
      role="separator"
      aria-orientation={horizontal ? 'horizontal' : 'vertical'}
      aria-label={ariaLabel}
      onMouseDown={onMouseDown}
    />
  )
}
