import React from 'react'
import type { LucideProps } from 'lucide-react-native'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'

export type { LucideProps }

export interface LucideIconProps extends LucideProps {
  icon: React.ComponentType<LucideProps>
}

/** 统一 Lucide 描边与尺寸默认值 */
export const LucideIcon: React.FC<LucideIconProps> = ({
  icon: Icon,
  size = 18,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  ...props
}) => {
  return <Icon size={size} strokeWidth={strokeWidth} {...props} />
}
