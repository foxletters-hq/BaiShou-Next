import React, { useEffect, useState } from 'react'
import { Slider } from 'heroui-native'
import type { ComponentProps } from 'react'
import { useNativeTheme } from '../theme'
import {
  getHeroSliderFillStyle,
  getHeroSliderThumbStyles,
  getHeroSliderTrackStyle,
  type NativeSliderThumbOptions
} from './native-slider.utils'

type HeroSliderProps = ComponentProps<typeof Slider>
type SliderValue = NonNullable<HeroSliderProps['value']>

export type NativeSliderProps = Omit<HeroSliderProps, 'children'> & {
  trackColor?: string
  fillColor?: string
  thumbOptions?: NativeSliderThumbOptions
  /**
   * 拖动时由 NativeSlider 内部维持滑块位置，并持续触发 onChange（预览）；
   * 松手后通过 onChangeEnd 提交。用于避免父组件每帧重渲染导致卡顿。
   */
  commitOnChangeEnd?: boolean
}

export const NativeSlider: React.FC<NativeSliderProps> = ({
  trackColor,
  fillColor,
  thumbOptions,
  commitOnChangeEnd = false,
  value,
  defaultValue,
  onChange,
  onChangeEnd,
  ...sliderProps
}) => {
  const { colors } = useNativeTheme()
  const [draftValue, setDraftValue] = useState<SliderValue>(
    (value ?? defaultValue ?? 0) as SliderValue
  )

  useEffect(() => {
    if (value !== undefined) {
      setDraftValue(value as SliderValue)
    }
  }, [value])

  const handleChange = (next: SliderValue) => {
    if (commitOnChangeEnd) {
      setDraftValue(next)
      onChange?.(next)
      return
    }

    onChange?.(next)
  }

  const handleChangeEnd = (next: SliderValue) => {
    if (commitOnChangeEnd) {
      setDraftValue(next)
      onChangeEnd?.(next)
      return
    }

    onChangeEnd?.(next)
  }

  return (
    <Slider
      {...sliderProps}
      value={commitOnChangeEnd ? draftValue : value}
      defaultValue={commitOnChangeEnd ? undefined : defaultValue}
      onChange={handleChange}
      onChangeEnd={handleChangeEnd}
    >
      <Slider.Track style={getHeroSliderTrackStyle(colors, trackColor)}>
        <Slider.Fill style={getHeroSliderFillStyle(colors, fillColor)} />
        <Slider.Thumb styles={getHeroSliderThumbStyles(colors, thumbOptions)} />
      </Slider.Track>
    </Slider>
  )
}

export type NativeSliderThumbProps = ComponentProps<typeof Slider.Thumb> & NativeSliderThumbOptions

/** 自定义轨道时挂载胶囊形拇指 */
export const NativeSliderThumb: React.FC<NativeSliderThumbProps> = ({
  thumbColor,
  thumbKnobColor,
  index,
  styles: stylesProp,
  ...rest
}) => {
  const { colors } = useNativeTheme()
  const base = getHeroSliderThumbStyles(colors, { thumbColor, thumbKnobColor })

  return (
    <Slider.Thumb
      index={index}
      styles={{
        thumbContainer: { ...base.thumbContainer, ...stylesProp?.thumbContainer },
        thumbKnob: { ...base.thumbKnob, ...stylesProp?.thumbKnob }
      }}
      {...rest}
    />
  )
}
