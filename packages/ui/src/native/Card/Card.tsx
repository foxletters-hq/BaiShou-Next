import React from 'react';
import { View, ViewProps } from 'react-native';
import { useNativeTheme } from '../theme';

export interface NativeCardProps extends ViewProps {
  // hoverable not directly applicable in mobile touch without complex active styling,
  // but we can support it if needed.
}

export const Card: React.FC<NativeCardProps> = ({ style, children, ...props }) => {
  const { colors, tokens } = useNativeTheme();

  return (
    <View
      style={[
        {
          backgroundColor: colors.bgSurface,
          borderRadius: tokens.radius.md,
          padding: tokens.spacing.md,
          elevation: 1,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
};
