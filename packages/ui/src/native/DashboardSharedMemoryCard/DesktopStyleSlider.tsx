import React from 'react'
import { NativeSlider } from '../Slider'

interface DesktopStyleSliderProps {
  value: number
  minimumValue?: number
  maximumValue?: number
  step?: number
  /** 拖动过程中实时回调，用于同步预览显示 */
  onPreviewChange?: (value: number) => void
  /** 松手后提交 */
  onValueChange: (value: number) => void
}

export const DesktopStyleSlider: React.FC<DesktopStyleSliderProps> = ({
  value,
  minimumValue = 1,
  maximumValue = 60,
  step = 1,
  onPreviewChange,
  onValueChange
}) => {
  return (
    <NativeSlider
      value={value}
      minValue={minimumValue}
      maxValue={maximumValue}
      step={step}
      commitOnChangeEnd
      onChange={onPreviewChange}
      onChangeEnd={(next) => {
        if (next !== value) {
          onValueChange(next)
        }
      }}
    />
  )
}
