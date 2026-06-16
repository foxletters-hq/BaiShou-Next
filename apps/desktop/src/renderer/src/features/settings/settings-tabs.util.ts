import { getSettingsRouteSegment } from './settings-route.util'

/** 设置侧栏 tab id → 路由 segment（hub / overlay 共用） */
export const SETTINGS_TAB_SEGMENTS: Record<number, string> = {
  0: 'general',
  13: 'mcp',
  1: 'ai-services',
  2: 'ai-models',
  3: 'assistants',
  4: 'rag',
  5: 'web-search',
  6: 'agent-tools',
  15: 'diary-template',
  16: 'diary-ai-writing',
  7: 'summary',
  11: 'tts',
  14: 'incremental-sync',
  9: 'data-sync',
  12: 'git',
  10: 'attachments',
  8: 'lan-transfer'
}

const SEGMENT_TO_TAB: Record<string, number> = {
  workspaces: 0,
  'identity-cards': 0
}

for (const [tabId, segment] of Object.entries(SETTINGS_TAB_SEGMENTS)) {
  SEGMENT_TO_TAB[segment] = Number(tabId)
}

export function pathnameToSettingsTabId(pathname: string): number {
  const segment = getSettingsRouteSegment(pathname)
  return SEGMENT_TO_TAB[segment] ?? 0
}
