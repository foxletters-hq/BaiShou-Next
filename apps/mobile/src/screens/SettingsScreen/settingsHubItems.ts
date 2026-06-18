import type { MaterialIcons } from '@expo/vector-icons'

export type SettingsStackPathname =
  | '/settings/assistants'
  | '/settings/lan-transfer'
  | '/settings/data-sync'
  | '/settings/version-migration'
  | '/incremental-sync'
  | '/settings/tts'

export type SettingsHubRoute =
  | { type: 'section'; section: string }
  | { type: 'stack'; pathname: SettingsStackPathname }
  | { type: 'inline'; id: 'storage' }

export interface SettingsHubItem {
  id: string
  titleKey: string
  icon: keyof typeof MaterialIcons.glyphMap
  route: SettingsHubRoute
}

export interface SettingsHubGroup {
  titleKey: string
  items: SettingsHubItem[]
}

/** 与桌面端 SettingsPage / 旧版 BaiShou 移动枢纽分组对齐 */
export const SETTINGS_HUB_GROUPS: SettingsHubGroup[] = [
  {
    titleKey: 'settings.hub_group_ai',
    items: [
      {
        id: 'ai-services',
        titleKey: 'settings.ai_services',
        icon: 'cloud-queue',
        route: { type: 'section', section: 'ai-services' }
      },
      {
        id: 'ai-models',
        titleKey: 'settings.ai_global_models',
        icon: 'star-outline',
        route: { type: 'section', section: 'ai-models' }
      },
      {
        id: 'assistants',
        titleKey: 'agent.assistant.settings_entry',
        icon: 'school',
        route: { type: 'stack', pathname: '/settings/assistants' }
      },
      {
        id: 'rag',
        titleKey: 'agent.rag.title',
        icon: 'psychology',
        route: { type: 'section', section: 'rag' }
      },
      {
        id: 'web-search',
        titleKey: 'agent.tools.web_search',
        icon: 'travel-explore',
        route: { type: 'section', section: 'web-search' }
      },
      {
        id: 'agent-tools',
        titleKey: 'settings.agent_tools_title',
        icon: 'extension',
        route: { type: 'section', section: 'agent-tools' }
      },
      {
        id: 'tts',
        titleKey: 'settings.tts_settings',
        icon: 'volume-up',
        route: { type: 'stack', pathname: '/settings/tts' }
      }
    ]
  },
  {
    titleKey: 'settings.hub_group_diary',
    items: [
      {
        id: 'diary-template',
        titleKey: 'settings.diary_template_title',
        icon: 'edit-note',
        route: { type: 'section', section: 'diary-template' }
      },
      {
        id: 'diary-ai-writing',
        titleKey: 'settings.diary_partner_writing_title',
        icon: 'text-snippet',
        route: { type: 'section', section: 'diary-ai-writing' }
      },
      {
        id: 'summary',
        titleKey: 'settings.summary_settings_title',
        icon: 'auto-awesome',
        route: { type: 'section', section: 'summary' }
      }
    ]
  },
  {
    titleKey: 'settings.hub_group_data',
    items: [
      {
        id: 'incremental-sync',
        titleKey: 'data_sync.incremental_sync',
        icon: 'sync',
        route: { type: 'stack', pathname: '/incremental-sync' }
      },
      {
        id: 'data-sync',
        titleKey: 'data_sync.title',
        icon: 'backup',
        route: { type: 'stack', pathname: '/settings/data-sync' }
      },
      {
        id: 'attachments',
        titleKey: 'settings.attachment_management',
        icon: 'folder-delete',
        route: { type: 'section', section: 'attachments' }
      },
      {
        id: 'lan-transfer',
        titleKey: 'settings.lan_transfer',
        icon: 'wifi-tethering',
        route: { type: 'stack', pathname: '/settings/lan-transfer' }
      },
      {
        id: 'storage',
        titleKey: 'storage.title',
        icon: 'folder',
        route: { type: 'inline', id: 'storage' }
      },
      {
        id: 'version-migration',
        titleKey: 'version_migration.title',
        icon: 'system-update-alt',
        route: { type: 'stack', pathname: '/settings/version-migration' }
      }
    ]
  }
]

export const HIDDEN_SETTINGS_SECTIONS = ['developer'] as const

export const SETTINGS_SECTION_IDS = new Set([
  ...SETTINGS_HUB_GROUPS.flatMap((g) =>
    g.items
      .filter(
        (item): item is SettingsHubItem & { route: { type: 'section' } } =>
          item.route.type === 'section'
      )
      .map((item) => item.route.section)
  ),
  ...HIDDEN_SETTINGS_SECTIONS
])

const HIDDEN_SECTION_TITLE_KEYS: Record<string, string> = {
  developer: 'settings.developer_options'
}

export function getHubItemTitleKey(section: string): string | undefined {
  if (section in HIDDEN_SECTION_TITLE_KEYS) {
    return HIDDEN_SECTION_TITLE_KEYS[section]
  }
  for (const group of SETTINGS_HUB_GROUPS) {
    for (const item of group.items) {
      if (item.route.type === 'section' && item.route.section === section) {
        return item.titleKey
      }
    }
  }
  return undefined
}
