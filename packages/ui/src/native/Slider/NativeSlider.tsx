import React, { useEffect, useMemo, useState } from 'react'
import {
  View,
  StyleSheet,
  Platform,
  InteractionManager,
  type StyleProp,
  type ViewStyle
} from 'react-native'
import CommunitySlider from '@react-native-community/slider'
import { useNativeTheme } from '../theme'
import {
  NATIVE_SLIDER_HEIGHT,
  getAndroidSliderIntegerScale,
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
  const [androidReady, setAndroidReady] = useState(Platform.OS !== 'android')

  useEffect(() => {
    if (Platform.OS !== 'android') return
    const task = InteractionManager.runAfterInteractions(() => setAndroidReady(true))
    return () => task.cancel()
  }, [])

  const platformScale = Platform.OS === 'android' ? getAndroidSliderIntegerScale(step) : 1
  const nativeProps = useMemo(
    () => toNativeSliderProps(value, minValue, maxValue, step, platformScale),
    [value, minValue, maxValue, step, platformScale]
  )

  const minTrack = fillColor ?? minimumTrackTintColor ?? colors.primary
  const maxTrack =
    trackColor ?? maximumTrackTintColor ?? colors.bgSurfaceNormal ?? colors.borderMuted
  const thumb = thumbOptions?.thumbColor ?? thumbTintColor ?? colors.primary

  const emit = (raw: number, phase: 'change' | 'end') => {
    const next = nativeProps.logicalFromNative(raw)
    if (phase === 'change') {
      onChange?.(next)
      return
    }
    onChangeEnd?.(next)
  }

  return (
    <View style={[styles.wrap, style]}>
      {androidReady ? (
        <CommunitySlider
          style={styles.slider}
          value={nativeProps.value}
          minimumValue={nativeProps.minimumValue}
          maximumValue={nativeProps.maximumValue}
          step={nativeProps.step}
          disabled={disabled}
          minimumTrackTintColor={minTrack}
          maximumTrackTintColor={maxTrack}
          thumbTintColor={thumb}
          onValueChange={(raw) => emit(raw, 'change')}
          onSlidingComplete={(raw) => emit(raw, 'end')}
        />
      ) : null}
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
