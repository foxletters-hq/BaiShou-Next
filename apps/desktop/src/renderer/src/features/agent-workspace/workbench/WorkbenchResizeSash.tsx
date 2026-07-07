import React from 'react'
import styles from './WorkbenchResizeSash.module.css'

export interface WorkbenchResizeSashProps {
  onMouseDown: (event: React.MouseEvent) => void
  ariaLabel: string
}

/** VS Code 风格垂直分割条（sash） */
export const WorkbenchResizeSash: React.FC<WorkbenchResizeSashProps> = ({
  onMouseDown,
  ariaLabel
}) => {
  return (
    <div
      className={styles.sash}
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      onMouseDown={onMouseDown}
    />
  )
}
