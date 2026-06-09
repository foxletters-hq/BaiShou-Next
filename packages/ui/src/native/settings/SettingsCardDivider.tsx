import React from 'react'
import { View, StyleSheet } from 'react-native'
import { useNativeTheme } from '../theme'

/** 设置卡片内部全宽分隔线 */
export const SettingsCardDivider: React.FC = () => {
  const { colors } = useNativeTheme()
  return <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
}

const styles = StyleSheet.create({
  divider: {
    height: 1,
    marginVertical: 14
  }
})
