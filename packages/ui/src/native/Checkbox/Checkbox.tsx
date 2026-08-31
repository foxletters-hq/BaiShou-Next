import React from 'react'
import { Pressable, View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { useNativeTheme } from '../theme'

export interface CheckboxProps {
  selected: boolean
  indeterminate?: boolean
  disabled?: boolean
  onPress?: () => void
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}

export const Checkbox: React.FC<CheckboxProps> = ({
  selected,
  indeterminate,
  disabled,
  onPress,
  accessibilityLabel,
  style
}) => {
  const { colors } = useNativeTheme()
  const on = selected || Boolean(indeterminate)
  const box = (
    <View
      style={[
        styles.box,
        {
          borderColor: on ? colors.primary : colors.borderControl,
          backgroundColor: on ? colors.primary : colors.bgSurface
        },
        style
      ]}
    >
      {indeterminate ? (
        <View style={[styles.dash, { backgroundColor: colors.textOnPrimary }]} />
      ) : selected ? (
        <View style={[styles.tick, { borderColor: colors.textOnPrimary }]} />
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
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  tick: {
    width: 5,
    height: 8,
    marginTop: -1,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    transform: [{ rotate: '45deg' }]
  },
  dash: {
    width: 8,
    height: 1.5,
    borderRadius: 1
  }
})
