import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { pickQuickSwitchPersonaIds } from './identity-recent.utils'
import styles from './IdentitySettingsCard.module.css'

export interface IdentitySettingsPersonaSectionProps {
  activeId: string
  allPersonas: Record<string, { id: string; facts: Record<string, string> }>
  recentPersonaIds?: string[]
  onSwitch: (pid: string) => void
}

export const IdentitySettingsPersonaSection: React.FC<IdentitySettingsPersonaSectionProps> = ({
  activeId,
  allPersonas,
  recentPersonaIds,
  onSwitch
}) => {
  const { t } = useTranslation()

  const switchIds = useMemo(
    () => pickQuickSwitchPersonaIds(Object.keys(allPersonas), activeId, recentPersonaIds),
    [activeId, allPersonas, recentPersonaIds]
  )

  if (switchIds.length === 0) return null

  return (
    <div className={`${styles.chipsScrollArea} ${styles.embeddedPersonaChips}`}>
      <div className={styles.chipsContainer}>
        {switchIds.map((pid) => {
          const isActive = pid === activeId
          return (
            <button
              key={pid}
              type="button"
              className={`${styles.inputChip} ${isActive ? styles.inputChipActive : ''}`}
              onClick={() => {
                if (!isActive) onSwitch(pid)
              }}
              disabled={isActive}
            >
              <span>{pid}</span>
              {isActive ? (
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-primary)' }}>
                  {t('settings.identity_active_mark')}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
