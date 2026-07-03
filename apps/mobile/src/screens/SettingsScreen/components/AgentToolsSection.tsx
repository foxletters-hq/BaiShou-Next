import React, { useCallback, useEffect, useState } from 'react'
import { View } from 'react-native'
import type { ToolManagementConfig } from '@baishou/shared'
import { AUTO_INJECT_TIME_TOOL_ID, normalizeToolManagementConfig } from '@baishou/shared'
import { AgentToolsView } from '@baishou/ui/native'
import type { EmojiImportResult } from '@baishou/core'
import { useBaishou } from '../../../providers/BaishouProvider'
import { MobileAttachmentManagerService } from '../../../services/mobile-attachment-manager.service'

const DEFAULT_TOOL_MANAGEMENT_CONFIG: ToolManagementConfig = {
  disabledToolIds: [AUTO_INJECT_TIME_TOOL_ID],
  customConfigs: {},
  emojiConfig: {
    enabled: true,
    emojis: []
  }
}

function mergeToolManagementConfig(saved: ToolManagementConfig): ToolManagementConfig {
  return normalizeToolManagementConfig({
    ...DEFAULT_TOOL_MANAGEMENT_CONFIG,
    ...saved,
    emojiConfig: {
      ...DEFAULT_TOOL_MANAGEMENT_CONFIG.emojiConfig!,
      ...(saved.emojiConfig || {})
    }
  })
}

export const AgentToolsSection: React.FC = () => {
  const { dbReady, services } = useBaishou()
  const [config, setConfig] = useState<ToolManagementConfig>(DEFAULT_TOOL_MANAGEMENT_CONFIG)

  useEffect(() => {
    if (!dbReady || !services) return
    void (async () => {
      const saved =
        (await services.settingsManager.get<ToolManagementConfig>('tool_management_config')) ??
        DEFAULT_TOOL_MANAGEMENT_CONFIG
      setConfig(mergeToolManagementConfig(saved))
    })()
  }, [dbReady, services])

  const persist = async (next: ToolManagementConfig) => {
    if (!services || !dbReady) return
    await services.settingsManager.set(
      'tool_management_config',
      normalizeToolManagementConfig(next)
    )
    setConfig(next)
  }

  const handlePickAndImportEmojis = useCallback(async (): Promise<EmojiImportResult[]> => {
    if (!services) return []
    return MobileAttachmentManagerService.pickAndImportEmojis(services.attachmentManager)
  }, [services])

  const handleResolveEmojiPath = useCallback(
    async (relativePath: string): Promise<string> => {
      if (!services) return ''
      try {
        return await services.attachmentManager.resolveEmojiPath(relativePath)
      } catch {
        return ''
      }
    },
    [services]
  )

  const handleDeleteEmoji = useCallback(
    async (relativePath: string): Promise<boolean> => {
      if (!services) return false
      return services.attachmentManager.deleteEmoji(relativePath)
    },
    [services]
  )

  return (
    <View style={{ flex: 1 }}>
      <AgentToolsView
        config={config}
        onChange={persist}
        disableScroll
        onPickAndImportEmojis={handlePickAndImportEmojis}
        onResolveEmojiPath={handleResolveEmojiPath}
        onDeleteEmoji={handleDeleteEmoji}
      />
    </View>
  )
}
