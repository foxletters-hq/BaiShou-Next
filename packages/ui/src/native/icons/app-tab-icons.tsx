import React from 'react'
import type { LucideProps } from 'lucide-react-native'
import { BookOpen, Library, Settings, Sparkles } from 'lucide-react-native'
import type { AppTabIconId } from '../../shared/icons/app-tab-icon-ids'
import { DEFAULT_STROKE_WIDTH, TAB_ICON_SIZE } from '../../shared/icons/icon-sizes'

const APP_TAB_ICONS: Record<AppTabIconId, React.ComponentType<LucideProps>> = {
  diary: BookOpen,
  agent: Sparkles,
  summary: Library,
  settings: Settings
}

export interface AppTabIconProps extends Omit<LucideProps, 'ref'> {
  id: AppTabIconId
}

export const AppTabIcon: React.FC<AppTabIconProps> = ({
  id,
  size = TAB_ICON_SIZE,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  ...props
}) => {
  const Icon = APP_TAB_ICONS[id]
  return <Icon size={size} strokeWidth={strokeWidth} {...props} />
}

export { APP_TAB_ICONS }
