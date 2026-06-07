import React, { useEffect, useRef } from 'react'
import { View, Animated, StyleSheet } from 'react-native'
import { useNativeTheme } from '../theme'

/** 对齐 desktop BouncingDotsIndicator */
export function StreamingBubbleBouncingDots() {
  const { colors } = useNativeTheme()
  const anims = useRef([0, 1, 2].map(() => new Animated.Value(0))).current

  useEffect(() => {
    const loops = anims.map((anim, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 150),
          Animated.timing(anim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true
          })
        ])
      )
    )
    loops.forEach((loop) => loop.start())
    return () => loops.forEach((loop) => loop.stop())
  }, [anims])

  return (
    <View style={styles.wrap}>
      {anims.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: colors.primary,
              opacity: 0.5,
              transform: [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -6]
                  })
                }
              ]
            }
          ]}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 6
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4
  }
})
