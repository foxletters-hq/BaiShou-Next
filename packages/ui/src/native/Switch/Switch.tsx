import React from 'react'
import { Platform, Switch as RNSwitch, SwitchProps as RNSwitchProps } from 'react-native'
import { useNativeTheme } from '../theme'

export interface NativeSwitchProps extends RNSwitchProps {}

export const Switch: React.FC<NativeSwitchProps> = ({ value, ...props }) => {
  const { colors } = useNativeTheme()

  return (
    <RNSwitch
      value={value}
      trackColor={{ false: colors.borderSubtle, true: colors.primary }}
      thumbColor={Platform.OS === 'android' ? colors.bgSurface : undefined}
      ios_backgroundColor={colors.borderSubtle}
      {...props}
    />
  )
}
