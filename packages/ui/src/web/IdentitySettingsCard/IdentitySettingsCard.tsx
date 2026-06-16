import React from 'react'
import { useTranslation } from 'react-i18next'
import type { IdentitySettingsCardProps } from './identity-settings.types'
import { useIdentitySettingsCard } from './useIdentitySettingsCard'
import { IdentitySettingsHeader } from './IdentitySettingsHeader'
import { IdentityPersonaChips } from './IdentityPersonaChips'
import { IdentitySettingsPersonaSection } from './IdentitySettingsPersonaSection'
import { IdentityFactsList } from './IdentityFactsList'
import { IdentityFactEditModal } from './IdentityFactEditModal'
import { MdBadge } from 'react-icons/md'
import { SettingsExpansionTile } from '../shared/SettingsExpansionTile'
import styles from './IdentitySettingsCard.module.css'

export type { UserProfileConfig, IdentitySettingsCardProps } from './identity-settings.types'

export const IdentitySettingsCard: React.FC<IdentitySettingsCardProps> = ({
  profile,
  onChange,
  embedded = false,
  isLast = false,
  onManageIdentity
}) => {
  const { t } = useTranslation()
  const card = useIdentitySettingsCard({ profile, onChange })

  const factsBody = (
    <>
      <IdentityFactsList
        currentFacts={card.currentFacts}
        onAddFact={card.handleAddFact}
        onEditFact={card.startEdit}
        onDeleteFact={card.handleDeleteFact}
      />
      <IdentityFactEditModal
        isOpen={card.isFactModalOpen}
        editingKey={card.editingKey}
        editKeyInput={card.editKeyInput}
        editValInput={card.editValInput}
        onKeyChange={card.setEditKeyInput}
        onValueChange={card.setEditValInput}
        onSave={card.saveEdit}
        onClose={() => card.setIsFactModalOpen(false)}
      />
    </>
  )

  if (embedded) {
    return (
      <SettingsExpansionTile
        embedded
        isLast={isLast}
        icon={<MdBadge size={24} />}
        title={t('settings.identity_card')}
        subtitle={t('settings.identity_current_named', { name: card.activeId })}
      >
        <div className={styles.embeddedQuickSwitchBlock}>
          <span className={styles.embeddedQuickSwitchHint}>
            {t('settings.identity_recent_hint')}
          </span>
          <div className={styles.embeddedQuickSwitchRow}>
            <IdentitySettingsPersonaSection
              activeId={card.activeId}
              allPersonas={card.allPersonas}
              recentPersonaIds={profile.recentPersonaIds}
              onSwitch={card.handleSwitch}
            />
            <button
              type="button"
              className={styles.identityManageButton}
              onClick={() => onManageIdentity?.()}
              disabled={!onManageIdentity}
            >
              {t('settings.manage_identity_cards')}
            </button>
          </div>
        </div>
        {factsBody}
      </SettingsExpansionTile>
    )
  }

  return (
    <div className={styles.flutterCardContainer}>
      <IdentitySettingsHeader
        factCount={Object.keys(card.currentFacts).length}
        collapsed={card.collapsed}
        onToggle={() => card.setCollapsed(!card.collapsed)}
      />

      <div className={`${styles.collapseWrapper} ${card.collapsed ? '' : styles.collapseOpen}`}>
        <div className={styles.collapseInner}>
          <div className={styles.descriptionText}>
            {t('settings.identity_card_desc', '助手将自动结合这些核心词条构筑角色认知与您对话。')}
          </div>

          <IdentityPersonaChips
            allPersonas={card.allPersonas}
            activeId={card.activeId}
            onSwitch={card.handleSwitch}
            onAddPersona={card.handleAddPersona}
            onDeletePersona={card.handleDeletePersona}
          />

          {factsBody}
        </div>
      </div>
    </div>
  )
}
