import React from 'react'
import { View, Text, Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import type { NativeIdentitySettingsCardProps } from './identity-settings.types'
import { useIdentitySettings } from './useIdentitySettings'
import { IdentitySettingsPersonaSection } from './IdentitySettingsPersonaSection'
import { IdentitySettingsFactsSection } from './IdentitySettingsFactsSection'
import { IdentitySettingsFactModal } from './IdentitySettingsFactModal'

export const IdentitySettingsCard: React.FC<NativeIdentitySettingsCardProps> = (props) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const settings = useIdentitySettings(props)

  return (
    <View
      style={{
        backgroundColor: colors.bgSurface,
        borderRadius: tokens.radius.lg,
        overflow: 'hidden'
      }}
    >
      <Pressable
        onPress={() => settings.setCollapsed(!settings.collapsed)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          padding: tokens.spacing.lg,
          gap: tokens.spacing.sm,
          opacity: pressed ? 0.7 : 1
        })}
      >
        <Text style={{ fontSize: 20 }}>🪪</Text>
        <Text
          style={{
            flex: 1,
            fontSize: 16,
            fontWeight: '600',
            color: colors.textPrimary
          }}
        >
          {t('settings.identity_card', '身份卡')}
        </Text>
        <View
          style={{
            backgroundColor: colors.primaryContainer,
            borderRadius: tokens.radius.full,
            paddingHorizontal: 8,
            paddingVertical: 2
          }}
        >
          <Text
            style={{
              fontSize: 12,
              color: colors.onPrimaryContainer
            }}
          >
            {Object.keys(settings.currentFacts).length}{' '}
            {t('settings.identity_entry_count_suffix', '条')}
          </Text>
        </View>
        <Text style={{ fontSize: 16, color: colors.textSecondary }}>
          {settings.collapsed ? '▼' : '▲'}
        </Text>
      </Pressable>

      {!settings.collapsed && (
        <View
          style={{
            paddingHorizontal: tokens.spacing.lg,
            paddingBottom: tokens.spacing.lg
          }}
        >
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
        </View>
      )}

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
    </View>
  )
}
