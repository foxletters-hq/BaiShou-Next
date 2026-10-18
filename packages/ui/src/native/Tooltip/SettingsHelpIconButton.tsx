import React from 'react'
import { Pressable, StyleSheet, type Insets, type StyleProp, type ViewStyle } from 'react-native'
import { CircleHelp } from 'lucide-react-native'
import { useNativeTheme } from '../theme'
import { DEFAULT_STROKE_WIDTH, HELP_ICON_SIZE } from '../../shared/icons/icon-sizes'
import { sharedTokens } from '../../theme/tokens'

export interface NativeSettingsHelpIconButtonProps {
  'aria-label'?: string
  accessibilityLabel?: string
  onPress?: () => void
  onActivate?: () => void
  hitSlop?: Insets | number
  style?: StyleProp<ViewStyle>
  size?: number
}

/**
 * Mobile help "?" icon button — matches desktop SettingsHelpIconButton visually.
 * Uses colors.textTertiary by default, with press feedback.
 */
export const SettingsHelpIconButton: React.FC<NativeSettingsHelpIconButtonProps> = ({
  'aria-label': ariaLabel,
  accessibilityLabel,
  onPress,
  onActivate,
  hitSlop = 8,
  style,
  size = HELP_ICON_SIZE
}) => {
  const { colors } = useNativeTheme()
  const label = ariaLabel ?? accessibilityLabel
  const handlePress = onPress ?? onActivate

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.btn, { opacity: pressed ? 0.6 : 1 }, style]}
    >
      <CircleHelp size={size} color={colors.textTertiary} strokeWidth={DEFAULT_STROKE_WIDTH} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: sharedTokens.spacing.xxs
  }
})
