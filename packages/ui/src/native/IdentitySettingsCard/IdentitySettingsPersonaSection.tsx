import React from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'

export interface IdentitySettingsPersonaSectionProps {
  activeId: string
  allPersonas: Record<string, { id: string; facts: Record<string, string> }>
  onSwitch: (pid: string) => void
  onAddPersona: () => void
  onDeletePersona: (pid: string) => void
}

export const IdentitySettingsPersonaSection: React.FC<IdentitySettingsPersonaSectionProps> = ({
  activeId,
  allPersonas,
  onSwitch,
  onAddPersona,
  onDeletePersona
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  return (
    <>
      <Text
        style={{
          fontSize: 14,
          color: colors.textSecondary,
          marginBottom: tokens.spacing.md
        }}
      >
        {t('settings.identity_card_desc', '助手将自动结合这些核心词条构筑角色认知与您对话。')}
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: tokens.spacing.md }}
      >
        <View style={{ flexDirection: 'row', gap: tokens.spacing.sm }}>
          {Object.keys(allPersonas).map((pid) => {
            const isActive = pid === activeId
            return (
              <Pressable
                key={pid}
                onPress={() => onSwitch(pid)}
                onLongPress={() => onDeletePersona(pid)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: tokens.spacing.md,
                  paddingVertical: tokens.spacing.sm,
                  borderRadius: tokens.radius.full,
                  backgroundColor: isActive ? colors.primary : colors.bgSurfaceNormal,
                  opacity: pressed ? 0.7 : 1,
                  gap: tokens.spacing.xs
                })}
              >
                <Text
                  style={{
                    fontSize: 14,
                    color: isActive ? colors.onPrimary : colors.textPrimary,
                    fontWeight: isActive ? '600' : '400'
                  }}
                >
                  {pid}
                </Text>
                {isActive && Object.keys(allPersonas).length > 1 && (
                  <Pressable onPress={() => onDeletePersona(pid)}>
                    <Text
                      style={{
                        fontSize: 14,
                        color: isActive ? colors.onPrimary : colors.textSecondary
                      }}
                    >
                      ×
                    </Text>
                  </Pressable>
                )}
              </Pressable>
            )
          })}
          <Pressable
            onPress={onAddPersona}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: tokens.spacing.md,
              paddingVertical: tokens.spacing.sm,
              borderRadius: tokens.radius.full,
              borderWidth: 1,
              borderColor: colors.primary,
              borderStyle: 'dashed',
              opacity: pressed ? 0.7 : 1,
              gap: tokens.spacing.xs
            })}
          >
            <Text style={{ fontSize: 14, color: colors.primary }}>+</Text>
            <Text style={{ fontSize: 14, color: colors.primary }}>
              {t('settings.new_identity', '新身份')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  )
}
