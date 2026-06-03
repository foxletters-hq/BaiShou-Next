import React from 'react'
import { Switch as HeroSwitch } from 'heroui-native/switch'

export interface NativeSwitchProps {
  value?: boolean
  onValueChange?: (value: boolean) => void
  disabled?: boolean
}

/**
 * HeroUI Native Switch：滑块与轨道同步动画（HeroUI Native 组件）。
 * API 保持与白守原有 `value` / `onValueChange` 兼容。
 */
export const Switch: React.FC<NativeSwitchProps> = ({
  value = false,
  onValueChange,
  disabled = false
}) => (
  <HeroSwitch
    isSelected={value}
    onSelectedChange={onValueChange}
    isDisabled={disabled}
  />
)
