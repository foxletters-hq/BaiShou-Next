import i18n from 'i18next'
import React from 'react'
import {
  Puzzle,
  Book,
  Palette,
  Globe,
  Link2,
  Timer,
  BookOpen,
  NotebookPen,
  PenSquare,
  Trash2,
  List,
  Search,
  ScanSearch,
  FileText,
  MessageSquare,
  MessagesSquare,
  Database,
  DatabaseZap,
  Clock,
  Sparkles,
  Share2,
  FolderTree,
  FilePen,
  FileDiff,
  FileX,
  FileSymlink,
  Terminal,
  MessageCircleQuestion,
  FolderOpen
} from 'lucide-react'
import {
  AGENT_TOOL_CATEGORY_ORDER,
  AGENT_TOOL_UI_DEFS,
  WORKSPACE_TOOL_CATEGORY_ORDER,
  WORKSPACE_TOOL_UI_DEFS,
  type AgentToolCategory,
  type WorkspaceToolCategory
} from '@baishou/shared'
import type { AgentToolDef } from './agent-tools.types'

const TOOL_ICONS: Record<string, React.ReactNode> = {
  diary_read: <BookOpen size={20} />,
  diary_write: <NotebookPen size={20} />,
  diary_edit: <PenSquare size={20} />,
  diary_delete: <Trash2 size={20} />,
  diary_list: <List size={20} />,
  diary_search: <Search size={20} />,
  summary_read: <FileText size={20} />,
  message_search: <MessageSquare size={20} />,
  session_list: <MessagesSquare size={20} />,
  vector_search: <ScanSearch size={20} />,
  memory_store: <Database size={20} />,
  memory_delete: <DatabaseZap size={20} />,
  recall_relations: <Share2 size={20} />,
  graph_upsert: <Share2 size={20} />,
  skill_write: <Sparkles size={20} />,
  web_search: <Globe size={20} />,
  url_read: <Link2 size={20} />,
  auto_inject_time: <Clock size={20} />,
  current_time: <Timer size={20} />,
  workspace_list: <FolderTree size={20} />,
  workspace_read: <FileText size={20} />,
  workspace_write: <FilePen size={20} />,
  workspace_patch: <FileDiff size={20} />,
  workspace_delete: <FileX size={20} />,
  workspace_rename: <FileSymlink size={20} />,
  workspace_run: <Terminal size={20} />,
  companion_ask: <MessageCircleQuestion size={20} />
}

const CATEGORY_ICONS: Record<AgentToolCategory, React.ReactNode> = {
  diary: <Book size={18} />,
  summary: <FileText size={18} />,
  memory: <Palette size={18} />,
  search: <Globe size={18} />,
  general: <Puzzle size={18} />
}

const WORKSPACE_CATEGORY_ICONS: Record<WorkspaceToolCategory, React.ReactNode> = {
  browse: <FolderOpen size={18} />,
  mutate: <FilePen size={18} />,
  command: <Terminal size={18} />,
  utility: <Puzzle size={18} />
}

const CATEGORY_LABEL_KEYS: Record<AgentToolCategory, string> = {
  diary: 'settings.agent_tools_category_diary',
  summary: 'settings.agent_tools_category_summary',
  memory: 'settings.agent_tools_category_memory',
  search: 'settings.agent_tools_category_search',
  general: 'settings.agent_tools_category_general'
}

const WORKSPACE_CATEGORY_LABEL_KEYS: Record<WorkspaceToolCategory, string> = {
  browse: 'settings.agent_tools_category_browse',
  mutate: 'settings.agent_tools_category_mutate',
  command: 'settings.agent_tools_category_command',
  utility: 'settings.agent_tools_category_utility'
}

const CATEGORY_LABEL_FALLBACKS: Record<AgentToolCategory, string> = {
  diary: i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L64',
    '日记工具'
  ),
  summary: i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L65',
    '总结工具'
  ),
  memory: i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L66',
    '记忆工具'
  ),
  search: i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L67',
    '搜索工具'
  ),
  general: i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L68',
    '通用工具'
  )
}

const WORKSPACE_CATEGORY_LABEL_FALLBACKS: Record<WorkspaceToolCategory, string> = {
  browse: i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L126',
    '文件浏览'
  ),
  mutate: i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L127',
    '文件修改'
  ),
  command: i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L128',
    '命令执行'
  ),
  utility: i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L129',
    '交互与通用'
  )
}

