import React, { useCallback, useMemo } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

const OPEN_TRANSLATION = 56
const OPEN_VELOCITY = 360

interface AgentDrawerSwipeZoneProps {
  enabled: boolean
  onOpen: () => void
  style?: StyleProp<ViewStyle>
  children: React.ReactNode
}

export const AgentDrawerSwipeZone: React.FC<AgentDrawerSwipeZoneProps> = ({
  enabled,
  onOpen,
  style,
  children
}) => {
  const handleOpen = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onOpen()
  }, [onOpen])

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .activeOffsetX(20)
        .failOffsetX(-12)
        .failOffsetY([-28, 28])
        .onEnd((event) => {
          const shouldOpen =
            event.translationX >= OPEN_TRANSLATION ||
            (event.translationX >= 32 && event.velocityX >= OPEN_VELOCITY)
          if (shouldOpen) {
            runOnJS(handleOpen)()
          }
        }),
    [enabled, handleOpen]
  )

  return (
    <GestureDetector gesture={panGesture}>
      <View style={[styles.container, style]}>{children}</View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  }
})
