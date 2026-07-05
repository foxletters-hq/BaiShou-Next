import { useCallback, useEffect, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import type { EmojiToolConfig, ToolManagementConfig } from '@baishou/shared'
import { normalizeEmojiToolConfig } from '@baishou/shared'
import { useBaishou } from '../providers/BaishouProvider'
import {
  DEFAULT_TOOL_MANAGEMENT_CONFIG,
  mergeToolManagementConfig
} from './useToolManagementConfig'
import {
  getSharedEmojiToolConfig,
  publishEmojiToolConfig,
  subscribeEmojiToolConfig
} from '../lib/emoji-tool-config.store'

export function useEmojiToolSettings() {
  const { dbReady, services } = useBaishou()
  const [config, setConfig] = useState<EmojiToolConfig>(getSharedEmojiToolConfig())

  useEffect(() => subscribeEmojiToolConfig(setConfig), [])

  const loadConfig = useCallback(async () => {
    if (!dbReady || !services) return
    const saved =
      (await services.settingsManager.get<ToolManagementConfig>('tool_management_config')) ??
      DEFAULT_TOOL_MANAGEMENT_CONFIG
    publishEmojiToolConfig(normalizeEmojiToolConfig(mergeToolManagementConfig(saved).emojiConfig))
  }, [dbReady, services])

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  useFocusEffect(
    useCallback(() => {
      void loadConfig()
    }, [loadConfig])
  )

  const persist = useCallback(
    async (nextEmojiConfig: EmojiToolConfig) => {
      if (!services || !dbReady) return
      const normalizedNext = normalizeEmojiToolConfig(nextEmojiConfig)
      publishEmojiToolConfig(normalizedNext)

      const saved =
        (await services.settingsManager.get<ToolManagementConfig>('tool_management_config')) ??
        DEFAULT_TOOL_MANAGEMENT_CONFIG
      const merged = mergeToolManagementConfig(saved)
      const next: ToolManagementConfig = {
        ...merged,
        emojiConfig: normalizedNext
      }
      await services.settingsManager.set('tool_management_config', next)
    },
    [dbReady, services]
  )

  return { config, persist, reload: loadConfig, ready: dbReady && Boolean(services) }
}
