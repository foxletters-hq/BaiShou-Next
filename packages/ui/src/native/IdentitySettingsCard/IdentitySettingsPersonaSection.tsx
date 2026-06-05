import React, { useMemo } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { settingsHubListStyles as hubStyles } from '../settings/settings-hub.styles'
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
    <View
      style={[
        styles.list,
        { borderColor: colors.borderStrong, backgroundColor: colors.bgSurfaceNormal }
      ]}
    >
      {switchIds.map((pid, index) => {
        const isActive = pid === activeId
        const isLast = index === switchIds.length - 1
        return (
          <Pressable
            key={pid}
            onPress={() => {
              if (!isActive) onSwitch(pid)
            }}
            disabled={isActive}
            style={({ pressed }) => [
              styles.row,
              !isLast && {
                borderBottomWidth: 1,
                borderBottomColor: colors.borderStrong
              },
              !isActive && pressed && { opacity: 0.7 }
            ]}
          >
            <Text
              style={[
                hubStyles.rowTitle,
                { color: isActive ? colors.primary : colors.textPrimary, flex: 1 }
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
  list: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 12
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 11
  },
  activeMark: {
    fontSize: 12,
    fontWeight: '600'
  }
})
