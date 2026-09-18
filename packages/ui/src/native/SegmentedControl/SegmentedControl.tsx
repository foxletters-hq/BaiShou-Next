import React, { useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useNativeTheme } from '../theme'

export interface SegmentedControlOption<T extends string = string> {
  value: T
  label: string
  disabled?: boolean
}

export interface SegmentedControlProps<T extends string = string> {
  value: T
  options: ReadonlyArray<SegmentedControlOption<T>>
  onChange: (value: T) => void
  disabled?: boolean
  accessibilityLabel?: string
}

const TRACK_PADDING = 4

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
  accessibilityLabel
}: SegmentedControlProps<T>): React.ReactElement {
  const { colors } = useNativeTheme()
  const [trackWidth, setTrackWidth] = useState(0)
  const slide = useSharedValue(0)
  const count = Math.max(options.length, 1)
  const thumbWidth = trackWidth > 0 ? (trackWidth - TRACK_PADDING * 2) / count : 0
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  )

  useEffect(() => {
    if (thumbWidth <= 0) return
    slide.value = withTiming(activeIndex, { duration: 220 })
  }, [activeIndex, slide, thumbWidth])

  const indicatorStyle = useAnimatedStyle(() => ({
    width: thumbWidth,
    transform: [{ translateX: slide.value * thumbWidth }]
  }))

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, { backgroundColor: colors.bgSurfaceNormal }]}
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
    >
      {thumbWidth > 0 ? (
        <Animated.View
          style={[styles.thumb, { backgroundColor: colors.bgSurface }, indicatorStyle]}
        />
      ) : null}
      {options.map((option) => {
        const active = option.value === value
        const itemDisabled = disabled || option.disabled
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active, disabled: itemDisabled }}
            disabled={itemDisabled}
            style={styles.item}
            onPress={() => {
              if (option.value !== value) onChange(option.value)
            }}
          >
            <Text
              style={[styles.label, { color: active ? colors.primary : colors.textSecondary }]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    borderRadius: 12,
    padding: TRACK_PADDING,
    overflow: 'hidden'
  },
  thumb: {
    position: 'absolute',
    top: TRACK_PADDING,
    bottom: TRACK_PADDING,
    left: TRACK_PADDING,
    borderRadius: 8
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    minWidth: 0,
    zIndex: 1
  },
  label: {
    fontSize: 14,
    fontWeight: '500'
  }
})
