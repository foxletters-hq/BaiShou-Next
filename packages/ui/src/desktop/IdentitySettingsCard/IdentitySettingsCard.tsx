import React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, IdCard } from 'lucide-react'
import type { IdentitySettingsCardProps } from './identity-settings.types'
import '../shared/SettingsListTile.css'
import styles from './IdentitySettingsCard.module.css'

export type { UserProfileConfig, IdentitySettingsCardProps } from './identity-settings.types'

export const IdentitySettingsCard: React.FC<IdentitySettingsCardProps> = ({
  profile,
  embedded = false,
  onManageIdentity
}) => {
  const { t } = useTranslation()
  const activeId = profile.activePersonaId || ''

  return (
    <button
      type="button"
      className={`settings-list-tile ${embedded ? styles.embeddedNav : ''}`}
      onClick={() => onManageIdentity?.()}
      disabled={!onManageIdentity}
    >
      <div className="settings-list-tile-leading">
        <IdCard size={20} />
      </div>
      <div className="settings-list-tile-content">
        <span className="settings-list-tile-title">{t('settings.identity_card')}</span>
        <span className="settings-list-tile-subtitle">
          {t('settings.identity_current_named', { name: activeId })}
        </span>
      </div>
      <ChevronRight size={22} className="settings-list-tile-trailing" />
    </button>
  )
}
