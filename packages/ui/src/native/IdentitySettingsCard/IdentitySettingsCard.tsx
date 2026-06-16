import React from 'react'
import { View, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { NativeIdentitySettingsCardProps } from './identity-settings.types'
import { useIdentitySettings } from './useIdentitySettings'
import { IdentitySettingsPersonaSection } from './IdentitySettingsPersonaSection'
import { IdentitySettingsFactsSection } from './IdentitySettingsFactsSection'
import { IdentitySettingsFactModal } from './IdentitySettingsFactModal'
import { SettingsExpansionTile } from '../settings/SettingsExpansionTile'
import { CardLinkAction } from '../Button'

export const IdentitySettingsCard: React.FC<NativeIdentitySettingsCardProps> = ({
  embedded = false,
  isLast = false,
  onManageIdentity,
  ...props
}) => {
  const { t } = useTranslation()
  const settings = useIdentitySettings(props)

  const body = (
    <>
      <IdentitySettingsPersonaSection
        activeId={settings.activeId}
        allPersonas={settings.allPersonas}
        recentPersonaIds={props.profile.recentPersonaIds}
        onSwitch={settings.handleSwitch}
      />
      <IdentitySettingsFactsSection
        currentFacts={settings.currentFacts}
        onAddFact={settings.handleAddFact}
        onStartEdit={settings.startEdit}
        onDeleteFact={settings.handleDeleteFact}
      />
      <CardLinkAction
        variant="card"
        style={styles.manageLink}
        onPress={() => onManageIdentity?.()}
        isDisabled={!onManageIdentity}
      >
        {t('settings.manage_identity_cards')}
      </CardLinkAction>
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
      title={t('settings.identity_card')}
      subtitle={
        embedded
          ? t('settings.identity_current_named', { name: settings.activeId })
          : `${Object.keys(settings.currentFacts).length} ${t('settings.identity_entry_count_suffix', '条')}`
      }
    >
      {embedded ? body : <View>{body}</View>}
    </SettingsExpansionTile>
  )
}

const styles = StyleSheet.create({
  manageLink: {
    marginTop: 12
  }
})
