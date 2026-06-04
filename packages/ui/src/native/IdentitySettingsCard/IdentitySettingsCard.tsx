import React from 'react'
import { View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { NativeIdentitySettingsCardProps } from './identity-settings.types'
import { useIdentitySettings } from './useIdentitySettings'
import { IdentitySettingsPersonaSection } from './IdentitySettingsPersonaSection'
import { IdentitySettingsFactsSection } from './IdentitySettingsFactsSection'
import { IdentitySettingsFactModal } from './IdentitySettingsFactModal'
import { SettingsExpansionTile } from '../settings/SettingsExpansionTile'

export const IdentitySettingsCard: React.FC<NativeIdentitySettingsCardProps> = ({
  embedded = false,
  isLast = false,
  ...props
}) => {
  const { t } = useTranslation()
  const settings = useIdentitySettings(props)

  const body = (
    <>
      <IdentitySettingsPersonaSection
        activeId={settings.activeId}
        allPersonas={settings.allPersonas}
        onSwitch={settings.handleSwitch}
        onAddPersona={settings.handleAddPersona}
        onDeletePersona={settings.handleDeletePersona}
      />
      <IdentitySettingsFactsSection
        currentFacts={settings.currentFacts}
        onAddFact={settings.handleAddFact}
        onStartEdit={settings.startEdit}
        onDeleteFact={settings.handleDeleteFact}
      />
      <IdentitySettingsFactModal
        visible={settings.isFactModalOpen}
        editingKey={settings.editingKey}
        editKeyInput={settings.editKeyInput}
        editValInput={settings.editValInput}
        onEditKeyChange={settings.setEditKeyInput}
        onEditValChange={settings.setEditValInput}
        onClose={() => settings.setIsFactModalOpen(false)}
        onSave={settings.saveEdit}
      />
    </>
  )

  return (
    <SettingsExpansionTile
      embedded={embedded}
      isLast={isLast}
      title={t('settings.identity_card', '身份卡')}
      subtitle={
        embedded
          ? undefined
          : `${Object.keys(settings.currentFacts).length} ${t('settings.identity_entry_count_suffix', '条')}`
      }
    >
      {embedded ? body : <View>{body}</View>}
    </SettingsExpansionTile>
  )
}
