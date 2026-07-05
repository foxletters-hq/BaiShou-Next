import React, { useCallback } from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
import { AgentToolsView } from '@baishou/ui/native'
import type { EmojiImportResult } from '@baishou/core'
import { useBaishou } from '../../../providers/BaishouProvider'
import { MobileAttachmentManagerService } from '../../../services/mobile-attachment-manager.service'
import { useToolManagementConfig } from '../../../hooks/useToolManagementConfig'

export const AgentToolsSection: React.FC = () => {
  const router = useRouter()
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
    <View style={{ flex: 1 }}>
      <AgentToolsView
        config={config}
        onChange={persist}
        disableScroll
        onPickAndImportEmojis={handlePickAndImportEmojis}
        onResolveEmojiPath={handleResolveEmojiPath}
        onDeleteEmoji={handleDeleteEmoji}
        onOpenEmojiSettings={() => router.push('/settings/emoji')}
      />
    </View>
  )
}
