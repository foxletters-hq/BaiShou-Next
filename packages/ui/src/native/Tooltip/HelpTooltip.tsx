import React from 'react'
import { CircleHelp } from 'lucide-react-native'
import { Tooltip } from './Tooltip'
import { useNativeTheme } from '../theme'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'

export interface HelpTooltipProps {
  content: React.ReactNode
  size?: number
  position?: 'top' | 'bottom' | 'center'
}

export const HelpTooltip: React.FC<HelpTooltipProps> = ({
  content,
  size = 18,
  position = 'center'
}) => {
  const { colors } = useNativeTheme()

  if (!content) return null

  return (
    <Tooltip content={content} position={position}>
      <CircleHelp
        size={size}
        color={colors.textTertiary}
        strokeWidth={DEFAULT_STROKE_WIDTH}
        style={{ opacity: 0.8 }}
      />
    </Tooltip>
  )
}
