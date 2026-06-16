import React from 'react'
import type { TFunction } from 'i18next'
import {
  MdTimeline,
  MdAutoStories,
  MdOutlineSettings,
  MdOutlineCloudQueue,
  MdOutlineStarBorder,
  MdSchool,
  MdColorLens,
  MdTravelExplore,
  MdOutlineExtension,
  MdOutlineAutoAwesome,
  MdWifi,
  MdOutlineStorage,
  MdOutlineCollections,
  MdVolumeUp,
  MdHistory,
  MdOutlineHub,
  MdSync,
  MdEditNote,
  MdTextSnippet
} from 'react-icons/md'
import { SETTINGS_HUB_PREFIX } from '../../features/settings/settings-route.util'

export const SIDEBAR_NAV_ICON_SIZE = 20

export function sidebarNavIcon(icon: React.ReactElement<{ size?: number }>): React.ReactNode {
  return React.cloneElement(icon, { size: SIDEBAR_NAV_ICON_SIZE })
}

export const DEFAULT_VISIBLE_NAV_IDS = ['diary', 'summary', 'incremental-sync', 'git'] as const

/** 与系统设置侧边栏条目一一对应（另含日记区核心页 diary / summary） */
export const ALL_SIDEBAR_NAV_IDS = [
  'diary',
  'summary',
  'diary-template',
  'diary-ai-writing',
  'general',
  'mcp',
  'ai-services',
  'ai-models',
  'assistants',
  'rag',
  'web-search',
  'agent-tools',
  'summary-settings',
  'tts',
  'incremental-sync',
  'sync',
  'git',
  'attachments',
  'lan'
] as const

export type SidebarNavId = (typeof ALL_SIDEBAR_NAV_IDS)[number]

/** 「同步与数据」分组内默认顺序 */
export const SYNC_SIDEBAR_NAV_IDS: SidebarNavId[] = [
  'incremental-sync',
  'sync',
  'git',
  'attachments',
  'lan'
]

export function reorderSyncNavIdsInOrder(order: readonly string[]): string[] {
  const syncSet = new Set<string>(SYNC_SIDEBAR_NAV_IDS)
  const syncItems = SYNC_SIDEBAR_NAV_IDS.filter((id) => order.includes(id))
  if (syncItems.length === 0) return [...order]

  const withoutSync = order.filter((id) => !syncSet.has(id))
  const firstSyncIndex = order.findIndex((id) => syncSet.has(id))
  const insertAt = Math.min(Math.max(firstSyncIndex, 0), withoutSync.length)

  return [...withoutSync.slice(0, insertAt), ...syncItems, ...withoutSync.slice(insertAt)]
}

export interface SidebarNavGroupDef {
  key: string
  labelKey: string
  defaultLabel: string
  itemIds: SidebarNavId[]
}

export const SIDEBAR_NAV_GROUPS: SidebarNavGroupDef[] = [
  {
    key: 'diary',
    labelKey: 'sidebar.group_diary',
    defaultLabel: '日记与回忆',
    itemIds: ['diary', 'summary', 'diary-template', 'diary-ai-writing', 'summary-settings']
  },
  {
    key: 'settings-general',
    labelKey: 'sidebar.group_settings_general',
    defaultLabel: '常规',
    itemIds: ['general', 'mcp']
  },
  {
    key: 'settings-ai',
    labelKey: 'sidebar.group_settings_ai',
    defaultLabel: 'AI 与模型',
    itemIds: ['ai-services', 'ai-models', 'assistants']
  },
  {
    key: 'memory',
    labelKey: 'sidebar.group_memory',
    defaultLabel: '记忆与工具',
    itemIds: ['rag', 'web-search', 'agent-tools', 'tts']
  },
  {
    key: 'sync',
    labelKey: 'sidebar.group_sync',
    defaultLabel: '同步与数据',
    itemIds: ['incremental-sync', 'sync', 'git', 'attachments', 'lan']
  }
]

export const SIDEBAR_NAV_PATHS: Record<SidebarNavId, string> = {
  diary: '/diary',
  summary: '/summary',
  'diary-template': `${SETTINGS_HUB_PREFIX}/diary-template`,
  'diary-ai-writing': `${SETTINGS_HUB_PREFIX}/diary-ai-writing`,
  general: `${SETTINGS_HUB_PREFIX}/general`,
  mcp: `${SETTINGS_HUB_PREFIX}/mcp`,
  'ai-services': `${SETTINGS_HUB_PREFIX}/ai-services`,
  'ai-models': `${SETTINGS_HUB_PREFIX}/ai-models`,
  assistants: `${SETTINGS_HUB_PREFIX}/assistants`,
  rag: `${SETTINGS_HUB_PREFIX}/rag`,
  'web-search': `${SETTINGS_HUB_PREFIX}/web-search`,
  'agent-tools': `${SETTINGS_HUB_PREFIX}/agent-tools`,
  'summary-settings': `${SETTINGS_HUB_PREFIX}/summary`,
  tts: `${SETTINGS_HUB_PREFIX}/tts`,
  lan: `${SETTINGS_HUB_PREFIX}/lan-transfer`,
  sync: `${SETTINGS_HUB_PREFIX}/data-sync`,
  'incremental-sync': `${SETTINGS_HUB_PREFIX}/incremental-sync`,
  attachments: `${SETTINGS_HUB_PREFIX}/attachments`,
  git: `${SETTINGS_HUB_PREFIX}/git`
}

