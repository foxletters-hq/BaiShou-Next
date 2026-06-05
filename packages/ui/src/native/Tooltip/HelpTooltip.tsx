import React from 'react'
import { MaterialIcons } from '@expo/vector-icons'
import { Tooltip } from './Tooltip'
import { useNativeTheme } from '../theme'

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
      <MaterialIcons
        name="help-outline"
        size={size}
        color={colors.textTertiary}
        style={{ opacity: 0.8 }}
      />
    </Tooltip>
  )
}
