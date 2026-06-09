import React from 'react'
import { View, Text, Pressable } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'

export interface IdentitySettingsFactsSectionProps {
  currentFacts: Record<string, string>
  onAddFact: () => void
  onStartEdit: (k: string, v: string) => void
  onDeleteFact: (k: string) => void
}

export const IdentitySettingsFactsSection: React.FC<IdentitySettingsFactsSectionProps> = ({
  currentFacts,
  onAddFact,
  onStartEdit,
  onDeleteFact
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  return (
    <View
      style={{
        borderRadius: tokens.radius.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.borderSubtle
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: tokens.spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderSubtle
        }}
      >
        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: colors.textPrimary
          }}
        >
          {t('settings.identity_facts_title', '身份条目')}
        </Text>
        <Pressable
          onPress={onAddFact}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            opacity: pressed ? 0.7 : 1
          })}
        >
          <MaterialIcons name="add" size={16} color={colors.primary} />
          <Text style={{ fontSize: 14, color: colors.primary }}>
            {t('settings.add_identity_entry', '添加条目')}
          </Text>
        </Pressable>
      </View>

      {Object.keys(currentFacts).length === 0 ? (
        <View
          style={{
            padding: tokens.spacing.lg,
            alignItems: 'center',
            gap: tokens.spacing.sm
          }}
        >
          <MaterialIcons name="person-add-alt" size={32} color={colors.textTertiary} />
          <Text
            style={{
              fontSize: 14,
              color: colors.textSecondary,
              textAlign: 'center'
            }}
          >
            {t('settings.identity_card_empty_hint', '当前身份为空白，不妨添加一些基本特征描述吧。')}
          </Text>
        </View>
      ) : (
        Object.entries(currentFacts).map(([k, v], index, entries) => (
          <View
            key={k}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: tokens.spacing.sm,
              borderBottomWidth: index < entries.length - 1 ? 1 : 0,
              borderBottomColor: colors.borderSubtle,
              gap: tokens.spacing.sm
            }}
          >
            <MaterialIcons name="label" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: colors.textPrimary
                }}
              >
                {k}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: colors.textSecondary
                }}
              >
                {v}
              </Text>
            </View>
            <Pressable onPress={() => onStartEdit(k, v)} style={{ padding: 4 }}>
              <MaterialIcons name="edit" size={18} color={colors.textSecondary} />
            </Pressable>
            <Pressable onPress={() => onDeleteFact(k)} style={{ padding: 4 }}>
              <MaterialIcons name="delete-outline" size={18} color={colors.error} />
            </Pressable>
          </View>
        ))
      )}
    </View>
  )
}