export interface SidebarNavItemView {
  icon: React.ReactNode
  label: string
  path: string
}

export function buildSidebarNavItems(t: TFunction): Record<SidebarNavId, SidebarNavItemView> {
  const icon = sidebarNavIcon
  return {
    diary: { icon: icon(<MdTimeline />), label: t('diary.title', '日记'), path: '/diary' },
    summary: {
      icon: icon(<MdAutoStories />),
      label: t('summary.dashboard_title', '回忆'),
      path: '/summary'
    },
    'diary-template': {
      icon: icon(<MdEditNote />),
      label: t('settings.diary_template_title', '日记模板'),
      path: `${SETTINGS_HUB_PREFIX}/diary-template`
    },
    'diary-ai-writing': {
      icon: icon(<MdTextSnippet />),
      label: t('settings.diary_partner_writing_title', '伙伴书写规范'),
      path: `${SETTINGS_HUB_PREFIX}/diary-ai-writing`
    },
    general: {
      icon: icon(<MdOutlineSettings />),
      label: t('settings.general', '常规设置'),
      path: `${SETTINGS_HUB_PREFIX}/general`
    },
    mcp: {
      icon: icon(<MdOutlineHub />),
      label: t('settings.mcp_title', 'MCP 服务'),
      path: `${SETTINGS_HUB_PREFIX}/mcp`
    },
    'ai-services': {
      icon: icon(<MdOutlineCloudQueue />),
      label: t('settings.ai_services', '供应商管理'),
      path: `${SETTINGS_HUB_PREFIX}/ai-services`
    },
    'ai-models': {
      icon: icon(<MdOutlineStarBorder />),
      label: t('settings.ai_global_models', '全局默认模型'),
      path: `${SETTINGS_HUB_PREFIX}/ai-models`
    },
    assistants: {
      icon: icon(<MdSchool />),
      label: t('agent.assistant.settings_entry', '伙伴管理'),
      path: `${SETTINGS_HUB_PREFIX}/assistants`
    },
    rag: {
      icon: icon(<MdColorLens />),
      label: t('agent.rag.title', 'RAG 记忆管理'),
      path: `${SETTINGS_HUB_PREFIX}/rag`
    },
    'web-search': {
      icon: icon(<MdTravelExplore />),
      label: t('agent.tools.web_search', '网络搜索'),
      path: `${SETTINGS_HUB_PREFIX}/web-search`
    },
    'agent-tools': {
      icon: icon(<MdOutlineExtension />),
      label: t('settings.agent_tools_title', '工具管理'),
      path: `${SETTINGS_HUB_PREFIX}/agent-tools`
    },
    'summary-settings': {
      icon: icon(<MdOutlineAutoAwesome />),
      label: t('settings.summary_settings_title', '回忆生成设置'),
      path: `${SETTINGS_HUB_PREFIX}/summary`
    },
    tts: {
      icon: icon(<MdVolumeUp />),
      label: t('settings.tts_settings', 'TTS 语音合成'),
      path: `${SETTINGS_HUB_PREFIX}/tts`
    },
    lan: {
      icon: icon(<MdWifi />),
      label: t('settings.lan_transfer', '局域网传输'),
      path: `${SETTINGS_HUB_PREFIX}/lan-transfer`
    },
    sync: {
      icon: icon(<MdOutlineStorage />),
      label: t('data_sync.title', '数据备份'),
      path: `${SETTINGS_HUB_PREFIX}/data-sync`
    },
    'incremental-sync': {
      icon: icon(<MdSync />),
      label: t('data_sync.incremental_sync', '增量同步'),
      path: `${SETTINGS_HUB_PREFIX}/incremental-sync`
    },
    attachments: {
      icon: icon(<MdOutlineCollections />),
      label: t('settings.attachment_management', '附件管理'),
      path: `${SETTINGS_HUB_PREFIX}/attachments`
    },
    git: {
      icon: icon(<MdHistory />),
      label: t('version_control.title', '版本控制'),
      path: `${SETTINGS_HUB_PREFIX}/git`
    }
  }
}

export function getDefaultHiddenNavIds(): SidebarNavId[] {
  const visible = new Set<string>(DEFAULT_VISIBLE_NAV_IDS)
  return ALL_SIDEBAR_NAV_IDS.filter((id) => !visible.has(id))
}

export function isSidebarNavSelected(pathname: string, path: string): boolean {
  if (path === `${SETTINGS_HUB_PREFIX}/general`) {
    return pathname === SETTINGS_HUB_PREFIX || pathname === `${SETTINGS_HUB_PREFIX}/general`
  }
  return pathname === path || pathname.startsWith(`${path}/`)
}
