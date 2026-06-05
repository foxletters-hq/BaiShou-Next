import React, { useMemo, useRef, useState } from 'react'
import { View, PanResponder, type LayoutChangeEvent, StyleSheet } from 'react-native'
import { useNativeTheme } from '../theme'

interface DesktopStyleSliderProps {
  value: number
  minimumValue?: number
  maximumValue?: number
  step?: number
  onValueChange: (value: number) => void
}

/** 对齐桌面 .sm-slider：6px 轨道 + 20px 圆形拇指 */
export const DesktopStyleSlider: React.FC<DesktopStyleSliderProps> = ({
  value,
  minimumValue = 1,
  maximumValue = 60,
  step = 1,
  onValueChange
}) => {
  const { colors } = useNativeTheme()
  const trackMuted = colors.primaryTrackMuted ?? 'rgba(91, 168, 245, 0.24)'
  const [trackWidth, setTrackWidth] = useState(0)
  const trackRef = useRef<View>(null)
  const trackPageX = useRef(0)
  const gestureStartValue = useRef(0)
  const gestureStartPageX = useRef(0)

  const clamp = (v: number) => {
    const stepped = Math.round(v / step) * step
    return Math.max(minimumValue, Math.min(maximumValue, stepped))
  }

  const ratio = (value - minimumValue) / (maximumValue - minimumValue)
  const thumbLeft = trackWidth > 0 ? ratio * trackWidth - THUMB_SIZE / 2 : 0

  const xToValue = (x: number) => {
    if (trackWidth <= 0) return value
    return clamp(minimumValue + (x / trackWidth) * (maximumValue - minimumValue))
  }

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          gestureStartPageX.current = evt.nativeEvent.pageX
          gestureStartValue.current = xToValue(evt.nativeEvent.pageX - trackPageX.current)
          onValueChange(gestureStartValue.current)
        },
        onPanResponderMove: (evt) => {
          const localX = evt.nativeEvent.pageX - trackPageX.current
          onValueChange(xToValue(localX))
        }
      }),
    [trackWidth, minimumValue, maximumValue, step, onValueChange]
  )

  return (
    <View style={styles.wrap}>
      <View
        ref={trackRef}
        onLayout={(e: LayoutChangeEvent) => {
          setTrackWidth(e.nativeEvent.layout.width)
          trackRef.current?.measureInWindow((x) => {
            trackPageX.current = x
          })
        }}
        style={styles.hitArea}
        {...panResponder.panHandlers}
      >
        <View style={[styles.track, { backgroundColor: trackMuted }]}>
          <View
            style={[
              styles.trackFill,
              {
                width: Math.max(0, ratio * trackWidth),
                backgroundColor: colors.primary
              }
            ]}
          />
        </View>
        <View
          style={[
            styles.thumb,
            {
              left: Math.max(0, Math.min(trackWidth - THUMB_SIZE, thumbLeft)),
              backgroundColor: colors.primary
            }
          ]}
        />
      </View>
    </View>
  )
}

const THUMB_SIZE = 20
const TRACK_HEIGHT = 6

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 8
  },
  hitArea: {
    height: 44,
    justifyContent: 'center'
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    overflow: 'hidden'
  },
  trackFill: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2
  },
  thumb: {
    position: 'absolute',
    top: (44 - THUMB_SIZE) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    zIndex: 1
  }
})
