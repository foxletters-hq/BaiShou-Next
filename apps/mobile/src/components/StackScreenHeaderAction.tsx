import React from 'react'
import { TouchableOpacity, Text, StyleSheet } from 'react-native'
import { useNativeTheme } from '@baishou/ui/native'
import type { StackScreenHeaderActionConfig } from './stack-screen-header.types'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

interface StackScreenHeaderActionProps {
  action: StackScreenHeaderActionConfig
}

export const StackScreenHeaderAction: React.FC<StackScreenHeaderActionProps> = ({ action }) => {
  const { colors } = useNativeTheme()
  const { icon: Icon, label, onPress, accessibilityLabel, disabled } = action

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={styles.hit}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={8}
    >
      {Icon ? (
        <Icon
          size={22}
          color={disabled ? colors.textTertiary : colors.textPrimary}
          strokeWidth={2}
        />
      ) : (
        <Text
          style={[styles.label, { color: disabled ? colors.textTertiary : colors.textSecondary }]}
          numberOfLines={1}
        >
          {label ?? ''}
        </Text>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  hit: {
    paddingHorizontal: sharedTokens.spacing.sm,
    paddingVertical: sharedTokens.spacing.sm,
    alignItems: 'flex-end',
    justifyContent: 'center',
    minHeight: 40
  },
  label: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '600'
  }
})
