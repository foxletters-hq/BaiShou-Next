import React from 'react'
import { CircleHelp } from 'lucide-react'
import { mergeSettingsHelpButtonHandlers } from '../shared/settingsInlineHelpBlock'
import styles from './SettingsHelpIcon.module.css'

export interface SettingsHelpIconButtonProps {
  /** Accessible name for the control */
  'aria-label': string
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
  size = 16,
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
    <CircleHelp size={size} className={styles.helpIcon} aria-hidden />
  </button>
)
