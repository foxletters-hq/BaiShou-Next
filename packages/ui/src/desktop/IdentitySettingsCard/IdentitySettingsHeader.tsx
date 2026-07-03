import React from 'react'
import { useTranslation } from 'react-i18next'
import styles from './IdentitySettingsCard.module.css'
import { ChevronDown, IdCard } from 'lucide-react'

interface IdentitySettingsHeaderProps {
  factCount: number
  collapsed: boolean
  onToggle: () => void
}

export const IdentitySettingsHeader: React.FC<IdentitySettingsHeaderProps> = ({
  factCount,
  collapsed,
  onToggle
}) => {
  const { t } = useTranslation()

  return (
    <div className={`${styles.headerRow} ${styles.headerRowHover}`} onClick={onToggle}>
      <div className={styles.headerTitleGroup} style={{ flex: 1 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flex: 1
          }}
        >
          <IdCard size={20} className={styles.primaryIcon} />
          <span className={styles.headerText}>{t('settings.identity_card', '身份卡')}</span>
          <span className={styles.headerFactCount}>
            {factCount} {t('settings.identity_entry_count_suffix', '条')}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <ChevronDown
            size={24}
            style={{
              color: 'var(--color-on-surface-variant)',
              transition: 'transform 0.25s',
              transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)',
              flexShrink: 0
            }}
          />
        </div>
      </div>
    </div>
  )
}
