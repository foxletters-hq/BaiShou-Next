import React from 'react';
import { Switch as RNSwitch, SwitchProps as RNSwitchProps } from 'react-native';
import { useNativeTheme } from '../theme';

export interface NativeSwitchProps extends RNSwitchProps {}

export const Switch: React.FC<NativeSwitchProps> = (props) => {
  const { colors } = useNativeTheme();

  return (
    <RNSwitch
      trackColor={{ false: colors.bgSurfaceNormal, true: colors.primary }}
      thumbColor={colors.bgSurface}
      ios_backgroundColor={colors.bgSurfaceNormal}
      {...props}
    />
  );
};
