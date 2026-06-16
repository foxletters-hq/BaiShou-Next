export interface AssistantInfo {
  id: string
  name: string
  emoji: string
  avatarPath?: string
  description?: string
  systemPrompt: string
  contextWindow: number
  providerId?: string
  modelId?: string
  compressTokenThreshold: number
  compressKeepTurns?: number
  compressSystemPrompt?: string | null
  ragSpaceId?: string
  assistantKind?: 'companion' | 'work'
}

export interface AssistantPickerSheetProps {
  isOpen: boolean
  assistants: AssistantInfo[]
  currentAssistantId?: string
  onSelect: (assistant: AssistantInfo) => void
  onClose: () => void
  onCreateNew?: () => void
  onRefreshAssistants?: () => void
  pinnedIds?: Set<string>
  onTogglePin?: (id: string, isPinned: boolean) => void
}
