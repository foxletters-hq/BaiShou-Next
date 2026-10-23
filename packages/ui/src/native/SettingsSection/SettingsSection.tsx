import React from 'react'
import { View, Text, ViewProps } from 'react-native'
import { mobileTypography, sharedTokens } from '../../theme/tokens'
import { useNativeTheme } from '../theme'

export interface NativeSettingsSectionProps extends ViewProps {
  title: string
  titleAddon?: React.ReactNode
  description?: string
  children: React.ReactNode
}

export const SettingsSection: React.FC<NativeSettingsSectionProps> = ({
  title,
  titleAddon,
  description,
  children,
  style,
  ...props
}) => {
  const { colors, tokens } = useNativeTheme()

  return (
    <View
      style={[
        {
          marginBottom: tokens.spacing.lg
        },
        style
      ]}
      {...props}
    >
      <View
        style={{
          paddingHorizontal: tokens.spacing.lg,
          marginBottom: tokens.spacing.sm
        }}
      >
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: sharedTokens.spacing.xsPlus }}
        >
          <Text
            style={{
              fontSize: mobileTypography.title.fontSize,
              fontWeight: mobileTypography.title.fontWeight,
              color: colors.textPrimary
            }}
          >
            {title}
          </Text>
          {titleAddon}
        </View>
        {description && (
          <Text
            style={{
              fontSize: mobileTypography.secondary.fontSize,
              fontWeight: mobileTypography.secondary.fontWeight,
              color: colors.textSecondary,
              marginTop: sharedTokens.spacing.xs
            }}
          >
            {description}
          </Text>
        )}
      </View>

      <View
        style={{
          backgroundColor: colors.bgSurface,
          borderRadius: tokens.radius.lg,
          overflow: 'hidden'
        }}
      >
        {children}
      </View>
    </View>
  )
}
