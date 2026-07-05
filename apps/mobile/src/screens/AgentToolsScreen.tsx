import React, { useCallback } from 'react'
import { useRouter } from 'expo-router'
import { AgentToolsView, useNativeTheme } from '@baishou/ui/native'
import type { EmojiImportResult } from '@baishou/core'
import { useTranslation } from 'react-i18next'
import { useBaishou } from '../providers/BaishouProvider'
import { StackScreenLayout } from '../components/StackScreenLayout'
import { getStackScreenChrome } from '../components/stackScreenChrome'
import { MobileAttachmentManagerService } from '../services/mobile-attachment-manager.service'
import { useToolManagementConfig } from '../hooks/useToolManagementConfig'

export const AgentToolsScreen: React.FC = () => {
  const router = useRouter()
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { services } = useBaishou()
  const { config, persist } = useToolManagementConfig()

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
        onOpenEmojiSettings={() => router.push('/settings/emoji')}
      />
    </StackScreenLayout>
  )
}
