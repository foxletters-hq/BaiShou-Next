import React from 'react'
import { View, StyleSheet } from 'react-native'
import { NativeSlider } from '../Slider'

interface DesktopStyleSliderProps {
  value: number
  minimumValue?: number
  maximumValue?: number
  step?: number
  /** 拖动过程中实时回调，用于同步预览显示 */
  onPreviewChange?: (value: number) => void
  /** 松手后提交；未开启 commitOnChangeEnd 时等同每次 onChange */
  onValueChange: (value: number) => void
  commitOnChangeEnd?: boolean
}

export const DesktopStyleSlider: React.FC<DesktopStyleSliderProps> = ({
  value,
  minimumValue = 1,
  maximumValue = 60,
  step = 1,
  onPreviewChange,
  onValueChange,
  commitOnChangeEnd = true
}) => {
  return (
    <View style={styles.wrap}>
      <NativeSlider
        value={value}
        minValue={minimumValue}
        maxValue={maximumValue}
        step={step}
        commitOnChangeEnd={commitOnChangeEnd}
        onChange={(v) => {
          const next = v as number
          onPreviewChange?.(next)
          if (!commitOnChangeEnd) onValueChange(next)
        }}
        onChangeEnd={(v) => {
          if (commitOnChangeEnd) onValueChange(v as number)
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 8
  }
})
