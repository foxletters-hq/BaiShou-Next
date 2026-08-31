import React from 'react'
import { CircleHelp } from 'lucide-react'
import { HELP_ICON_SIZE } from '../../shared/icons/icon-sizes'
import { Tooltip } from '../Tooltip/Tooltip'
import styles from './SettingsHelpIcon.module.css'

export interface HelpTooltipProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'content'> {
  content: React.ReactNode
  /** 已废弃：问号统一使用 HELP_ICON_SIZE，传入值不会生效。 */
  size?: number
  tooltipClassName?: string
}

/** Hover "?" help icon — shares icon colors with SettingsHelpIconButton. */
export const HelpTooltip: React.FC<HelpTooltipProps> = ({
  content,
  size: _size,
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
      <CircleHelp size={HELP_ICON_SIZE} className={styles.helpIcon} aria-hidden />
    </Tooltip>
  )
}
