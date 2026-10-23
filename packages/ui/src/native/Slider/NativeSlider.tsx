import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  StyleSheet,
  PanResponder,
  Platform,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle
} from 'react-native'
import { useNativeTheme } from '../theme'
import {
  NATIVE_SLIDER_HEIGHT,
  NATIVE_SLIDER_THUMB_SIZE,
  NATIVE_SLIDER_TRACK_HEIGHT,
  SLIDER_TRACK_HORIZONTAL_PADDING,
  nativeValueFromPageX,
  snapSliderValue,
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
  const trackTransparent = maxTrack === 'transparent'
  const fillTransparent = minTrack === 'transparent'

  return (
    <View style={[trackStyles.root, disabled && trackStyles.disabled]} pointerEvents="none">
      {!trackTransparent ? (
        <View style={[trackStyles.track, { backgroundColor: maxTrack }]}>
          {!fillTransparent ? (
            <View
              style={[trackStyles.fill, { width: `${clamped * 100}%`, backgroundColor: minTrack }]}
            />
          ) : null}
        </View>
      ) : null}
      <View style={trackStyles.thumbTrack}>
        <View
          style={[
            trackStyles.thumb,
            {
              left: `${clamped * 100}%`,
              marginLeft: -NATIVE_SLIDER_THUMB_SIZE / 2,
              backgroundColor: thumbColor
            }
          ]}
        />
      </View>
    </View>
  )
}

function nativeProgress(value: number, min: number, max: number): number {
  const range = max - min
  if (range <= 0) return 0
  return (value - min) / range
}

type SliderGestureConfig = {
  disabled?: boolean
  minValue: number
  maxValue: number
  step: number
  onChange?: (value: number) => void
  onChangeEnd?: (value: number) => void
  trackWidth: number
  trackPageX: number
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
  const [displayValue, setDisplayValue] = useState(() =>
    snapSliderValue(value, minValue, maxValue, step)
  )
  const displayRef = useRef(displayValue)

  const configRef = useRef<SliderGestureConfig>({
    disabled,
    minValue,
    maxValue,
    step,
    onChange,
    onChangeEnd,
    trackWidth: 0,
    trackPageX: 0
  })
  configRef.current = {
    ...configRef.current,
    disabled,
    minValue,
    maxValue,
    step,
    onChange,
    onChangeEnd
  }

  useEffect(() => {
    if (isSlidingRef.current) return
    const next = snapSliderValue(value, minValue, maxValue, step)
    displayRef.current = next
    setDisplayValue(next)
  }, [value, minValue, maxValue, step])

  const minTrack = fillColor ?? minimumTrackTintColor ?? colors.primary
  const maxTrack =
    trackColor ?? maximumTrackTintColor ?? colors.bgSurfaceNormal ?? colors.borderMuted
  const thumb = thumbOptions?.thumbColor ?? thumbTintColor ?? colors.primary

  const applyPageX = (pageX: number) => {
    const cfg = configRef.current
    const next = nativeValueFromPageX({
      pageX,
      trackPageX: cfg.trackPageX,
      trackWidth: cfg.trackWidth,
      minimumValue: cfg.minValue,
      maximumValue: cfg.maxValue,
      step: cfg.step
    })
    displayRef.current = next
    setDisplayValue(next)
    cfg.onChange?.(next)
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !configRef.current.disabled,
      onMoveShouldSetPanResponder: () => !configRef.current.disabled,
      onStartShouldSetPanResponderCapture: () => !configRef.current.disabled,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (event: GestureResponderEvent) => {
        const { pageX, locationX } = event.nativeEvent
        // 按下时触点仍在轨道上，locationX 可信，用来记下轨道的屏幕原点
        configRef.current.trackPageX = pageX - locationX
        isSlidingRef.current = true
        applyPageX(pageX)
      },
      onPanResponderMove: (event: GestureResponderEvent) => {
        applyPageX(event.nativeEvent.pageX)
      },
      onPanResponderRelease: () => {
        isSlidingRef.current = false
        configRef.current.onChangeEnd?.(displayRef.current)
      },
      onPanResponderTerminate: () => {
        isSlidingRef.current = false
        configRef.current.onChangeEnd?.(displayRef.current)
      }
    })
  ).current

  const handleLayout = (event: LayoutChangeEvent) => {
    configRef.current.trackWidth = event.nativeEvent.layout.width
  }

  return (
    <View
      style={[styles.wrap, style, Platform.OS === 'web' ? webNoTouchPan : null]}
      onLayout={handleLayout}
      collapsable={false}
      {...panResponder.panHandlers}
    >
      <SliderTrack
        progress={nativeProgress(displayValue, minValue, maxValue)}
        minTrack={minTrack}
        maxTrack={maxTrack}
        thumbColor={thumb}
        disabled={disabled}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    minHeight: NATIVE_SLIDER_HEIGHT
  }
})

const webNoTouchPan = { touchAction: 'none' } as ViewStyle

const trackStyles = StyleSheet.create({
  root: {
    width: '100%',
    height: NATIVE_SLIDER_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: SLIDER_TRACK_HORIZONTAL_PADDING
  },
  disabled: {
    opacity: 0.5
  },
  track: {
    height: NATIVE_SLIDER_TRACK_HEIGHT,
    borderRadius: NATIVE_SLIDER_TRACK_HEIGHT / 2,
    overflow: 'hidden'
  },
  fill: {
    height: '100%',
    borderRadius: NATIVE_SLIDER_TRACK_HEIGHT / 2
  },
  thumbTrack: {
    position: 'absolute',
    left: SLIDER_TRACK_HORIZONTAL_PADDING,
    right: SLIDER_TRACK_HORIZONTAL_PADDING,
    top: 0,
    bottom: 0
  },
  thumb: {
    position: 'absolute',
    top: (NATIVE_SLIDER_HEIGHT - NATIVE_SLIDER_THUMB_SIZE) / 2,
    width: NATIVE_SLIDER_THUMB_SIZE,
    height: NATIVE_SLIDER_THUMB_SIZE,
    borderRadius: NATIVE_SLIDER_THUMB_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth
  }
})
