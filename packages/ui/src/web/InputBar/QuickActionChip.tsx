import React from 'react'
import styles from './InputBar.module.css'

export interface QuickActionChipProps {
  icon: React.ReactNode
  label: string
  onClick?: () => void
  isActive?: boolean
}

export const QuickActionChip: React.FC<QuickActionChipProps> = ({
  icon,
  label,
  onClick,
  isActive = false
}) => (
  <button
    className={`${styles.quickActionChip} ${isActive ? styles.chipActive : ''}`}
    onClick={onClick}
    type="button"
  >
    <span className={styles.chipIcon}>{icon}</span>
    <span className={styles.chipLabel}>{label}</span>
  </button>
)
