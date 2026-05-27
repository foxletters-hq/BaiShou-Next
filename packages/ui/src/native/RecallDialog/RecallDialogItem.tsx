import React from 'react'
import { View, Text, Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import type { RecallItem } from './recall-dialog.types'
import { getSimilarityColors } from './recall-dialog.utils'

interface RecallDialogItemProps {
  item: RecallItem
  isSelected: boolean
  onToggle: (id: string) => void
}

export const RecallDialogItem: React.FC<RecallDialogItemProps> = ({
  item,
  isSelected,
  onToggle
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const score = item.similarity
  const sc = getSimilarityColors(score)

  return (
    <Pressable
      onPress={() => onToggle(item.id)}
      style={{
        flexDirection: 'row',
        padding: tokens.spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
        backgroundColor: isSelected ? colors.primaryContainer : 'transparent',
        gap: tokens.spacing.sm
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: isSelected ? colors.primary : colors.outlineVariant,
          backgroundColor: isSelected ? colors.primary : 'transparent',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {isSelected && <Text style={{ color: colors.onPrimary, fontSize: 12 }}>✓</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 4
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: tokens.spacing.xs,
              flex: 1
            }}
          >
            <Text style={{ fontSize: 14 }}>{item.type === 'diary' ? '📖' : '🧠'}</Text>
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: colors.textPrimary,
                flexShrink: 1
              }}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            {sc && score !== undefined && (
              <View
                style={{
                  backgroundColor: sc.bg,
                  paddingHorizontal: 6,
                  paddingVertical: 1,
                  borderRadius: 8,
                  borderWidth: 0.5,
                  borderColor: sc.border
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', color: sc.fg }}>
                  {t('recall.match_score', '匹配度 {{score}}%', {
                    score: (score * 100).toFixed(1)
                  })}
                </Text>
              </View>
            )}
          </View>
          <Text
            style={{
              fontSize: 12,
              color: colors.textSecondary,
              marginLeft: tokens.spacing.xs
            }}
          >
            {item.date}
          </Text>
        </View>
        <Text
          numberOfLines={2}
          style={{
            fontSize: 14,
            color: colors.textSecondary
          }}
        >
          {item.snippet}
        </Text>
      </View>
    </Pressable>
  )
}
