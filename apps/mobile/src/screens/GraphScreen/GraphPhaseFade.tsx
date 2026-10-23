import React from 'react'
import { Animated, View } from 'react-native'
import { sharedTokens } from '@baishou/ui/theme/tokens'

export function GraphPhaseFade({
  children,
  phaseKey,
  disabled = false
}: {
  children: React.ReactNode
  phaseKey: string
  disabled?: boolean
}) {
  const opacity = React.useRef(new Animated.Value(0)).current
  const translateY = React.useRef(new Animated.Value(10)).current

  React.useEffect(() => {
    if (disabled) return
    opacity.setValue(0)
    translateY.setValue(10)
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: sharedTokens.animation.moderate,
        useNativeDriver: true
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: sharedTokens.animation.moderate,
        useNativeDriver: true
      })
    ]).start()
  }, [disabled, phaseKey, opacity, translateY])

  if (disabled) {
    return <View style={{ flex: 1 }}>{children}</View>
  }

  return (
    <Animated.View style={{ flex: 1, opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  )
}
