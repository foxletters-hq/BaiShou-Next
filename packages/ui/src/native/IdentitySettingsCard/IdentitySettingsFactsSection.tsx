import React from 'react'
import { View, Text, Pressable } from 'react-native'
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
        backgroundColor: colors.bgSurfaceNormal,
        borderRadius: tokens.radius.md,
        overflow: 'hidden'
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
          <Text style={{ fontSize: 14, color: colors.primary }}>+</Text>
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
          <Text style={{ fontSize: 32, opacity: 0.3 }}>👤</Text>
          <Text
            style={{
              fontSize: 14,
              color: colors.textSecondary,
              textAlign: 'center'
            }}
          >
            {t(
              'settings.identity_card_empty_hint',
              '当前身份为空白，不妨添加一些基本特征描述吧。'
            )}
          </Text>
        </View>
      ) : (
        Object.entries(currentFacts).map(([k, v]) => (
          <View
            key={k}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: tokens.spacing.sm,
              borderBottomWidth: 1,
              borderBottomColor: colors.borderSubtle,
              gap: tokens.spacing.sm
            }}
          >
            <Text style={{ fontSize: 14 }}>🏷️</Text>
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
              <Text style={{ fontSize: 14, color: colors.primary }}>✎</Text>
            </Pressable>
            <Pressable onPress={() => onDeleteFact(k)} style={{ padding: 4 }}>
              <Text style={{ fontSize: 14, color: colors.error }}>🗑️</Text>
            </Pressable>
          </View>
        ))
      )}
    </View>
  )
}
