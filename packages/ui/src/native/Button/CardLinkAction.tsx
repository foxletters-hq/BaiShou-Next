import React from 'react'
import { type StyleProp, type ViewStyle } from 'react-native'
import { Button } from './Button'
import { cardLinkActionStyles, type CardLinkActionVariant } from './card-link-action.styles'

export interface CardLinkActionProps {
  onPress: () => void
  children: React.ReactNode
  /** card：独立卡片底部操作（如「管理工作空间」）；footer：分组底部链接 */
  variant?: CardLinkActionVariant
  disabled?: boolean
  isDisabled?: boolean
  style?: StyleProp<ViewStyle>
}

/** 设置页卡片内统一的描边操作按钮，支持 card（通栏居中平放）与 footer（居中） */
export const CardLinkAction: React.FC<CardLinkActionProps> = ({
  onPress,
  children,
  variant = 'card',
  disabled,
  isDisabled,
  style
}) => {
  const mergedDisabled = Boolean(disabled ?? isDisabled)
  const variantStyle = cardLinkActionStyles[variant]

  return (
    <Button
      variant="outlined"
      onPress={onPress}
      isDisabled={mergedDisabled}
      style={[variantStyle, style]}
    >
      {children}
    </Button>
  )
}
