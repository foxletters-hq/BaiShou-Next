import React from 'react'
import { useTranslation } from 'react-i18next'
import { MdClose, MdAdd } from 'react-icons/md'
import styles from './IdentitySettingsCard.module.css'

interface IdentityPersonaChipsProps {
  allPersonas: Record<string, { id: string; facts: Record<string, string> }>
  activeId: string
  onSwitch: (pid: string) => void
  onAddPersona: () => void
  onDeletePersona: (pid: string, e: React.MouseEvent) => void
}

export const IdentityPersonaChips: React.FC<IdentityPersonaChipsProps> = ({
  allPersonas,
  activeId,
  onSwitch,
  onAddPersona,
  onDeletePersona
}) => {
  const { t } = useTranslation()

  return (
    <div className={styles.chipsScrollArea}>
      <div className={styles.chipsContainer}>
        {Object.keys(allPersonas).map((pid) => {
          const isActive = pid === activeId
          return (
            <div
              key={pid}
              className={`${styles.inputChip} ${isActive ? styles.inputChipActive : ''}`}
              onClick={() => onSwitch(pid)}
            >
              <span>{pid}</span>
              {isActive && Object.keys(allPersonas).length > 1 && (
                <button className={styles.chipCloseBtn} onClick={(e) => onDeletePersona(pid, e)}>
                  <MdClose size={14} />
                </button>
              )}
            </div>
          )
        })}
        <div className={styles.actionChip} onClick={onAddPersona}>
          <MdAdd size={16} />
          <span>{t('settings.new_identity', '新身份')}</span>
        </div>
      </div>
    </div>
  )
}
