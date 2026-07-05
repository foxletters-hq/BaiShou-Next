import React from 'react'
import type { LucideProps } from 'lucide-react-native'
import {
  Archive,
  ArrowLeftRight,
  Cable,
  Cloud,
  Database,
  FolderOpen,
  Globe,
  GraduationCap,
  NotebookPen,
  Paperclip,
  Puzzle,
  RefreshCw,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  Wifi
} from 'lucide-react-native'
import type { SettingsNavIconId } from '../../shared/icons/settings-nav-icon-ids'
import { DEFAULT_STROKE_WIDTH, NAV_ICON_SIZE } from '../../shared/icons/icon-sizes'

const SETTINGS_NAV_ICONS: Record<SettingsNavIconId, React.ComponentType<LucideProps>> = {
  'ai-services': Cloud,
  'ai-models': SlidersHorizontal,
  assistants: GraduationCap,
  rag: Database,
  'web-search': Globe,
  mcp: Cable,
  'agent-tools': Puzzle,
  tts: Volume2,
  'diary-template': NotebookPen,
  'summary-settings': Sparkles,
  'incremental-sync': RefreshCw,
  'data-sync': Archive,
  attachments: Paperclip,
  'lan-transfer': Wifi,
  storage: FolderOpen,
  'version-migration': ArrowLeftRight,
  general: Settings
}

export interface SettingsNavIconProps extends Omit<LucideProps, 'ref'> {
  id: SettingsNavIconId
}

export const SettingsNavIcon: React.FC<SettingsNavIconProps> = ({
  id,
  size = NAV_ICON_SIZE,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  ...props
}) => {
  const Icon = SETTINGS_NAV_ICONS[id]
  return <Icon size={size} strokeWidth={strokeWidth} {...props} />
}

export { SETTINGS_NAV_ICONS }
