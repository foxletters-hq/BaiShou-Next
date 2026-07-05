import React from 'react'
import { useRouter } from 'expo-router'
import {
  AssistantPicker as NativeAssistantPicker,
  type MockAgentAssistant
} from '@baishou/ui/native'

interface AssistantPickerProps {
  isVisible: boolean
  onClose: () => void
  onSelect: (assistant: MockAgentAssistant) => void
  selectedAssistantId?: string
  assistants: MockAgentAssistant[]
  onAssistantsChanged?: () => void
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

  const openAssistants = () => {
    onClose()
    router.push('/settings/assistants')
  }

  return (
    <NativeAssistantPicker
      isOpen={isVisible}
      onClose={onClose}
      assistants={assistants}
      currentAssistantId={selectedAssistantId || null}
      onSelect={(assistant) => {
        onSelect(assistant)
        onAssistantsChanged?.()
      }}
      onSettingsPress={openAssistants}
      onCreatePress={openAssistants}
    />
  )
}
