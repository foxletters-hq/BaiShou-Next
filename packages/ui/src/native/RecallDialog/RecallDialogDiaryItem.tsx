import React from 'react'
import { View, Text, Pressable } from 'react-native'
import { Copy } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import type { RecallItem } from './recall-dialog.types'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

interface RecallDialogDiaryItemProps {
  item: RecallItem
  onCopy?: (snippet: string) => void
}

export const RecallDialogDiaryItem: React.FC<RecallDialogDiaryItemProps> = ({ item, onCopy }) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  const handlePress = () => {
    onCopy?.(item.snippet)
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => ({
        padding: tokens.spacing.md,
        backgroundColor: colors.bgSurface,
        borderWidth: 1,
        borderColor: colors.borderMuted,
        borderRadius: tokens.radius.lg,
        opacity: pressed ? 0.85 : 1
      })}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: sharedTokens.spacing.xsPlus
        }}
      >
        <Text
          style={{
            fontSize: mobileTypography.body.fontSize,
            fontWeight: '600',
            color: colors.textPrimary,
            flex: 1,
            marginRight: tokens.spacing.sm
          }}
          numberOfLines={1}
        >
          {item.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm }}>
          <Text
            style={{ fontSize: mobileTypography.caption.fontSize, color: colors.textSecondary }}
          >
            {item.date}
          </Text>
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.()
              handlePress()
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={t('common.copy', '复制')}
          >
            <Copy size={14} color={colors.textSecondary} strokeWidth={DEFAULT_STROKE_WIDTH} />
          </Pressable>
        </View>
      </View>
      <Text
        numberOfLines={2}
        style={{
          fontSize: mobileTypography.secondary.fontSize,
          color: colors.textSecondary,
          lineHeight: 20
        }}
      >
        {item.snippet}
      </Text>
    </Pressable>
  )
}
