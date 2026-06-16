import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  getAssistantKindBadgeTheme,
  getAssistantKindLabelKey,
  type AssistantKind
} from '@baishou/shared'

export interface AssistantKindBadgeProps {
  kind?: AssistantKind | string | null
  compact?: boolean
}

export const AssistantKindBadge: React.FC<AssistantKindBadgeProps> = ({ kind, compact }) => {
  const { t } = useTranslation()
  const theme = getAssistantKindBadgeTheme(kind)

  return (
    <View
      style={[
        styles.badge,
        compact && styles.badgeCompact,
        { backgroundColor: theme.bg }
      ]}
    >
      <Text style={[styles.text, compact && styles.textCompact, { color: theme.text }]}>
        {t(getAssistantKindLabelKey(kind))}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start'
  },
  badgeCompact: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4
  },
  text: {
    fontSize: 11,
    fontWeight: '700'
  },
  textCompact: {
    fontSize: 10
  }
})
