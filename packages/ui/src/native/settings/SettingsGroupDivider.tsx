import React from 'react'
import { View, StyleSheet } from 'react-native'
import { useNativeTheme } from '../theme'

export const SettingsGroupDivider: React.FC = () => {
  const { colors } = useNativeTheme()
  return <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
}

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 14
  }
})
