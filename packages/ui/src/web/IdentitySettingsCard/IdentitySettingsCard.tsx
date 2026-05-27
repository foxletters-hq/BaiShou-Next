import React from 'react'
import { useTranslation } from 'react-i18next'
import type { IdentitySettingsCardProps } from './identity-settings.types'
import { useIdentitySettingsCard } from './useIdentitySettingsCard'
import { IdentitySettingsHeader } from './IdentitySettingsHeader'
import { IdentityPersonaChips } from './IdentityPersonaChips'
import { IdentityFactsList } from './IdentityFactsList'
import { IdentityFactEditModal } from './IdentityFactEditModal'
import styles from './IdentitySettingsCard.module.css'

export type { UserProfileConfig, IdentitySettingsCardProps } from './identity-settings.types'

export const IdentitySettingsCard: React.FC<IdentitySettingsCardProps> = ({
  profile,
  onChange
}) => {
  const { t } = useTranslation()
  const card = useIdentitySettingsCard({ profile, onChange })

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

          <IdentityFactsList
            currentFacts={card.currentFacts}
            onAddFact={card.handleAddFact}
            onEditFact={card.startEdit}
            onDeleteFact={card.handleDeleteFact}
          />
        </div>
      </div>

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
    </div>
  )
}
