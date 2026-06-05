import React from 'react'
import { type StyleProp, type ViewStyle } from 'react-native'
import { Button } from './Button'
import type { CardLinkActionVariant } from './card-link-action.styles'

export interface CardLinkActionProps {
  onPress: () => void
  children: React.ReactNode
  /** card：独立卡片底部操作（如「管理工作区」）；footer：分组底部链接 */
  variant?: CardLinkActionVariant
  disabled?: boolean
  isDisabled?: boolean
  style?: StyleProp<ViewStyle>
}

/** 设置页卡片内统一的 HeroUI 全宽操作按钮 */
export const CardLinkAction: React.FC<CardLinkActionProps> = ({
  onPress,
  children,
  variant = 'card',
  disabled,
  isDisabled,
  style
}) => {
  const mergedDisabled = Boolean(disabled ?? isDisabled)
  const buttonVariant = variant === 'footer' ? 'ghost' : 'primary'

  return (
    <Button
      variant={buttonVariant}
      className="w-full"
      onPress={onPress}
      isDisabled={mergedDisabled}
      style={style}
    >
      {children}
    </Button>
  )
}
