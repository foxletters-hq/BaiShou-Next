import React from 'react'
import { CircleHelp } from 'lucide-react-native'
import { Tooltip } from './Tooltip'
import { useNativeTheme } from '../theme'
import { DEFAULT_STROKE_WIDTH, HELP_ICON_SIZE } from '../../shared/icons/icon-sizes'

export interface HelpTooltipProps {
  content: React.ReactNode
  /** 已废弃：问号统一使用 HELP_ICON_SIZE，传入值不会生效。 */
  size?: number
  position?: 'top' | 'bottom' | 'center'
}

export const HelpTooltip: React.FC<HelpTooltipProps> = ({
  content,
  size: _size,
  position = 'center'
}) => {
  const { colors } = useNativeTheme()

  if (!content) return null

  return (
    <Tooltip content={content} position={position}>
      <CircleHelp
        size={HELP_ICON_SIZE}
        color={colors.textTertiary}
        strokeWidth={DEFAULT_STROKE_WIDTH}
        style={{ opacity: 0.8 }}
      />
    </Tooltip>
  )
}
