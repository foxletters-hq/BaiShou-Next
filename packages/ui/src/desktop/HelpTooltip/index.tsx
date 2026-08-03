import React from 'react'
import { CircleHelp } from 'lucide-react'
import { Tooltip } from '../Tooltip/Tooltip'
import styles from './SettingsHelpIcon.module.css'

export interface HelpTooltipProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'content'> {
  content: React.ReactNode
  size?: number
  tooltipClassName?: string
}

/** Hover "?" help icon — shares icon colors with SettingsHelpIconButton. */
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
      className={`${styles.helpHost} ${className}`.trim()}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      {...props}
    >
      <CircleHelp size={size} className={styles.helpIcon} aria-hidden />
    </Tooltip>
  )
}
