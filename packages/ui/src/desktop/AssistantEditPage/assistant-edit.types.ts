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
  /** 编辑已有伙伴时，记忆类滑动条松手后立即保存 */
  onPatchSave?: (id: string, patch: Partial<AssistantFormData>) => void | Promise<void>
  onDelete?: () => void
  onBack: () => void
  onPickEmoji?: () => Promise<string | null>
  providers?: any[]
}
