import React, { useState, useEffect } from 'react'
import { useRouter } from 'expo-router'
import { AssistantPicker as SharedAssistantPicker } from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'
import { listAssistantsForUi } from '../lib/mobile-assistant.util'
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

    let cancelled = false
    const load = async () => {
      try {
        const list = await listAssistantsForUi(
          services.assistantManager,
          services.attachmentManager,
          services.fileSystem
        )
        const mapped: MockAgentAssistant[] = list.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description || '',
          emoji: a.emoji,
          avatarPath: a.avatarPath ?? undefined,
          displayAvatarUri: a.displayAvatarUri,
          systemPrompt: a.systemPrompt,
          providerId: a.providerId,
          modelId: a.modelId
        }))
        if (!cancelled) setAssistants(mapped)
      } catch {
        if (!cancelled) setAssistants([])
      }
    }

    void load()
    return () => {
      cancelled = true
    }
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
