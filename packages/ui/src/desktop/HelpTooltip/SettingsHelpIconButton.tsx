import React from 'react'
import { CircleHelp } from 'lucide-react'
import { HELP_ICON_SIZE } from '../../shared/icons/icon-sizes'
import { mergeSettingsHelpButtonHandlers } from '../shared/settingsInlineHelpBlock'
import styles from './SettingsHelpIcon.module.css'

export interface SettingsHelpIconButtonProps {
  /** Accessible name for the control */
  'aria-label': string
  /** 已废弃：问号统一使用 HELP_ICON_SIZE，传入值不会生效。 */
  size?: number
  className?: string
  /** Click opens help (modal / panel). Isolated from settings list rows. */
  onActivate: () => void
}

/**
 * Shared "?" trigger for click-to-open help (modals).
 * Visual SSOT with HelpTooltip (tertiary → primary).
 */
export const SettingsHelpIconButton: React.FC<SettingsHelpIconButtonProps> = ({
  'aria-label': ariaLabel,
  size: _size,
  className = '',
  onActivate
}) => (
  <button
    type="button"
    className={`${styles.helpBtn} ${className}`.trim()}
    aria-label={ariaLabel}
    {...mergeSettingsHelpButtonHandlers(() => {
      onActivate()
    })}
  >
    <CircleHelp size={HELP_ICON_SIZE} className={styles.helpIcon} aria-hidden />
  </button>
)
