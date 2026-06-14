import React, { useEffect, useRef } from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import type { SlideTheme } from '../onboarding-theme'

interface OnboardingGlowIconProps {
  theme: SlideTheme
  size?: number
}

export const OnboardingGlowIcon: React.FC<OnboardingGlowIconProps> = ({ theme, size = 72 }) => {
  const floatAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true
        })
      ])
    )
    animation.start()
    return () => animation.stop()
  }, [floatAnim])

  const scale = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.03]
  })

  return (
    <Animated.View
      style={[
        styles.glowRing,
        {
          width: size + 40,
          height: size + 40,
          transform: [{ scale }]
        }
      ]}
    >
      <View
        style={[
          styles.iconShell,
          {
            width: size + 8,
            height: size + 8,
            borderColor: theme.iconColor + '33',
            shadowColor: theme.iconColor
          }
        ]}
      >
        <MaterialIcons name={theme.icon} size={size * 0.55} color={theme.iconColor} />
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  glowRing: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconShell: {
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 4
  }
})
