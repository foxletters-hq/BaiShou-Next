import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated, Dimensions, Easing } from 'react-native'
import { useTranslation } from 'react-i18next'

const STEP_COLORS = ['#B3E5FC', '#81D4FA', '#4FC3F7', '#29B6F6'] as const
const STEP_DELAYS = [0, 180, 360, 540, 720] as const
const ANIM_DURATION_MS = 1200

export const CompressionChart: React.FC = () => {
  const { t } = useTranslation()
  const screenWidth = Dimensions.get('window').width
  const maxWidth = Math.min(screenWidth - 64, 420)

  const anim1 = useRef(new Animated.Value(0)).current
  const anim2 = useRef(new Animated.Value(0)).current
  const anim3 = useRef(new Animated.Value(0)).current
  const anim4 = useRef(new Animated.Value(0)).current
  const anim5 = useRef(new Animated.Value(0)).current
  const anims = useRef([anim1, anim2, anim3, anim4, anim5]).current

  useEffect(() => {
    anims.forEach((anim) => anim.setValue(0))

    const animations = anims.map((anim, index) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: ANIM_DURATION_MS,
        delay: STEP_DELAYS[index],
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    )

    const handle = Animated.parallel(animations)
    handle.start()
    return () => handle.stop()
  }, [anims])

  const createStepStyle = (anim: Animated.Value, widthFactor: number, color: string) => ({
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [10, 0]
        })
      }
    ],
    width: maxWidth * widthFactor,
    backgroundColor: color
  })

  return (
    <View style={[styles.container, { maxWidth }]}>
      <Animated.View style={[styles.step, createStepStyle(anim1, 0.3, STEP_COLORS[0])]}>
        <Text style={styles.stepText}>{t('common.daily')}</Text>
      </Animated.View>
      <Animated.View style={[styles.step, createStepStyle(anim2, 0.48, STEP_COLORS[1])]}>
        <Text style={styles.stepText}>{t('common.weekly')}</Text>
      </Animated.View>
      <Animated.View style={[styles.step, createStepStyle(anim3, 0.66, STEP_COLORS[2])]}>
        <Text style={styles.stepText}>{t('common.monthly')}</Text>
      </Animated.View>
      <Animated.View style={[styles.step, createStepStyle(anim4, 0.82, STEP_COLORS[3])]}>
        <Text style={styles.stepText}>{t('common.quarterly')}</Text>
      </Animated.View>
      <Animated.View
        style={[
          styles.baseBar,
          {
            opacity: anim5,
            transform: [
              {
                translateY: anim5.interpolate({
                  inputRange: [0, 1],
                  outputRange: [14, 0]
                })
              }
            ],
            width: maxWidth
          }
        ]}
      >
        <Text style={styles.baseBarText}>{t('common.yearly')}</Text>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    width: '100%',
    alignItems: 'flex-start'
  },
  step: {
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4
  },
  stepText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.5
  },
  baseBar: {
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    backgroundColor: '#64B5F6',
    shadowColor: '#9AD4EA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6
  },
  baseBarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 17,
    letterSpacing: 3
  }
})
