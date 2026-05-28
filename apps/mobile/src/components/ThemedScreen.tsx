import React from 'react'
import { View, SafeAreaView, StatusBar, ScrollView, type ViewStyle } from 'react-native'
import { useNativeTheme, scrollIndicatorStyle } from '@baishou/ui/native'

type ThemedScreenProps = {
  children: React.ReactNode
  scroll?: boolean
  style?: ViewStyle
  edges?: boolean
}

/**
 * 全屏页面统一背景与安全区（与桌面 settings-pane / bgApp 一致）
 */
export function ThemedScreen({ children, scroll = false, style, edges = true }: ThemedScreenProps) {
  const { colors, isDark } = useNativeTheme()
  const body = scroll ? (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bgApp }}
      contentContainerStyle={{ paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
      indicatorStyle={scrollIndicatorStyle(isDark)}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1, backgroundColor: colors.bgApp }, style]}>{children}</View>
  )

  if (!edges) {
    return (
      <>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={colors.bgApp}
        />
        {body}
      </>
    )
  }

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bgApp}
      />
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgApp }}>{body}</SafeAreaView>
    </>
  )
}
