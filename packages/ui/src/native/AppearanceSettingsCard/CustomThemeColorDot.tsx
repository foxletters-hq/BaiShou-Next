import React, { useId } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg'

/** 与桌面 custom-color-picker 一致：45° 炫彩渐变 + 白色「+」 */
const GRADIENT_STOPS = [
  { offset: '0%', color: '#FF6B6B' },
  { offset: '38%', color: '#FFD93D' },
  { offset: '68%', color: '#4D96FF' },
  { offset: '100%', color: '#C77DFF' }
] as const

const DOT_SIZE = 40

interface CustomThemeColorDotProps {
  isCustom: boolean
  seedColor: string
  active: boolean
  onPress: () => void
}

export const CustomThemeColorDot: React.FC<CustomThemeColorDotProps> = ({
  isCustom,
  seedColor,
  active,
  onPress
}) => {
  const gradientId = useId().replace(/:/g, '')

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.wrap,
        active && styles.wrapActive
      ]}
      accessibilityRole="button"
    >
      {isCustom ? (
        <View style={[styles.solid, { backgroundColor: seedColor }]} />
      ) : (
        <Svg width={DOT_SIZE} height={DOT_SIZE} style={styles.svg}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
              {GRADIENT_STOPS.map((stop) => (
                <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
              ))}
            </LinearGradient>
          </Defs>
          <Circle
            cx={DOT_SIZE / 2}
            cy={DOT_SIZE / 2}
            r={DOT_SIZE / 2 - 1}
            fill={`url(#${gradientId})`}
          />
        </Svg>
      )}
      <Text style={styles.plus}>{isCustom ? '✓' : '+'}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderStyle: 'dashed',
    overflow: 'hidden'
  },
  wrapActive: {
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    borderStyle: 'solid'
  },
  svg: {
    ...StyleSheet.absoluteFillObject
  },
  solid: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: DOT_SIZE / 2
  },
  plus: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    zIndex: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2
  }
})
