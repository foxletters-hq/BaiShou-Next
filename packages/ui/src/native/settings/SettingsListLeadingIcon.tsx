import React from 'react'
import { View } from 'react-native'
import { useNativeTheme } from '../theme'
import { settingsHubListStyles as hubStyles } from './settings-hub.styles'

export interface SettingsListLeadingIconProps {
  children: React.ReactNode
}

/** 设置枢纽 / 展开行左侧图标底板，与 SettingsScreen 列表行一致 */
export const SettingsListLeadingIcon: React.FC<SettingsListLeadingIconProps> = ({ children }) => {
  const { colors } = useNativeTheme()

  return (
    <View style={[hubStyles.iconWrap, { backgroundColor: colors.bgSurfaceNormal }]}>
      {children}
    </View>
  )
}
