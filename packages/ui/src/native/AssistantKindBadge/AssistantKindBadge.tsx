import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { mobileTypography, sharedTokens } from '../../theme/tokens'
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
    <View style={[styles.badge, compact && styles.badgeCompact, { backgroundColor: theme.bg }]}>
      <Text style={[styles.text, compact && styles.textCompact, { color: theme.text }]}>
        {t(getAssistantKindLabelKey(kind))}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: sharedTokens.spacing.sm,
    paddingVertical: sharedTokens.spacing.xxs,
    borderRadius: sharedTokens.radius.xsPlus,
    alignSelf: 'flex-start'
  },
  badgeCompact: {
    paddingHorizontal: sharedTokens.spacing.xsPlus,
    paddingVertical: 1,
    borderRadius: sharedTokens.radius.xs
  },
  text: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600'
  },
  textCompact: {
    fontSize: mobileTypography.caption.fontSize
  }
})
