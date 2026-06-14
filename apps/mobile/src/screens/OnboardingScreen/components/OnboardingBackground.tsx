import React, { useEffect, useRef } from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg'
import { BRAND_BLUE, ONBOARDING_BG_GRADIENT, SLIDE_THEMES } from '../onboarding-theme'

const welcomeTheme = SLIDE_THEMES[0]

export const OnboardingBackground: React.FC = () => {
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

  const orbOffsetTop = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 8]
  })

  const orbOffsetBottom = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 6]
  })

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id="onboardingBg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={ONBOARDING_BG_GRADIENT[0]} />
            <Stop offset="1" stopColor={ONBOARDING_BG_GRADIENT[1]} />
          </SvgLinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#onboardingBg)" />
      </Svg>

      <Animated.View
        style={[
          styles.orbTop,
          {
            backgroundColor: BRAND_BLUE + '14',
            transform: [{ translateY: orbOffsetTop }]
          }
        ]}
      />
      <Animated.View
        style={[
          styles.orbBottom,
          {
            backgroundColor: welcomeTheme.glowColor,
            transform: [{ translateY: orbOffsetBottom }]
          }
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  orbTop: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 200,
    height: 200,
    borderRadius: 100
  },
  orbBottom: {
    position: 'absolute',
    bottom: -30,
    left: -50,
    width: 160,
    height: 160,
    borderRadius: 80
  }
})
