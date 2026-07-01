import React, { useEffect } from 'react'
import { Pressable, StyleSheet } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolateColor
} from 'react-native-reanimated'
import { useNativeTheme } from '../theme'

export interface NativeSwitchProps {
  value?: boolean
  onValueChange?: (value: boolean) => void
  disabled?: boolean
}

/**
 * 自定义弹性动画 Switch 开关，提供丝滑、完美同步的变色与位移手感
 */
export const Switch: React.FC<NativeSwitchProps> = ({
  value = false,
  onValueChange,
  disabled = false
}) => {
  const { colors, isDark } = useNativeTheme()
  const progress = useSharedValue(value ? 1 : 0)

  useEffect(() => {
    progress.value = withSpring(value ? 1 : 0, {
      damping: 15,
      stiffness: 150,
      mass: 0.8
    })
  }, [value, progress])

  const trackColorOff = isDark ? '#2D3748' : '#E2E8F0'
  const trackColorOn = colors.primary

  const rTrackStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(progress.value, [0, 1], [trackColorOff, trackColorOn])
    return { backgroundColor }
  })

  const rThumbStyle = useAnimatedStyle(() => {
    const translateX = progress.value * 20
    const isOn = progress.value > 0.5
    return {
      transform: [{ translateX }],
      shadowOpacity: isOn ? 0.15 : 0,
      elevation: isOn ? 3 : 0
    }
  })

  const handlePress = () => {
    if (disabled) return
    onValueChange?.(!value)
  }

  return (
    <Pressable
      disabled={disabled}
      onPress={handlePress}
      style={[styles.trackBase, disabled && { opacity: 0.5 }]}
    >
      <Animated.View style={[styles.track, rTrackStyle]}>
        <Animated.View
          style={[
            styles.thumb,
            rThumbStyle,
            { backgroundColor: '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)' }
          ]}
        />
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  trackBase: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  track: {
    width: 46,
    height: 26,
    borderRadius: 13,
    padding: 2,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden'
  },
  thumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 2.5
  }
})
