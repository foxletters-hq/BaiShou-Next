import React, { useCallback } from 'react'
import { useRouter } from 'expo-router'
import {
  AssistantPickerSheet,
  type AssistantPickerSheetAssistant
} from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'
import { markAssistantsNeedRefresh } from '../lib/assistant-ui-refresh-signal'
import type { MockAgentAssistant } from '@baishou/ui/native'

interface AssistantPickerProps {
  isVisible: boolean
  onClose: () => void
  onSelect: (assistant: MockAgentAssistant) => void
  selectedAssistantId?: string
  assistants: MockAgentAssistant[]
  onAssistantsChanged?: () => void
}

function toSheetAssistant(assistant: MockAgentAssistant): AssistantPickerSheetAssistant {
  return {
    id: assistant.id,
    name: assistant.name,
    emoji: assistant.emoji,
    avatarPath: assistant.avatarPath,
    displayAvatarUri: assistant.displayAvatarUri,
    description: assistant.description,
    contextWindow: assistant.contextWindow,
    compressTokenThreshold: assistant.compressTokenThreshold,
    compressKeepTurns: assistant.compressKeepTurns,
    compressSystemPrompt: assistant.compressSystemPrompt,
    assistantKind: assistant.assistantKind
  }
}

export const AssistantPicker: React.FC<AssistantPickerProps> = ({
  isVisible,
  onClose,
  onSelect,
  selectedAssistantId,
  assistants,
  onAssistantsChanged
}) => {
  const router = useRouter()
  const { services } = useBaishou()

  const openAssistants = () => {
    onClose()
    router.push('/settings/assistants')
  }

  const handleSaveMemoryConfig = useCallback(
    async (
      assistantId: string,
      updates: {
        contextWindow?: number
        compressTokenThreshold?: number
        compressKeepTurns?: number
        compressSystemPrompt?: string | null
      }
    ) => {
      if (!services?.assistantManager) return
      await services.assistantManager.update(assistantId, updates)
      markAssistantsNeedRefresh()
      onAssistantsChanged?.()
    },
    [onAssistantsChanged, services?.assistantManager]
  )

  return (
    <AssistantPickerSheet
      isOpen={isVisible}
      onClose={onClose}
      assistants={assistants.map(toSheetAssistant)}
      currentAssistantId={selectedAssistantId || null}
      onSelect={(selected) => {
        const full = assistants.find((a) => a.id === selected.id)
        onSelect(full || (selected as MockAgentAssistant))
      }}
      onSaveMemoryConfig={handleSaveMemoryConfig}
      onSettingsPress={openAssistants}
      onCreatePress={openAssistants}
    />
  )
}
