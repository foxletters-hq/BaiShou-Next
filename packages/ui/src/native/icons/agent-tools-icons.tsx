import React from 'react'
import type { LucideProps } from 'lucide-react-native'
import {
  Book,
  BookOpen,
  Clock,
  NotebookPen,
  Database,
  DatabaseZap,
  FileText,
  Globe,
  Link2,
  List,
  MessageSquare,
  Palette,
  PenSquare,
  Puzzle,
  ScanSearch,
  Search,
  Share2,
  Timer,
  Trash2
} from 'lucide-react-native'
import {
  AGENT_TOOL_CATEGORY_ICON_IDS,
  AGENT_TOOL_ICON_IDS,
  type AgentToolCategoryIconId,
  type AgentToolIconId
} from '../../shared/icons/agent-tools-icon-ids'
import {
  AGENT_TOOL_CATEGORY_ICON_SIZE,
  AGENT_TOOL_ICON_SIZE,
  DEFAULT_STROKE_WIDTH
} from '../../shared/icons/icon-sizes'

const TOOL_ICONS: Record<AgentToolIconId, React.ComponentType<LucideProps>> = {
  diary_read: BookOpen,
  diary_write: NotebookPen,
  diary_edit: PenSquare,
  diary_delete: Trash2,
  diary_list: List,
  diary_search: Search,
  summary_read: FileText,
  message_search: MessageSquare,
  vector_search: ScanSearch,
  memory_store: Database,
  memory_delete: DatabaseZap,
  recall_relations: Share2,
  graph_upsert: Share2,
  web_search: Globe,
  url_read: Link2,
  auto_inject_time: Clock,
  current_time: Timer
}

const CATEGORY_ICONS: Record<AgentToolCategoryIconId, React.ComponentType<LucideProps>> = {
  diary: Book,
  summary: FileText,
  memory: Palette,
  search: Globe,
  general: Puzzle
}

export interface AgentToolIconProps extends Omit<LucideProps, 'ref'> {
  toolId: string
}

export const AgentToolIcon: React.FC<AgentToolIconProps> = ({
  toolId,
  size = AGENT_TOOL_ICON_SIZE,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  ...props
}) => {
  const key = toolId as AgentToolIconId
  const Icon = TOOL_ICONS[key]
  if (!Icon) return null
  return <Icon size={size} strokeWidth={strokeWidth} {...props} />
}

export interface AgentToolCategoryIconProps extends Omit<LucideProps, 'ref'> {
  categoryId: string
}

export const AgentToolCategoryIcon: React.FC<AgentToolCategoryIconProps> = ({
  categoryId,
  size = AGENT_TOOL_CATEGORY_ICON_SIZE,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  ...props
}) => {
  const key = categoryId as AgentToolCategoryIconId
  const Icon = CATEGORY_ICONS[key]
  if (!Icon) return null
  return <Icon size={size} strokeWidth={strokeWidth} {...props} />
}

export { TOOL_ICONS, CATEGORY_ICONS, AGENT_TOOL_ICON_IDS, AGENT_TOOL_CATEGORY_ICON_IDS }
