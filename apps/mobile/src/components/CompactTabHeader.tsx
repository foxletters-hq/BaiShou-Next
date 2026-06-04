import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNativeTheme } from '@baishou/ui/native'

interface CompactTabHeaderProps {
  title: string
}

/** Tab 页紧凑顶栏，替代 Expo 默认较高的系统 Header */
export const CompactTabHeader: React.FC<CompactTabHeaderProps> = ({ title }) => {
  const { colors } = useNativeTheme()
  const insets = useSafeAreaInsets()

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: insets.top,
          backgroundColor: colors.bgSurface,
          borderBottomColor: colors.borderSubtle
        }
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
          {title}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  header: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16
  },
  title: {
    fontSize: 17,
    fontWeight: '700'
  }
})
