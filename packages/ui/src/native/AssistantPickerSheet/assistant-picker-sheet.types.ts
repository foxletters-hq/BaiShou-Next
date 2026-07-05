export interface AssistantPickerSheetAssistant {
  id: string
  name: string
  emoji?: string
  avatarPath?: string
  displayAvatarUri?: string
  description?: string
  contextWindow?: number
  compressTokenThreshold?: number
  compressKeepTurns?: number
  compressSystemPrompt?: string | null
  assistantKind?: 'companion' | 'work'
}

export type AssistantMemoryConfigPatch = {
  contextWindow?: number
  compressTokenThreshold?: number
  compressKeepTurns?: number
  compressSystemPrompt?: string | null
}

export interface AssistantPickerSheetProps {
  isOpen: boolean
  onClose: () => void
  assistants: AssistantPickerSheetAssistant[]
  currentAssistantId?: string | null
  onSelect: (assistant: AssistantPickerSheetAssistant) => void
  onSaveMemoryConfig?: (
    assistantId: string,
    updates: AssistantMemoryConfigPatch
  ) => Promise<void>
  onSettingsPress?: () => void
  onCreatePress?: () => void
}
