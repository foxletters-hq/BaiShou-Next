import React from 'react'
import { View, Text, Pressable, ViewProps } from 'react-native'
import { mobileTypography, sharedTokens } from '../../theme/tokens'
import { useNativeTheme } from '../theme'

export interface NativeSettingsItemProps extends ViewProps {
  icon?: React.ReactNode
  title: string
  subtitle?: string
  rightElement?: React.ReactNode
  onPress?: () => void
}

export const SettingsItem: React.FC<NativeSettingsItemProps> = ({
  icon,
  title,
  subtitle,
  rightElement,
  onPress,
  style,
  ...props
}) => {
  const { colors, tokens } = useNativeTheme()

  const content = (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: tokens.spacing.md,
          paddingHorizontal: tokens.spacing.lg,
          backgroundColor: colors.bgSurface,
          gap: tokens.spacing.md
        },
        style
      ]}
      {...props}
    >
      {icon && (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: tokens.radius.md,
            backgroundColor: colors.bgSurfaceNormal,
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {icon}
        </View>
      )}

      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: mobileTypography.primary.fontSize,
            color: colors.textPrimary,
            fontWeight: mobileTypography.primary.fontWeight
          }}
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            style={{
              fontSize: mobileTypography.secondary.fontSize,
              fontWeight: mobileTypography.secondary.fontWeight,
              color: colors.textSecondary,
              marginTop: sharedTokens.spacing.xxs
            }}
          >
            {subtitle}
          </Text>
        )}
      </View>

      {rightElement && <View style={{ marginLeft: tokens.spacing.sm }}>{rightElement}</View>}
    </View>
  )

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          opacity: pressed ? 0.7 : 1
        })}
      >
        {content}
      </Pressable>
    )
  }

  return content
}
