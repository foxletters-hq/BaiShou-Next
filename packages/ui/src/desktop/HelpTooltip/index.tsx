import React from 'react'
import { MdHelpOutline } from 'react-icons/md'
import { Tooltip } from '../Tooltip/Tooltip'
import styles from './HelpTooltip.module.css'

export interface HelpTooltipProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'content'> {
  content: React.ReactNode
  size?: number
  tooltipClassName?: string
}

/** Glass-style help icon with hover tooltip (same pattern as RAG Memory Manager). */
export const HelpTooltip: React.FC<HelpTooltipProps> = ({
  content,
  size = 16,
  className = '',
  tooltipClassName,
  ...props
}) => {
  if (!content) return null

  return (
    <Tooltip
      content={content}
      tooltipClassName={tooltipClassName}
      className={`${styles.helpTooltip} ${className}`.trim()}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      {...props}
    >
      <MdHelpOutline size={size} className={styles.helpIcon} aria-hidden />
    </Tooltip>
  )
}
