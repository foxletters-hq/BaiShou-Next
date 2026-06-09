import React from 'react'
import { View, Text, Pressable } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import type { RecallItem } from './recall-dialog.types'

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
          marginBottom: 6
        }}
      >
        <Text
          style={{
            fontSize: 15,
            fontWeight: '700',
            color: colors.textPrimary,
            flex: 1,
            marginRight: tokens.spacing.sm
          }}
          numberOfLines={1}
        >
          {item.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm }}>
          <Text style={{ fontSize: 11, color: colors.textSecondary }}>{item.date}</Text>
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.()
              handlePress()
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={t('common.copy', '复制')}
          >
            <MaterialIcons name="content-copy" size={14} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>
      <Text
        numberOfLines={2}
        style={{
          fontSize: 13,
          color: colors.textSecondary,
          lineHeight: 20
        }}
      >
        {item.snippet}
      </Text>
    </Pressable>
  )
}
