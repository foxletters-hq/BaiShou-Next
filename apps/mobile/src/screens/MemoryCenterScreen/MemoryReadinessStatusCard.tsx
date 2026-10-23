import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { mobileTypography } from '@baishou/ui/theme/tokens'
import { useNativeTheme } from '@baishou/ui/native'
import { memoryVectorMetaLine } from './memory-center-readiness-copy.util'

export function MemoryReadinessStatusCard(props: {
  vectorCount: number
  dimension: number
  organizingLine?: string
  onPress: () => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('common.settings', '设置')}
      onPress={props.onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: tokens.spacing.xs
        }}
      >
        <Text
          style={{
            flex: 1,
            color: colors.textPrimary,
            fontSize: mobileTypography.primary.fontSize,
            fontWeight: mobileTypography.primary.fontWeight
          }}
        >
          {t('common.settings', '设置')}
        </Text>
        <Text
          style={{
            color: colors.textTertiary,
            fontSize: mobileTypography.primary.fontSize
          }}
        >
          ›
        </Text>
      </View>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: mobileTypography.secondary.fontSize,
          fontWeight: mobileTypography.secondary.fontWeight
        }}
      >
        {memoryVectorMetaLine(props.vectorCount, props.dimension, t)}
      </Text>
      {props.organizingLine ? (
        <Text
          style={{
            color: colors.textTertiary,
            fontSize: mobileTypography.secondary.fontSize,
            fontWeight: mobileTypography.secondary.fontWeight,
            marginTop: tokens.spacing.xs
          }}
        >
          {props.organizingLine}
        </Text>
      ) : null}
    </Pressable>
  )
}
