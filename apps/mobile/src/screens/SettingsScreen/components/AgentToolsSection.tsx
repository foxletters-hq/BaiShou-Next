import React from 'react'
import { useRouter } from 'expo-router'
import { AgentToolsView } from '@baishou/ui/native'
import { useToolManagementConfig } from '../../../hooks/useToolManagementConfig'

export const AgentToolsSection: React.FC = () => {
  const router = useRouter()
  const { config, persist } = useToolManagementConfig()

  return (
    <AgentToolsView
      config={config}
      onChange={persist}
      disableScroll
      onOpenEmojiSettings={() => router.push('/settings/emoji')}
    />
  )
}
