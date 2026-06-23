import React from 'react'
import { TouchableOpacity, StyleSheet, ActivityIndicator, type ViewStyle } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useNativeTheme } from '../theme'

export type NativeIconName = keyof typeof MaterialIcons.glyphMap

interface NativeIconButtonProps {
  name: NativeIconName
  onPress?: () => void
  size?: number
  color?: string
  active?: boolean
  loading?: boolean
  danger?: boolean
  disabled?: boolean
  accessibilityLabel?: string
  style?: ViewStyle
}

export const NativeIconButton: React.FC<NativeIconButtonProps> = ({
  name,
  onPress,
  size = 14,
  color,
  active = false,
  loading = false,
  danger = false,
  disabled = false,
  accessibilityLabel,
  style
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
        <MaterialIcons name={name} size={size} color={iconColor} />
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
