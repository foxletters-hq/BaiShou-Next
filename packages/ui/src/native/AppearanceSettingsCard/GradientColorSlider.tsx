import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  StyleSheet,
  PanResponder,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type PanResponderGestureState,
  type StyleProp,
  type ViewStyle
} from 'react-native'
import { NATIVE_SLIDER_HEIGHT, snapSliderValue } from '../Slider/native-slider.utils'

const THUMB_SIZE = 22

export interface GradientColorSliderProps {
  value: number
  minValue: number
  maxValue: number
  step?: number
  /** 拖动中连续预览（不吸附、不提交） */
  onPreviewChange?: (value: number) => void
  /** 松手后提交（吸附 step） */
  onChange: (value: number) => void
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

function toProgress(value: number, min: number, max: number): number {
  const range = max - min
  if (range <= 0) return 0
  return clamp01((value - min) / range)
}

function valueFromProgress(progress: number, min: number, max: number): number {
  return min + (max - min) * clamp01(progress)
}

/** 叠在渐变轨道上的颜色滑块：固定白底 + 黑色细描边拇指 */
export const GradientColorSlider: React.FC<GradientColorSliderProps> = ({
  value,
  minValue,
  maxValue,
  step = 1,
  onPreviewChange,
  onChange,
  disabled,
  style
}) => {
  const [trackWidth, setTrackWidth] = useState(0)
  const [displayValue, setDisplayValue] = useState(value)
  const trackWidthRef = useRef(0)
  const slidingRef = useRef(false)
  const grantProgressRef = useRef(0)
  const displayRef = useRef(value)
  const configRef = useRef({
    minValue,
    maxValue,
    step,
    onPreviewChange,
    onChange,
    disabled
  })
  configRef.current = { minValue, maxValue, step, onPreviewChange, onChange, disabled }

  useEffect(() => {
    if (slidingRef.current) return
    displayRef.current = value
    setDisplayValue(value)
  }, [value])

  const usableWidth = () => Math.max(1, trackWidthRef.current - THUMB_SIZE)

  const progressFromTouchX = (locationX: number) => {
    return clamp01((locationX - THUMB_SIZE / 2) / usableWidth())
  }

  const previewAtProgress = (progress: number) => {
    const { minValue: min, maxValue: max, onPreviewChange: onPreview } = configRef.current
    const next = valueFromProgress(progress, min, max)
    displayRef.current = next
    setDisplayValue(next)
    onPreview?.(next)
  }

  const commitCurrent = () => {
    const { minValue: min, maxValue: max, step: snap, onChange: onCommit } = configRef.current
    const snapped = snapSliderValue(displayRef.current, min, max, snap)
    displayRef.current = snapped
    setDisplayValue(snapped)
    onCommit(snapped)
  }

  const onGrant = (event: GestureResponderEvent) => {
    slidingRef.current = true
    const progress = progressFromTouchX(event.nativeEvent.locationX)
    grantProgressRef.current = progress
    previewAtProgress(progress)
  }

  const onMove = (_event: GestureResponderEvent, gesture: PanResponderGestureState) => {
    const progress = grantProgressRef.current + gesture.dx / usableWidth()
    previewAtProgress(progress)
  }

  const onRelease = () => {
    slidingRef.current = false
    commitCurrent()
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !configRef.current.disabled,
      onMoveShouldSetPanResponder: () => !configRef.current.disabled,
      onPanResponderGrant: onGrant,
      onPanResponderMove: onMove,
      onPanResponderRelease: onRelease,
      onPanResponderTerminate: onRelease
    })
  ).current

  const onLayout = (event: LayoutChangeEvent) => {
    if (slidingRef.current) return
    const width = event.nativeEvent.layout.width
    if (Math.abs(width - trackWidthRef.current) < 0.5) return
    trackWidthRef.current = width
    setTrackWidth(width)
  }

  const thumbOffset = toProgress(displayValue, minValue, maxValue) * Math.max(0, trackWidth - THUMB_SIZE)

  return (
    <View
      style={[styles.root, style, disabled && styles.disabled]}
      onLayout={onLayout}
      collapsable={false}
      {...panResponder.panHandlers}
    >
      <View
        pointerEvents="none"
        style={[
          styles.thumb,
          {
            transform: [{ translateX: thumbOffset }]
          }
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: NATIVE_SLIDER_HEIGHT,
    justifyContent: 'center'
  },
  disabled: {
    opacity: 0.5
  },
  thumb: {
    position: 'absolute',
    left: 0,
    top: (NATIVE_SLIDER_HEIGHT - THUMB_SIZE) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.72)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 3
  }
})
