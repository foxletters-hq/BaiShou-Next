import React from 'react'
import { View, Text, Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { Checkbox } from '../Checkbox'
import type { RecallItem } from './recall-dialog.types'
import { getSimilarityColors } from './recall-dialog.utils'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

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
        alignItems: 'flex-start',
        gap: tokens.spacing.md,
        padding: tokens.spacing.md,
        backgroundColor: isSelected ? colors.primaryContainer : colors.bgSurface,
        borderWidth: 1,
        borderColor: isSelected ? colors.primary : colors.borderMuted,
        borderRadius: tokens.radius.lg
      }}
    >
      <Checkbox selected={isSelected} style={{ marginTop: sharedTokens.spacing.xxs }} />
      <View style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: sharedTokens.spacing.xsPlus
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: tokens.spacing.xs,
              flex: 1,
              marginRight: tokens.spacing.sm
            }}
          >
            <Text
              style={{
                fontSize: mobileTypography.body.fontSize,
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
                  paddingHorizontal: sharedTokens.spacing.xsPlus,
                  paddingVertical: 1,
                  borderRadius: sharedTokens.radius.sm,
                  borderWidth: 0.5,
                  borderColor: sc.border
                }}
              >
                <Text
                  style={{
                    fontSize: mobileTypography.caption.fontSize,
                    fontWeight: '600',
                    color: sc.fg
                  }}
                >
                  {t('recall.match_score', '匹配度 {{score}}%', {
                    score: (score * 100).toFixed(1)
                  })}
                </Text>
              </View>
            )}
          </View>
          <Text
            style={{
              fontSize: mobileTypography.caption.fontSize,
              color: colors.textSecondary
            }}
          >
            {item.date}
          </Text>
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
      </View>
    </Pressable>
  )
}
