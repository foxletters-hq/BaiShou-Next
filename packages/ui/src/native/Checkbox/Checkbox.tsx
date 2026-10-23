import React from 'react'
import { Pressable, View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { useNativeTheme } from '../theme'
import { sharedTokens } from '../../theme/tokens'

export interface CheckboxProps {
  selected: boolean
  indeterminate?: boolean
  disabled?: boolean
  size?: 'sm' | 'md'
  onPress?: () => void
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}

export const Checkbox: React.FC<CheckboxProps> = ({
  selected,
  indeterminate,
  disabled,
  size = 'sm',
  onPress,
  accessibilityLabel,
  style
}) => {
  const { colors } = useNativeTheme()
  const on = selected || Boolean(indeterminate)
  const isMd = size === 'md'
  const box = (
    <View
      style={[
        styles.box,
        isMd && styles.boxMd,
        {
          borderColor: on ? colors.primary : colors.borderControl,
          backgroundColor: on ? colors.primary : colors.bgSurface
        },
        style
      ]}
    >
      {indeterminate ? (
        <View
          style={[styles.dash, isMd && styles.dashMd, { backgroundColor: colors.textOnPrimary }]}
        />
      ) : selected ? (
        <View style={[styles.tick, isMd && styles.tickMd, { borderColor: colors.textOnPrimary }]} />
      ) : null}
    </View>
  )

  if (!onPress) return box

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: indeterminate ? 'mixed' : selected, disabled }}
      accessibilityLabel={accessibilityLabel}
    >
      {box}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  box: {
    width: 16,
    height: 16,
    borderRadius: sharedTokens.radius.xs,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  boxMd: {
    width: 20,
    height: 20,
    borderRadius: sharedTokens.radius.xsPlus,
    borderWidth: 1.8
  },
  tick: {
    width: 5,
    height: 8,
    marginTop: -1,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    transform: [{ rotate: '45deg' }]
  },
  tickMd: {
    width: 6,
    height: 10,
    marginTop: -2,
    borderRightWidth: 2,
    borderBottomWidth: 2
  },
  dash: {
    width: 8,
    height: 1.5,
    borderRadius: 1
  },
  dashMd: {
    width: 11,
    height: 2,
    borderRadius: 1
  }
})
