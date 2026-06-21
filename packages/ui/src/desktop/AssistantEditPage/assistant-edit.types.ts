import type { AssistantKind } from '@baishou/shared'

export interface AssistantFormData {
  id?: string
  name: string
  emoji: string
  description: string
  systemPrompt: string
  contextWindow: number
  providerId?: string
  modelId?: string
  compressTokenThreshold: number
  compressKeepTurns: number
  avatarPath?: string
  welcomeMessage?: string
  temperature?: number
  topP?: number
  maxTokens?: number
  ragSpaceId?: string
  assistantKind?: AssistantKind
}

export interface AssistantEditPageProps {
  assistant: AssistantFormData | null
  isLastAssistant?: boolean
  onSave: (data: AssistantFormData) => void
  onDelete?: () => void
  onBack: () => void
  onPickEmoji?: () => Promise<string | null>
  providers?: any[]
}
