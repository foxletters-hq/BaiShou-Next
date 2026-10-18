import React from 'react'
import { Pressable, Text } from 'react-native'
import { X } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import { iconSizes } from '../../theme/tokens'
import { useNativeTheme } from '../theme'
import { nativeSkillCiteStyles as styles } from './native-skill-cite.styles'

export function NativeSkillCiteChip(props: {
  command: string
  onPress: () => void
  onRemove?: () => void
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const command = props.command.replace(/^\//, '')
  const label = `/${command}`

  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={t('shortcut.view_skill', '查看 Skill')}
      style={[
        styles.chip,
        {
          borderLeftColor: colors.primary
        }
      ]}
    >
      <Text style={[styles.label, { color: colors.primary }]} numberOfLines={1}>
        {label}
      </Text>
      {props.onRemove ? (
        <Pressable
          onPress={props.onRemove}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('common.delete', '删除')}
        >
          <X size={iconSizes.sm} color={colors.textTertiary} strokeWidth={DEFAULT_STROKE_WIDTH} />
        </Pressable>
      ) : null}
    </Pressable>
  )
}
