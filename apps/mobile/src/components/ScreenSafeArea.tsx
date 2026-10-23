import React, { useMemo } from 'react'
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context'

/** Tab 内自定义顶栏：预留状态栏，底部交给 Tab Bar */
const TAB_EDGES: readonly Edge[] = ['top', 'left', 'right']
/** 全屏无系统顶栏：预留上下安全区 */
const SCREEN_EDGES: readonly Edge[] = ['top', 'left', 'right', 'bottom']
/** 模态全屏 */
const MODAL_EDGES: readonly Edge[] = ['top', 'left', 'right', 'bottom']
/** 左侧抽屉 */
const DRAWER_EDGES: readonly Edge[] = ['top', 'left']

export type ScreenSafeAreaPreset = 'tab' | 'screen' | 'modal' | 'drawer'

const PRESET_EDGES: Record<ScreenSafeAreaPreset, readonly Edge[]> = {
  tab: TAB_EDGES,
  screen: SCREEN_EDGES,
  modal: MODAL_EDGES,
  drawer: DRAWER_EDGES
}

interface ScreenSafeAreaProps {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  edges?: readonly Edge[] | Edge[]
  preset?: ScreenSafeAreaPreset
}

export function ScreenSafeArea({ children, style, edges, preset = 'screen' }: ScreenSafeAreaProps) {
  const insets = useSafeAreaInsets()
  const activeEdges = edges ?? PRESET_EDGES[preset]

  const insetsStyle = useMemo(
    () => ({
      paddingTop: activeEdges.includes('top') ? insets.top : 0,
      paddingBottom: activeEdges.includes('bottom') ? insets.bottom : 0,
      paddingLeft: activeEdges.includes('left') ? insets.left : 0,
      paddingRight: activeEdges.includes('right') ? insets.right : 0
    }),
    [activeEdges, insets.top, insets.bottom, insets.left, insets.right]
  )

  return <View style={[styles.flex, insetsStyle, style]}>{children}</View>
}

const styles = StyleSheet.create({
  flex: { flex: 1 }
})
