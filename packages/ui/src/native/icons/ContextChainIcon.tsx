import React from 'react'
import type { LucideProps } from 'lucide-react-native'
import { ListTree } from 'lucide-react-native'
import { useNativeTheme } from '../theme'
import { CONTEXT_CHAIN_HEADER_ICON_SIZE, DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'

export interface ContextChainIconProps extends Omit<LucideProps, 'ref'> {
  size?: number
}

/** 调用链 / 上下文树 — 与桌面端 ListTree 一致 */
export const ContextChainIcon: React.FC<ContextChainIconProps> = ({
  size = CONTEXT_CHAIN_HEADER_ICON_SIZE,
  color,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  ...props
}) => {
  const { colors } = useNativeTheme()
  return (
    <ListTree size={size} color={color ?? colors.primary} strokeWidth={strokeWidth} {...props} />
  )
}
