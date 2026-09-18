import React from 'react'
import { Animated } from 'react-native'

export function GraphPhaseFade({
  children,
  phaseKey
}: {
  children: React.ReactNode
  phaseKey: string
}) {
  const opacity = React.useRef(new Animated.Value(0)).current
  const translateY = React.useRef(new Animated.Value(10)).current

  React.useEffect(() => {
    opacity.setValue(0)
    translateY.setValue(10)
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true })
    ]).start()
  }, [phaseKey, opacity, translateY])

  return (
    <Animated.View style={{ flex: 1, opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  )
}
