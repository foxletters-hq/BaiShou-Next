import React, { useCallback, useEffect, useState } from 'react'
import type { ToolManagementConfig } from '@baishou/shared'
import { normalizeToolManagementConfig } from '@baishou/shared'
import { AgentToolsView, useNativeTheme } from '@baishou/ui/native'
import type { EmojiImportResult } from '@baishou/core'
import { useTranslation } from 'react-i18next'
import { useBaishou } from '../providers/BaishouProvider'
import { StackScreenLayout } from '../components/StackScreenLayout'
import { getStackScreenChrome } from '../components/stackScreenChrome'
import { MobileAttachmentManagerService } from '../services/mobile-attachment-manager.service'

const DEFAULT_CONFIG: ToolManagementConfig = {
  disabledToolIds: ['auto_inject_time'],
  customConfigs: {},
  emojiConfig: {
    enabled: true,
    emojis: []
  }
}

function mergeToolManagementConfig(saved: ToolManagementConfig | null): ToolManagementConfig {
  if (!saved) return DEFAULT_CONFIG
  return normalizeToolManagementConfig({
    ...DEFAULT_CONFIG,
    ...saved,
    emojiConfig: {
      ...DEFAULT_CONFIG.emojiConfig!,
      ...(saved.emojiConfig || {})
    }
  })
}

export const AgentToolsScreen: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { dbReady, services } = useBaishou()
  const [config, setConfig] = useState<ToolManagementConfig>(DEFAULT_CONFIG)

  useEffect(() => {
    if (!dbReady || !services) return
    void (async () => {
      let saved =
        (await services.settingsManager.get<ToolManagementConfig>('tool_management_config')) ?? null
      if (!saved) {
        const legacy =
          (await services.settingsManager.get<ToolManagementConfig>('tool_config')) ?? null
        if (legacy) {
          saved = legacy
          await services.settingsManager.set('tool_management_config', legacy)
        }
      }
      setConfig(mergeToolManagementConfig(saved))
    })()
  }, [dbReady, services])

  const persist = useCallback(
    async (next: ToolManagementConfig) => {
      setConfig(next)
      if (!services || !dbReady) return
      await services.settingsManager.set('tool_management_config', normalizeToolManagementConfig(next))
    },
    [dbReady, services]
  )

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
    <StackScreenLayout
      title={t('settings.agent_tools_title', '工具管理')}
      {...getStackScreenChrome(colors)}
    >
      <AgentToolsView
        config={config}
        onChange={persist}
        onPickAndImportEmojis={handlePickAndImportEmojis}
        onResolveEmojiPath={handleResolveEmojiPath}
        onDeleteEmoji={handleDeleteEmoji}
      />
    </StackScreenLayout>
  )
}
