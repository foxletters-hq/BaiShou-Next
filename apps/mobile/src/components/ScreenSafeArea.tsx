import React from 'react'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { SafeAreaView, type Edge } from 'react-native-safe-area-context'

/** Tab 内自定义顶栏：预留状态栏，底部交给 Tab Bar */
const TAB_EDGES: Edge[] = ['top', 'left', 'right']
/** 全屏无系统顶栏：预留上下安全区 */
const SCREEN_EDGES: Edge[] = ['top', 'left', 'right', 'bottom']
/** 模态全屏 */
const MODAL_EDGES: Edge[] = ['top', 'left', 'right', 'bottom']
/** 左侧抽屉 */
const DRAWER_EDGES: Edge[] = ['top', 'left']

export type ScreenSafeAreaPreset = 'tab' | 'screen' | 'modal' | 'drawer'

const PRESET_EDGES: Record<ScreenSafeAreaPreset, Edge[]> = {
  tab: TAB_EDGES,
  screen: SCREEN_EDGES,
  modal: MODAL_EDGES,
  drawer: DRAWER_EDGES
}

interface ScreenSafeAreaProps {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  edges?: Edge[]
  preset?: ScreenSafeAreaPreset
}

export function ScreenSafeArea({
  children,
  style,
  edges,
  preset = 'screen'
}: ScreenSafeAreaProps) {
  return (
    <SafeAreaView style={[styles.flex, style]} edges={edges ?? PRESET_EDGES[preset]}>
      {children}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 }
})
