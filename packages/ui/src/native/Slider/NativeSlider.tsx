import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  StyleSheet,
  Platform,
  PanResponder,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle
} from 'react-native'
import CommunitySlider from '@react-native-community/slider'
import { useNativeTheme } from '../theme'
import {
  NATIVE_SLIDER_HEIGHT,
  getAndroidSliderIntegerScale,
  snapSliderValue,
  toNativeSliderProps,
  type NativeSliderThumbOptions
} from './native-slider.utils'

export type NativeSliderProps = {
  value: number
  minValue?: number
  maxValue?: number
  step?: number
  onChange?: (value: number) => void
  onChangeEnd?: (value: number) => void
  /** 松手后再触发 onChangeEnd；拖动时仅 onChange 预览 */
  commitOnChangeEnd?: boolean
  trackColor?: string
  fillColor?: string
  thumbOptions?: NativeSliderThumbOptions
  minimumTrackTintColor?: string
  maximumTrackTintColor?: string
  thumbTintColor?: string
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}

const THUMB_SIZE = 20
const ANDROID_TRACK_HORIZONTAL_PADDING = 10

function SliderTrack({
  progress,
  minTrack,
  maxTrack,
  thumbColor,
  disabled
}: {
  progress: number
  minTrack: string
  maxTrack: string
  thumbColor: string
  disabled?: boolean
}) {
  const clamped = Math.min(1, Math.max(0, progress))
  return (
    <View style={[trackStyles.root, disabled && trackStyles.disabled]} pointerEvents="none">
      <View style={[trackStyles.track, { backgroundColor: maxTrack }]}>
        <View
          style={[trackStyles.fill, { width: `${clamped * 100}%`, backgroundColor: minTrack }]}
        />
      </View>
      <View
        style={[
          trackStyles.thumb,
          {
            left: `${clamped * 100}%`,
            marginLeft: -THUMB_SIZE / 2,
            backgroundColor: thumbColor
          }
        ]}
      />
    </View>
  )
}

function nativeProgress(value: number, min: number, max: number): number {
  const range = max - min
  if (range <= 0) return 0
  return (value - min) / range
}

export const NativeSlider: React.FC<NativeSliderProps> = ({
  value,
  minValue = 0,
  maxValue = 100,
  step = 1,
  onChange,
  onChangeEnd,
  commitOnChangeEnd: _commitOnChangeEnd = false,
  trackColor,
  fillColor,
  thumbOptions,
  minimumTrackTintColor,
  maximumTrackTintColor,
  thumbTintColor,
  disabled,
  style
}) => {
  const { colors } = useNativeTheme()
  const isSlidingRef = useRef(false)

  const platformScale = Platform.OS === 'android' ? getAndroidSliderIntegerScale(step) : 1
  const nativeProps = useMemo(
    () => toNativeSliderProps(value, minValue, maxValue, step, platformScale),
    [value, minValue, maxValue, step, platformScale]
  )

  const [nativeValue, setNativeValue] = useState(nativeProps.value)
  const nativeValueRef = useRef(nativeProps.value)
  const [androidSliderWidth, setAndroidSliderWidth] = useState(0)

  useEffect(() => {
    if (isSlidingRef.current) return
    setNativeValue(nativeProps.value)
    nativeValueRef.current = nativeProps.value
  }, [nativeProps.value])

  const minTrack = fillColor ?? minimumTrackTintColor ?? colors.primary
  const maxTrack =
    trackColor ?? maximumTrackTintColor ?? colors.bgSurfaceNormal ?? colors.borderMuted
  const thumb = thumbOptions?.thumbColor ?? thumbTintColor ?? colors.primary

  const progress = nativeProgress(
    Platform.OS === 'android' ? nativeValue : nativeProps.value,
    nativeProps.minimumValue,
    nativeProps.maximumValue
  )

  const emit = (raw: number, phase: 'change' | 'end') => {
    const next = nativeProps.logicalFromNative(raw)
    if (phase === 'change') {
      onChange?.(next)
      return
    }
    onChangeEnd?.(next)
  }

  const handleAndroidGesture = (event: GestureResponderEvent, phase: 'change' | 'end') => {
    const usableWidth = Math.max(1, androidSliderWidth - ANDROID_TRACK_HORIZONTAL_PADDING * 2)
    const x = event.nativeEvent.locationX - ANDROID_TRACK_HORIZONTAL_PADDING
    const ratio = Math.min(1, Math.max(0, x / usableWidth))
    const raw =
      nativeProps.minimumValue + (nativeProps.maximumValue - nativeProps.minimumValue) * ratio
    const nextNative = snapSliderValue(
      raw,
      nativeProps.minimumValue,
      nativeProps.maximumValue,
      nativeProps.step
    )
    nativeValueRef.current = nextNative
    setNativeValue(nextNative)
    emit(nextNative, phase)
  }

  const androidPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderGrant: (event) => {
          isSlidingRef.current = true
          handleAndroidGesture(event, 'change')
        },
        onPanResponderMove: (event) => {
          handleAndroidGesture(event, 'change')
        },
        onPanResponderRelease: () => {
          isSlidingRef.current = false
          emit(nativeValueRef.current, 'end')
        },
        onPanResponderTerminate: () => {
          isSlidingRef.current = false
          emit(nativeValueRef.current, 'end')
        }
      }),
    [disabled, androidSliderWidth, nativeProps]
  )

  const handleAndroidLayout = (event: LayoutChangeEvent) => {
    setAndroidSliderWidth(event.nativeEvent.layout.width)
  }

  if (Platform.OS === 'android') {
    return (
      <View
        style={[styles.wrap, style]}
        onLayout={handleAndroidLayout}
        {...androidPanResponder.panHandlers}
      >
        <SliderTrack
          progress={progress}
          minTrack={minTrack}
          maxTrack={maxTrack}
          thumbColor={thumb}
          disabled={disabled}
        />
      </View>
    )
  }

  return (
    <View style={[styles.wrap, style]}>
      <CommunitySlider
        style={styles.slider}
        value={nativeValue}
        minimumValue={nativeProps.minimumValue}
        maximumValue={nativeProps.maximumValue}
        step={nativeProps.step}
        disabled={disabled}
        minimumTrackTintColor={minTrack}
        maximumTrackTintColor={maxTrack}
        thumbTintColor={thumb}
        onValueChange={(raw) => {
          isSlidingRef.current = true
          setNativeValue(raw)
          nativeValueRef.current = raw
          emit(raw, 'change')
        }}
        onSlidingComplete={(raw) => {
          isSlidingRef.current = false
          setNativeValue(raw)
          nativeValueRef.current = raw
          emit(raw, 'end')
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    justifyContent: 'center',
    minHeight: NATIVE_SLIDER_HEIGHT
  },
  slider: {
    width: '100%',
    height: NATIVE_SLIDER_HEIGHT
  }
})

const trackStyles = StyleSheet.create({
  root: {
    width: '100%',
    height: NATIVE_SLIDER_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: ANDROID_TRACK_HORIZONTAL_PADDING
  },
  disabled: {
    opacity: 0.5
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden'
  },
  fill: {
    height: '100%',
    borderRadius: 2
  },
  thumb: {
    position: 'absolute',
    top: (NATIVE_SLIDER_HEIGHT - THUMB_SIZE) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    elevation: 2
  }
})
