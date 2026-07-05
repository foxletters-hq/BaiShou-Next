import React from 'react'
import { TouchableOpacity, StyleSheet, ActivityIndicator, type ViewStyle } from 'react-native'
import type { LucideProps } from 'lucide-react-native'
import { useNativeTheme } from '../theme'
import { LucideIcon } from './LucideIcon'

interface NativeIconButtonProps {
  icon: React.ComponentType<LucideProps>
  onPress?: () => void
  size?: number
  color?: string
  active?: boolean
  loading?: boolean
  danger?: boolean
  disabled?: boolean
  accessibilityLabel?: string
  style?: ViewStyle
  strokeWidth?: number
}

export const NativeIconButton: React.FC<NativeIconButtonProps> = ({
  icon,
  onPress,
  size = 14,
  color,
  active = false,
  loading = false,
  danger = false,
  disabled = false,
  accessibilityLabel,
  style,
  strokeWidth
}) => {
  const { colors } = useNativeTheme()
  const iconColor =
    color ?? (danger ? colors.error : active ? colors.primary : colors.textSecondary)
  const isDisabled = disabled || !onPress

  return (
    <TouchableOpacity
      style={[
        styles.btn,
        active && { backgroundColor: colors.primaryLight },
        isDisabled && styles.disabled,
        style
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.6}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ busy: loading }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : (
        <LucideIcon icon={icon} size={size} color={iconColor} strokeWidth={strokeWidth} />
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  btn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center'
  },
  disabled: {
    opacity: 0.4
  }
})
