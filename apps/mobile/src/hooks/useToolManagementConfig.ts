import { useCallback, useEffect, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import type { ToolManagementConfig } from '@baishou/shared'
import {
  AUTO_INJECT_TIME_TOOL_ID,
  normalizeEmojiToolConfig,
  normalizeToolManagementConfig
} from '@baishou/shared'
import { useBaishou } from '../providers/BaishouProvider'
import { publishEmojiToolConfig, subscribeEmojiToolConfig } from '../lib/emoji-tool-config.store'

export const DEFAULT_TOOL_MANAGEMENT_CONFIG: ToolManagementConfig = {
  disabledToolIds: [AUTO_INJECT_TIME_TOOL_ID],
  customConfigs: {},
  emojiConfig: {
    enabled: false,
    groups: []
  }
}

export function mergeToolManagementConfig(
  saved: ToolManagementConfig | null | undefined
): ToolManagementConfig {
  const merged = normalizeToolManagementConfig({
    ...DEFAULT_TOOL_MANAGEMENT_CONFIG,
    ...(saved ?? {})
  })
  return {
    ...merged,
    emojiConfig: normalizeEmojiToolConfig(merged.emojiConfig)
  }
}

async function readToolManagementConfig(
  get: <T>(key: string) => Promise<T | null | undefined>,
  set: (key: string, value: ToolManagementConfig) => Promise<void>
): Promise<ToolManagementConfig> {
  let saved = (await get<ToolManagementConfig>('tool_management_config')) ?? null
  if (!saved) {
    const legacy = (await get<ToolManagementConfig>('tool_config')) ?? null
    if (legacy) {
      saved = legacy
      await set('tool_management_config', legacy)
    }
  }
  return mergeToolManagementConfig(saved)
}

/** 工具管理页：聚焦时 reload，并订阅表情包设置的共享态 */
export function useToolManagementConfig() {
  const { dbReady, services } = useBaishou()
  const [config, setConfig] = useState<ToolManagementConfig>(DEFAULT_TOOL_MANAGEMENT_CONFIG)

  const loadConfig = useCallback(async () => {
    if (!dbReady || !services) return
    const next = await readToolManagementConfig(
      services.settingsManager.get.bind(services.settingsManager),
      services.settingsManager.set.bind(services.settingsManager)
    )
    setConfig(next)
    publishEmojiToolConfig(next.emojiConfig!)
  }, [dbReady, services])

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  useFocusEffect(
    useCallback(() => {
      void loadConfig()
    }, [loadConfig])
  )

  useEffect(() => {
    return subscribeEmojiToolConfig((emojiConfig) => {
      setConfig((prev) => ({ ...prev, emojiConfig }))
    })
  }, [])

  const persist = useCallback(
    async (next: ToolManagementConfig) => {
      const normalized = mergeToolManagementConfig(next)
      setConfig(normalized)
      publishEmojiToolConfig(normalized.emojiConfig!)
      if (!services || !dbReady) return
      await services.settingsManager.set('tool_management_config', normalized)
    },
    [dbReady, services]
  )

  return { config, persist, reload: loadConfig, ready: dbReady && Boolean(services) }
}
