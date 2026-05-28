import React from 'react'
import { View, StatusBar, StyleSheet, type ViewStyle } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNativeTheme } from '@baishou/ui/native'
import { StackScreenHeader, type StackScreenHeaderProps } from './StackScreenHeader'
import { getStackScreenChrome } from './stackScreenChrome'

export interface StackScreenLayoutProps extends StackScreenHeaderProps {
  children: React.ReactNode
  backgroundColor?: string
  contentStyle?: ViewStyle
}

/**
 * 栈内全屏子页统一壳（与局域网传输页同款顶栏）。
 * 路由必须 `headerShown: false`，避免系统导航栏与自定义顶栏重复。
 */
export const StackScreenLayout: React.FC<StackScreenLayoutProps> = ({
  children,
  backgroundColor,
  contentStyle,
  transparent: transparentProp,
  ...headerProps
}) => {
  const { colors, isDark } = useNativeTheme()
  const chrome = getStackScreenChrome(colors)
  const bg = backgroundColor ?? chrome.backgroundColor
  const transparent = transparentProp ?? chrome.transparent

  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={bg} />
      <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
        <StackScreenHeader {...headerProps} transparent={transparent} />
        <View style={[styles.content, contentStyle]}>{children}</View>
      </SafeAreaView>
    </>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1 }
})
