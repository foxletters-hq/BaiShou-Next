import React from 'react'
import { useRouter } from 'expo-router'
import {
  AssistantPicker as SharedAssistantPicker,
  type MockAgentAssistant
} from '@baishou/ui/native'

interface AssistantPickerProps {
  isVisible: boolean
  onClose: () => void
  onSelect: (assistant: MockAgentAssistant) => void
  selectedAssistantId?: string
  assistants: MockAgentAssistant[]
}

export const AssistantPicker: React.FC<AssistantPickerProps> = ({
  isVisible,
  onClose,
  onSelect,
  selectedAssistantId,
  assistants
}) => {
  const router = useRouter()

  const openAssistants = () => {
    router.push('/settings/assistants')
  }

  return (
    <SharedAssistantPicker
      isOpen={isVisible}
      onClose={onClose}
      assistants={assistants}
      currentAssistantId={selectedAssistantId || null}
      onSelect={(selected) => {
        const full = assistants.find((a) => a.id === selected.id)
        onSelect(full || selected)
      }}
      onSettingsPress={openAssistants}
      onCreatePress={openAssistants}
    />
  )
}
