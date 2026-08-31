import {
  DEFAULT_TOOL_MANAGEMENT_CONFIG,
  EMOJI_TOOL_CONFIG_UPDATED_EVENT,
  normalizeEmojiToolConfig,
  normalizeToolManagementConfig,
  type EmojiToolConfig,
  type ToolManagementConfig
} from '@baishou/shared'

type SettingsApi = {
  getToolManagementConfig?: () => Promise<ToolManagementConfig | null>
  setToolManagementConfig?: (config: ToolManagementConfig) => Promise<void>
}

export async function persistDesktopEmojiToolConfig(
  next: EmojiToolConfig
): Promise<EmojiToolConfig | null> {
  const api = (window as { api?: { settings?: SettingsApi } }).api?.settings
  if (!api?.getToolManagementConfig || !api?.setToolManagementConfig) return null
  const current = await api.getToolManagementConfig()
  const merged = normalizeToolManagementConfig(current ?? DEFAULT_TOOL_MANAGEMENT_CONFIG)
  const emojiConfig = normalizeEmojiToolConfig(next)
  await api.setToolManagementConfig({ ...merged, emojiConfig })
  window.dispatchEvent(
    new CustomEvent(EMOJI_TOOL_CONFIG_UPDATED_EVENT, { detail: emojiConfig })
  )
  return emojiConfig
}
