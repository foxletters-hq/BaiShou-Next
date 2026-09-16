import React from 'react'
import { type StyleProp, type ViewStyle } from 'react-native'
import { Button } from './Button'
import type { CardLinkActionVariant } from './card-link-action.styles'

export interface CardLinkActionProps {
  onPress: () => void
  children: React.ReactNode
  /** card：独立卡片底部操作（如「管理工作空间」）；footer：分组底部链接 */
  variant?: CardLinkActionVariant
  disabled?: boolean
  isDisabled?: boolean
  style?: StyleProp<ViewStyle>
}

/** 设置页卡片内统一的描边操作按钮，宽度跟内容走 */
export const CardLinkAction: React.FC<CardLinkActionProps> = ({
  onPress,
  children,
  disabled,
  isDisabled,
  style
}) => {
  const mergedDisabled = Boolean(disabled ?? isDisabled)

  return (
    <Button variant="outlined" onPress={onPress} isDisabled={mergedDisabled} style={style}>
      {children}
    </Button>
  )
}
