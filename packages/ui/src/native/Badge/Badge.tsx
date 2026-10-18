import React from 'react'
import { View, Text, ViewProps } from 'react-native'
import { useNativeTheme } from '../theme'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

export interface NativeBadgeProps extends ViewProps {
  variant?: 'dot' | 'capsule'
  count?: number
}

export const Badge: React.FC<NativeBadgeProps> = ({
  variant = 'capsule',
  count,
  style,
  ...props
}) => {
  const { colors } = useNativeTheme()

  const getContainerStyle = () => {
    if (variant === 'dot') {
      return {
        width: 8,
        height: 8,
        borderRadius: sharedTokens.radius.xs,
        backgroundColor: colors.error
      }
    }

    return {
      minWidth: 20,
      height: 20,
      borderRadius: sharedTokens.radius.control,
      backgroundColor: colors.error,
      paddingHorizontal: sharedTokens.spacing.xsPlus,
      alignItems: 'center' as const,
      justifyContent: 'center' as const
    }
  }

  return (
    <View style={[getContainerStyle(), style]} {...props}>
      {variant === 'capsule' && count !== undefined && (
        <Text
          style={{
            color: colors.onError,
            fontSize: mobileTypography.caption.fontSize,
            fontWeight: '600',
            lineHeight: 14
          }}
        >
          {count > 99 ? '99+' : count}
        </Text>
      )}
    </View>
  )
}
