import React from 'react'
import { View, ViewProps } from 'react-native'
import { useNativeTheme } from '../theme'

export interface NativeCardProps extends ViewProps {
  // hoverable not directly applicable in mobile touch without complex active styling,
  // but we can support it if needed.
}

export const Card: React.FC<NativeCardProps> = ({ style, children, ...props }) => {
  const { colors, tokens } = useNativeTheme()

  return (
    <View
      style={[
        {
          backgroundColor: colors.bgSurface,
          borderRadius: 16,
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: colors.borderMuted,
          padding: tokens.spacing.md
        },
        style
      ]}
      {...props}
    >
      {children}
    </View>
  )
}
