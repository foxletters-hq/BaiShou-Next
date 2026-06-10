import React, { useState, useEffect } from 'react'
import { useRouter } from 'expo-router'
import { AssistantPicker as SharedAssistantPicker } from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'
import { resolveAssistantAvatarDisplayUri } from '../lib/assistant-avatar-uri'
import type { MockAgentAssistant } from '@baishou/ui/native'

interface AssistantPickerProps {
  isVisible: boolean
  onClose: () => void
  onSelect: (assistant: any) => void
  selectedAssistantId?: string
}

export const AssistantPicker: React.FC<AssistantPickerProps> = (props) => {
  const router = useRouter()
  const { services, dbReady } = useBaishou()
  const [assistants, setAssistants] = useState<any[]>([])

  useEffect(() => {
    if (!props.isVisible || !dbReady || !services) return

    const load = async () => {
      try {
        const list = (await services.settingsManager.get<any[]>('assistants')) || []
        const mapped: MockAgentAssistant[] = await Promise.all(
          list.map(async (a) => ({
            id: a.id,
            name: a.name,
            description: a.description || '',
            emoji: a.emoji,
            avatarPath: a.avatarPath,
            displayAvatarUri: await resolveAssistantAvatarDisplayUri(a.avatarPath, (path) =>
              services.attachmentManager.resolveAvatarPath(path)
            ),
            systemPrompt: a.systemPrompt,
            providerId: a.providerId,
            modelId: a.modelId
          }))
        )
        setAssistants(mapped)
      } catch {
        setAssistants([])
      }
    }

    void load()
  }, [props.isVisible, dbReady, services])

  const openAssistants = () => {
    router.push('/settings/assistants')
  }

  return (
    <SharedAssistantPicker
      isOpen={props.isVisible}
      onClose={props.onClose}
      assistants={assistants}
      currentAssistantId={props.selectedAssistantId || null}
      onSelect={(selected) => {
        const full = assistants.find((a) => a.id === selected.id)
        props.onSelect(full || selected)
      }}
      onSettingsPress={openAssistants}
      onCreatePress={openAssistants}
    />
  )
}
