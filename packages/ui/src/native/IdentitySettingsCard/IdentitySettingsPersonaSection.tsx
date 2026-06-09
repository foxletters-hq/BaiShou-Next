import React, { useMemo } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { pickQuickSwitchPersonaIds } from './identity-recent.utils'

export interface IdentitySettingsPersonaSectionProps {
  activeId: string
  allPersonas: Record<string, { id: string; facts: Record<string, string> }>
  recentPersonaIds?: string[]
  onSwitch: (pid: string) => void
}

export const IdentitySettingsPersonaSection: React.FC<IdentitySettingsPersonaSectionProps> = ({
  activeId,
  allPersonas,
  recentPersonaIds,
  onSwitch
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  const switchIds = useMemo(
    () => pickQuickSwitchPersonaIds(Object.keys(allPersonas), activeId, recentPersonaIds),
    [activeId, allPersonas, recentPersonaIds]
  )

  if (switchIds.length === 0) return null

  return (
    <View style={styles.chipRow}>
      {switchIds.map((pid) => {
        const isActive = pid === activeId
        return (
          <Pressable
            key={pid}
            onPress={() => {
              if (!isActive) onSwitch(pid)
            }}
            disabled={isActive}
            style={({ pressed }) => [
              styles.chip,
              {
                borderColor: isActive ? colors.primary : colors.borderMuted,
                borderWidth: isActive ? 1.5 : 1,
                backgroundColor: 'transparent'
              },
              !isActive && pressed && { opacity: 0.7 }
            ]}
          >
            <Text
              style={[
                styles.chipText,
                {
                  color: colors.textPrimary,
                  fontWeight: isActive ? '600' : '500'
                }
              ]}
              numberOfLines={1}
            >
              {pid}
            </Text>
            {isActive ? (
              <Text style={[styles.activeMark, { color: colors.primary }]}>
                {t('settings.identity_active_mark', '当前')}
              </Text>
            ) : null}
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 8
  },
  chipText: {
    fontSize: 14,
    maxWidth: 160
  },
  activeMark: {
    fontSize: 11,
    fontWeight: '600'
  }
})
