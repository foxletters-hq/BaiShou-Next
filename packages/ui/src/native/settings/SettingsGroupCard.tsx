import React from 'react'
import { View, StyleSheet, type ViewStyle } from 'react-native'
import { useNativeTheme } from '../theme'

export interface SettingsGroupCardProps {
  children: React.ReactNode
  style?: ViewStyle
}

/** 设置详情页统一白卡片容器 */
export const SettingsGroupCard: React.FC<SettingsGroupCardProps> = ({ children, style }) => {
  const { colors, tokens } = useNativeTheme()
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.bgSurface,
          borderRadius: tokens.radius.lg,
          padding: tokens.spacing.lg
        },
        style
      ]}
    >
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16
  }
})