const TOOL_NAME_FALLBACKS: Record<string, string> = {
  'agent.tools.diary_read': i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L133',
    '日记读取'
  ),
  'agent.tools.diary_write': i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L134',
    '日记写入'
  ),
  'agent.tools.diary_edit': i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L135',
    '日记编辑'
  ),
  'agent.tools.diary_delete': i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L136',
    '日记删除'
  ),
  'agent.tools.diary_list': i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L137',
    '日记列表'
  ),
  'agent.tools.diary_search': i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L138',
    '日记搜索'
  ),
  'agent.tools.summary_read': i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L139',
    '总结读取'
  ),
  'agent.tools.message_search': i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L140',
    '消息搜索'
  ),
  'agent.tools.session_list': i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L140b',
    '会话列表'
  ),
  'agent.tools.vector_search': i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L141',
    '语义搜索'
  ),
  'agent.tools.memory_store': i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L142',
    '记忆存储'
  ),
  'agent.tools.memory_delete': i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L143',
    '记忆删除'
  ),
  'agent.tools.recall_relations': i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L144',
    '回忆人生关系图'
  ),
  'agent.tools.graph_upsert': i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L145',
    '写入人生关系图'
  ),
  'agent.tools.web_search': i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L146',
    '网络搜索'
  ),
  'agent.tools.url_read': i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L147',
    '网页读取'
  ),
  'agent.tools.auto_inject_time': i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L148',
    '当前时间'
  ),
  'agent.tools.current_time': i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L149',
    '查询时间'
  ),
  'agent.tools.param_max_results': i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L150',
    '搜索结果上限'
  ),
  'agent.tools.workspace_list': i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L151',
    '列出文件'
  ),
  'agent.tools.workspace_read': i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L152',
    '读取文件'
  ),
  'agent.tools.workspace_write': i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L153',
    '写入文件'
  ),
  'agent.tools.workspace_patch': i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L154',
    '修补文件'
  ),
  'agent.tools.workspace_rename': i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L155',
    '重命名文件'
  ),
  'agent.tools.workspace_delete': i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L156',
    '删除文件'
  ),
  'agent.tools.workspace_run': i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L157',
    '运行命令'
  ),
  'agent.tools.companion_ask': i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L158',
    '向用户提问'
  ),
  'agent.tools.skill_write': i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L159',
    '保存技能'
  ),
  'agent.tools.knowledge_search': i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L160',
    '知识库搜索'
  ),
  'agent.tools.knowledge_graph_search': i18n.t(
    'auto.packages.ui.src.desktop.AgentToolsView.agent.tools.constants.L161',
    '知识图谱搜索'
  )
}

export function buildAgentTools(t: (key: string, fallback: string) => string): AgentToolDef[] {
  return AGENT_TOOL_UI_DEFS.map((def) => ({
    id: def.id,
    category: def.category,
    name: t(def.nameKey, TOOL_NAME_FALLBACKS[def.nameKey] ?? def.id),
    icon: TOOL_ICONS[def.id] ?? <Puzzle size={20} />,
    tooltipKey: def.tooltipKey,
    canBeDisabled: def.canBeDisabled,
    configurableParams: def.configurableParams?.map((param) => ({
      key: param.key,
      label: t(param.labelKey, TOOL_NAME_FALLBACKS[param.labelKey] ?? param.key),
      type: param.type,
      defaultValue: param.defaultValue,
      min: param.min,
      max: param.max,
      icon: param.icon
    }))
  }))
}

export function buildWorkspaceTools(t: (key: string, fallback: string) => string): AgentToolDef[] {
  return WORKSPACE_TOOL_UI_DEFS.map((def) => ({
    id: def.id,
    category: def.category,
    name: t(def.nameKey, TOOL_NAME_FALLBACKS[def.nameKey] ?? def.id),
    icon: TOOL_ICONS[def.id] ?? <Puzzle size={20} />,
    tooltipKey: def.tooltipKey,
    canBeDisabled: def.canBeDisabled,
    configurableParams: def.configurableParams?.map((param) => ({
      key: param.key,
      label: t(param.labelKey, TOOL_NAME_FALLBACKS[param.labelKey] ?? param.key),
      type: param.type,
      defaultValue: param.defaultValue,
      min: param.min,
      max: param.max,
      icon: param.icon
    }))
  }))
}

export function buildCategoryMeta(
  t: (key: string, fallback: string) => string
): Record<string, { label: string; icon: React.ReactNode }> {
  return Object.fromEntries(
    AGENT_TOOL_CATEGORY_ORDER.map((category) => [
      category,
      {
        label: t(CATEGORY_LABEL_KEYS[category], CATEGORY_LABEL_FALLBACKS[category]),
        icon: CATEGORY_ICONS[category]
      }
    ])
  )
}

export function buildWorkspaceCategoryMeta(
  t: (key: string, fallback: string) => string
): Record<string, { label: string; icon: React.ReactNode }> {
  return Object.fromEntries(
    WORKSPACE_TOOL_CATEGORY_ORDER.map((category) => [
      category,
      {
        label: t(
          WORKSPACE_CATEGORY_LABEL_KEYS[category],
          WORKSPACE_CATEGORY_LABEL_FALLBACKS[category]
        ),
        icon: WORKSPACE_CATEGORY_ICONS[category]
      }
    ])
  )
}

export { AGENT_TOOL_CATEGORY_ORDER, WORKSPACE_TOOL_CATEGORY_ORDER }
